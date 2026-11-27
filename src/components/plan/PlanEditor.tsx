import { useMemo, useRef, useState } from "react";
import { ChevronRight, Pause, Play } from "lucide-react";
import { notify, offerUndo } from "@/lib/message-store";
import { useData } from "@/contexts/useData";
import ConfirmDialog from "@/components/ConfirmDialog";
import GoalEditor from "@/components/goals/GoalEditor";
import CellSheet from "@/components/plan/CellSheet";
import PlanCycle from "@/components/plan/PlanCycle";
import PlanGoalLinks from "@/components/plan/PlanGoalLinks";
import PlanPeriodPicker from "@/components/plan/PlanPeriodPicker";
import PlanProgression from "@/components/plan/PlanProgression";
import PlanTemplateGrid from "@/components/plan/PlanTemplateGrid";
import PlanUpcoming from "@/components/plan/PlanUpcoming";
import Sheet from "@/components/ui/Sheet";
import { activeGoals, goalTitle } from "@/data/goals";
import { type Goal, type Plan, today as todayDate } from "@/data/model";
import {
  MAX_PHASE_WEEKS,
  cyclePreset,
  defaultDeload,
  periodSummary,
  periodText,
  phaseWeek,
  phaseWeeks,
  trimProgression,
  withCyclePreset,
  withWeekKind,
  withWeekOneCopied,
} from "@/data/phase";
import PlanPeriodCalendar from "@/components/plan/PlanPeriodCalendar";
import { periodLabels } from "@/lib/period-calendar";
import { shiftDate } from "@/lib/dates";
import {
  type PlanItem,
  activePlans,
  cellText,
  defaultNewPlan,
  findOverlap,
  groupsOf,
  overlapMessage,
  planDay,
  resolveCell,
  trimOverrides,
  withOverride,
  withPaused,
  withTemplateCell,
} from "@/data/plans";
import { routines as routineRecords } from "@/data/selectors";
import { localizedDate, weekdayNames } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import Reveal from "@/components/motion/Reveal";

/** The Plan subscreen's list, where a deleted plan leaves its Undo. */
export const PLANS_SCOPE = "plans";

/** The cell being chosen: a template day, or one dated override. */
type Target = { week: number; day: number } | { date: string };

const periodValid = (p: Plan) =>
  /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) &&
  /^\d{4}-\d{2}-\d{2}$/.test(p.endDate) &&
  p.startDate <= p.endDate;

/**
 * The plan after its period changed (F1): a deload that was the length's
 * default follows the new length's default (8 → 12 weeks: 7 + 1 becomes 5 + 1
 * twice); another preset keeps its rhythm; deload weeks marked in the cycle
 * stay as they are.
 */
function followLength(before: Plan, next: Plan): Plan {
  if (!periodValid(next)) return next;
  if (!next.deloadWeeks && next.weekKinds) return next;
  const was = periodValid(before) ? cyclePreset(before) : null;
  const wasDefault =
    !periodValid(before) || was === defaultDeload(phaseWeeks(before));
  if (wasDefault) return withCyclePreset(next, defaultDeload(phaseWeeks(next)));
  return was ? withCyclePreset(next, was) : next;
}

