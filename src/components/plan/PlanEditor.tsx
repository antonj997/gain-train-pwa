import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import ConfirmDialog from "@/components/ConfirmDialog";
import CellSheet from "@/components/plan/CellSheet";
import PlanGoalLinks from "@/components/plan/PlanGoalLinks";
import PlanPeriodPicker from "@/components/plan/PlanPeriodPicker";
import PlanTemplateGrid from "@/components/plan/PlanTemplateGrid";
import PlanUpcoming from "@/components/plan/PlanUpcoming";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { activeGoals } from "@/data/goals";
import { type Plan, today as todayDate } from "@/data/model";
import {
  type PlanItem,
  activePlans,
  cellText,
  defaultNewPlan,
  findOverlap,
  groupsOf,
  plannedFor,
  trimOverrides,
  withCycle,
  withOverride,
  withTemplateCell,
} from "@/data/plans";
import { routines as routineRecords } from "@/data/selectors";
import { localizedDate, weekdayNames } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";

const cycleOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));

/** The cell being chosen: a template day, or one dated override. */
type Target = { week: number; day: number } | { date: string };

const range = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short", year: "numeric" });

/** Creates or edits one plan in a full sheet. `plan` is null for a new one. */
export default function PlanEditor({
  open,
  plan,
  onClose,
}: {
  open: boolean;
  plan: PlanItem | null;
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
    if (!plan) return defaultNewPlan(plans, today);
    // The id names the record; it is not part of the saved plan.
    const { id: _id, ...saved } = plan;
    return saved;
  });
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const set = (change: Partial<Plan>) => setDraft((d) => ({ ...d, ...change }));

  const validPeriod =
    /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.endDate) &&
    draft.startDate <= draft.endDate;
  const overlap = validPeriod ? findOverlap(plans, draft, plan?.id) : null;
  const problem = !draft.name.trim()
    ? t("plan.needName")
    : !validPeriod
      ? t("plan.needPeriod")
      : overlap
        ? t("plan.overlap", {
            name: overlap.name,
            from: range(overlap.startDate),
            to: range(overlap.endDate),
          })
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
      ? plannedFor([{ ...draft, overrides: {} }], target.date)?.cell
      : null;

  const submit = async () => {
    if (busy || problem) return;
    setBusy(true);
    setError("");
    try {
      await save(plan?.id ?? crypto.randomUUID(), "plan", {
        ...draft,
        name: draft.name.trim(),
        overrides: trimOverrides(draft),
        goalIds: draft.goalIds.filter((id) => goals.some((g) => g.id === id)),
      });
      toast.success(t("plan.saved"));
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, t("plan.saveFailed")));
    } finally {
      setBusy(false);
    }
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
        description={t("plan.description")}
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
        <PlanPeriodPicker
          startDate={draft.startDate}
          endDate={draft.endDate}
          today={today}
          onChange={set}
        />
        {problem && draft.name.trim() && (
          <p className="field-error" role="alert">
            {problem}
          </p>
        )}
        <div className="plan-field">
          <span className="group-title">{t("plan.repeatsEvery")}</span>
          <Segmented
            label={t("plan.weeksInCycle")}
            value={String(draft.cycleWeeks)}
            options={cycleOptions}
            onChange={(value) => setDraft((d) => withCycle(d, Number(value)))}
          />
        </div>
        <PlanTemplateGrid
          plan={draft}
          names={names}
          onPick={(week, day) => setTarget({ week, day })}
        />
        {validPeriod && (
          <PlanUpcoming
            plan={draft}
            names={names}
            today={today}
            onPick={(date) => setTarget({ date })}
          />
        )}
        {goals.length > 0 && (
          <PlanGoalLinks
            goals={goals}
            linkedIds={draft.goalIds}
            onChange={(goalIds) => set({ goalIds })}
          />
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
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
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
            await deleteRecord(plan.id);
            toast(t("plan.deletedToast"));
            onClose();
          } catch {
            toast.error(t("plan.deleteFailed"));
          } finally {
            setBusy(false);
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