/** Creates or edits one plan in a full sheet. `plan` is null for a new one. */
export default function PlanEditor({
  open,
  plan,
  draft: prefilled,
  onClose,
}: {
  open: boolean;
  plan: PlanItem | null;
  /** A new plan prefilled (P4: a plan made from a standard programme). */
  draft?: Plan;
  onClose: () => void;
}) {
  const { state, save, deleteRecord } = useData();
  const today = todayDate();
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const groups = useMemo(() => groupsOf(state.records), [state.records]);
  const goals = useMemo(() => activeGoals(state.records), [state.records]);
  const names = { routines, groups };
  const dayNames = weekdayNames();

  const [draft, setDraft] = useState<Plan>(() => {
    if (!plan) {
      if (prefilled) return prefilled;
      // A new plan gets the deload its length suggests (8 weeks: 7 + 1).
      const fresh = defaultNewPlan(plans, today);
      return withCyclePreset(fresh, defaultDeload(phaseWeeks(fresh)));
    }
    // The id names the record; it is not part of the saved plan.
    const { id: _id, ...saved } = plan;
    return saved;
  });
  const [target, setTarget] = useState<Target | null>(null);
  // "+ New goal": the goal editor, a fresh form each time; the saved goal is linked.
  const [newGoal, setNewGoal] = useState(0);
  const [goalOpen, setGoalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Progression rows to make a lift goal from when the plan is saved.
  const [goalFor, setGoalFor] = useState<ReadonlySet<string>>(new Set());
  const set = (change: Partial<Plan>) => setDraft((d) => ({ ...d, ...change }));
  // F1: the period row's sheet, and the plan as it was when it opened, so
  // the deload follows the new length (see followLength).
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodBase = useRef<Plan | null>(null);
  // A cell that is a workout to train, routines and groups that still exist.
  const isWorkout = (cell: string | null | undefined) => {
    const day = resolveCell(cell, names);
    return !!day && day.kind !== "rest";
  };
  // "Börjar dagen efter att Styrkeblock slutar."
  const follows =
    plans.find(
      (p) => p.id !== plan?.id && shiftDate(p.endDate, 1) === draft.startDate,
    ) ?? null;
  const goalTitleOf = (goalId: string | undefined) => {
    const goal = goalId ? goals.find((g) => g.id === goalId) : undefined;
    return goal ? goalTitle(goal) : null;
  };

  const validPeriod =
    /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.endDate) &&
    draft.startDate <= draft.endDate;
  const overlap = validPeriod ? findOverlap(plans, draft, plan?.id) : null;
  const weeks = validPeriod ? phaseWeeks(draft) : 0;
  // A phase is at most six months. A longer plan saved before phases existed
  // can still be edited as long as its period stays and it has no progression.
  const tooLong =
    weeks > MAX_PHASE_WEEKS &&
    (!plan ||
      plan.startDate !== draft.startDate ||
      plan.endDate !== draft.endDate ||
      !!draft.progression?.length);
  const unfinished = draft.progression?.find(
    (i) => !(i.startKg > 0) || !(i.targetKg > 0),
  );
  const problem = !draft.name.trim()
    ? t("plan.needName")
    : !validPeriod
      ? t("plan.needPeriod")
      : overlap
        ? overlapMessage(overlap)
        : tooLong
          ? t("plan.tooLong", { max: MAX_PHASE_WEEKS })
          : unfinished
            ? t("prog.needStart", { name: unfinished.name })
            : "";

  const choose = (cell: string | null | undefined) => {
    if (!target) return;
    setDraft((d) =>
      "week" in target
        ? withTemplateCell(d, target.week, target.day, cell ?? null)
        : withOverride(d, target.date, cell),
    );
    setTarget(null);
  };

  const sheetTitle =
    target === null
      ? ""
      : "week" in target
        ? draft.cycleWeeks > 1
          ? t("plan.dayWeek", {
              day: dayNames[target.day],
              week: target.week + 1,
            })
          : dayNames[target.day]
        : localizedDate(target.date, {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
  const targetCurrent =
    target === null
      ? null
      : "week" in target
        ? draft.template[target.week]?.[target.day]
        : target.date in draft.overrides
          ? draft.overrides[target.date]
          : undefined;
  const templateCellForDate =
    target !== null && "date" in target
      ? planDay({ ...draft, overrides: {} }, target.date).cell
      : null;

  const store = async (next: Plan, message: string) => {
    setBusy(true);
    setError("");
    try {
      // "Also add as a goal": a lift goal for each chosen row, due when the phase ends.
      const made = new Set<string>();
      let progression = trimProgression(next);
      if (progression)
        for (const [index, item] of progression.entries()) {
          if (!goalFor.has(item.exerciseId) || goalTitleOf(item.goalId))
            continue;
          const id = crypto.randomUUID();
          const goal: Goal = {
            kind: "lift",
            targetKg: item.targetKg,
            exerciseId: item.exerciseId,
            exerciseName: item.name,
            reps: item.reps,
            byDate: next.endDate,
            createdAt: Date.now(),
          };
          await save(id, "goal", goal);
          made.add(id);
          progression = progression.map((p, i) =>
            i === index ? { ...p, goalId: id } : p,
          );
          // A retry after a failed plan save reuses the goal.
          setDraft((d) => ({
            ...d,
            progression: d.progression?.map((p) =>
              p.exerciseId === item.exerciseId ? { ...p, goalId: id } : p,
            ),
          }));
          setGoalFor((s) => {
            const copy = new Set(s);
            copy.delete(item.exerciseId);
            return copy;
          });
        }
      const goalIds = [
        ...next.goalIds.filter((id) => goals.some((g) => g.id === id)),
        ...made,
      ];
      const payload: Plan = {
        ...next,
        name: next.name.trim(),
        overrides: trimOverrides(next),
        goalIds,
      };
      if (progression) payload.progression = progression;
      await save(plan?.id ?? crypto.randomUUID(), "plan", payload);
      notify.success(message);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, t("plan.saveFailed")));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (busy || problem) return;
    return store(draft, t("plan.saved"));
  };
  // Pausing or resuming saves the plan at once, with the rest of the form.
  const paused = !!draft.paused;
  const togglePause = () => {
    if (busy || !draft.name.trim() || !validPeriod) return;
    const next = withPaused(draft, !paused);
    const blocking = paused ? findOverlap(plans, next, plan?.id) : null;
    if (blocking) {
      setError(overlapMessage(blocking));
      return;
    }
    return store(next, t(paused ? "plan.resumedToast" : "plan.pausedToast"));
  };

  return (
    <>
      <Sheet
        open={open}
        size="full"
        onClose={() => {
          if (!busy) onClose();
        }}
        title={plan ? t("plan.edit") : t("plan.new")}
        description={
          validPeriod
            ? t("plan.phaseSubtitle", {
                weeks: countLabel(weeks, "week"),
                from: localizedDate(draft.startDate, {
                  day: "numeric",
                  month: "short",
                }),
                to: localizedDate(draft.endDate, {
                  day: "numeric",
                  month: "short",
                }),
              })
            : undefined
        }
      >
        <label>
          {t("plan.name")}
          <input
            value={draft.name}
            maxLength={100}
            placeholder={t("plan.namePlaceholder")}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <Reveal>
          {paused && (
            <p className="plan-paused-note" role="status">
              {t("plan.pausedNote")}
            </p>
          )}
        </Reveal>
        {/* F1: the period is one row that opens the period picker. */}
        <div className="plan-field">
          <span className="group-title" id="period-label">
            {t("plan.periodLabel")}
          </span>
          <button
            type="button"
            className="plan-period-row"
            aria-labelledby="period-label period-value"
            aria-haspopup="dialog"
            onClick={() => {
              periodBase.current = draft;
              setPeriodOpen(true);
            }}
          >
            <span id="period-value">
              {validPeriod
                ? periodText(draft.startDate, draft.endDate)
                : t("plan.needPeriod")}
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          {follows && (
            <p className="row-sub plan-field-note">
              {t("plan.periodAfter", { plan: follows.name })}
            </p>
          )}
        </div>
        <Reveal>
          {problem && draft.name.trim() && (
            <p className="field-error" role="alert">
              {problem}
            </p>
          )}
        </Reveal>
        <PlanCycle plan={draft} onChange={setDraft} />
        <PlanTemplateGrid
          plan={draft}
          names={names}
          onPick={(week, day) => setTarget({ week, day })}
          onWeekKind={(week, kind) =>
            setDraft((d) => withWeekKind(d, week, kind))
          }
          onCopyWeekOne={() => setDraft(withWeekOneCopied)}
        />
        {/* F1: the whole period in the compact calendar's squares. */}
        {validPeriod && weeks <= MAX_PHASE_WEEKS && (
          <section className="plan-field" aria-labelledby="whole-period">
            <span className="group-title" id="whole-period">
              {t("plan.wholePeriod")}
            </span>
            <div className="card plan-period-card">
              <PlanPeriodCalendar
                start={draft.startDate}
                end={draft.endDate}
                label={t("plan.periodCalendar", {
                  name: draft.name.trim() || t("plan.new"),
                  period: periodSummary(draft, isWorkout),
                })}
                cell={(date) => {
                  const inside =
                    date >= draft.startDate && date <= draft.endDate;
                  return {
                    planned: inside && isWorkout(planDay(draft, date).cell),
                    deload: inside && !!phaseWeek(draft, date)?.deload,
                    today: date === today,
                  };
                }}
                labels={periodLabels(draft, today)}
                legend={["planned", "deload"]}
                rowGap={2}
              />
              <p className="row-sub plan-period-line">
                {periodSummary(draft, isWorkout)}
              </p>
            </div>
          </section>
        )}
        {/* P3: Planerad vecka (Task 3.7) */}
        {validPeriod && weeks <= MAX_PHASE_WEEKS && (
          <PlanProgression
            plan={draft}
            onChange={setDraft}
            goalFor={goalFor}
            onGoalFor={(exerciseId, on) =>
              setGoalFor((s) => {
                const copy = new Set(s);
                if (on) copy.add(exerciseId);
                else copy.delete(exerciseId);
                return copy;
              })
            }
            goalTitleOf={goalTitleOf}
          />
        )}
        {validPeriod && (
          <PlanUpcoming
            plan={draft}
            names={names}
            today={today}
            onPick={(date) => setTarget({ date })}
          />
        )}
        <PlanGoalLinks
          goals={goals}
          linkedIds={draft.goalIds}
          onChange={(goalIds) => set({ goalIds })}
          onNew={() => {
            setNewGoal((n) => n + 1);
            setGoalOpen(true);
          }}
        />
        {plan && (
          <button
            type="button"
            className="btn-secondary btn-block"
            disabled={busy || !draft.name.trim() || !validPeriod}
            onClick={() => void togglePause()}
          >
            {paused ? (
              <Play size={18} aria-hidden="true" />
            ) : (
              <Pause size={18} aria-hidden="true" />
            )}
            {paused ? t("plan.resume") : t("plan.pause")}
          </button>
        )}
        {plan && (
          <button
            type="button"
            className="btn-danger btn-block"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            {t("plan.delete")}
          </button>
        )}
        {/* Last, so it can stick to the bottom edge of the long form. */}
        <div className="sheet-footer">
          <Reveal>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </Reveal>
          <button
            type="button"
            className="btn-primary btn-block"
            disabled={busy || !!problem}
            onClick={() => void submit()}
          >
            {busy ? t("common.saving") : t("plan.save")}
          </button>
        </div>
      </Sheet>
      <Sheet
        open={periodOpen}
        size="full"
        onClose={() => setPeriodOpen(false)}
        title={t("plan.periodLabel")}
        description={
          validPeriod ? periodText(draft.startDate, draft.endDate) : undefined
        }
      >
        <PlanPeriodPicker
          startDate={draft.startDate}
          endDate={draft.endDate}
          today={today}
          onChange={(change) =>
            setDraft((d) =>
              followLength(periodBase.current ?? d, {
                ...d,
                ...change,
              }),
            )
          }
        />
        <div className="sheet-footer">
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={() => setPeriodOpen(false)}
          >
            {t("common.done")}
          </button>
        </div>
      </Sheet>
      <CellSheet
        open={target !== null}
        title={sheetTitle}
        current={targetCurrent}
        routines={routines}
        groups={groups}
        emptyLabel={
          target && "date" in target
            ? t("plan.nothingPlannedCap")
            : t("plan.emptyCap")
        }
        useTemplate={
          target && "date" in target
            ? cellText(templateCellForDate, names)
            : undefined
        }
        onChoose={choose}
        onClose={() => setTarget(null)}
      />
      {newGoal > 0 && (
        <GoalEditor
          key={newGoal}
          open={goalOpen}
          goal={null}
          defaultByDate={validPeriod ? draft.endDate : undefined}
          onSaved={(id) =>
            setDraft((d) =>
              d.goalIds.includes(id)
                ? d
                : { ...d, goalIds: [...d.goalIds, id] },
            )
          }
          onClose={() => setGoalOpen(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title={t("plan.deleteTitle", { name: plan?.name ?? "" })}
        description={t("plan.deleteText")}
        cancelLabel={t("plan.keep")}
        confirmLabel={busy ? t("history.deleting") : t("plan.delete")}
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          if (!plan) return;
          setBusy(true);
          try {
            const index = plans.findIndex((p) => p.id === plan.id);
            const { id, ...saved } = plan;
            await deleteRecord(id);
            offerUndo({
              scope: PLANS_SCOPE,
              index,
              text: t("plan.deletedToast", { name: plan.name }),
              undo: () => save(id, "plan", saved),
              failed: t("plan.restoreFailed"),
            });
            onClose();
          } catch {
            notify.error(t("plan.deleteFailed"));
          } finally {
            setBusy(false);
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
