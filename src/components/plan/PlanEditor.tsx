import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import ConfirmDialog from "@/components/ConfirmDialog";
import CellSheet from "@/components/plan/CellSheet";
import PlanCalendar, { type PlanDay } from "@/components/PlanCalendar";
import ListRow from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { goalTitle, activeGoals } from "@/data/goals";
import { type Plan, today as todayDate } from "@/data/model";
import {
  type PlanItem,
  activePlans,
  cellText,
  findOverlap,
  groupsOf,
  plannedFor,
  resolveCell,
  REST,
} from "@/data/plans";
import { routines as routineRecords } from "@/data/selectors";
import { localizedDate, shiftDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

const weekdayLetters = ["M", "T", "W", "T", "F", "S", "S"];
const weekdayNames = Array.from({ length: 7 }, (_, i) =>
  new Date(Date.UTC(2024, 0, i + 1)).toLocaleDateString(undefined, {
    weekday: "long",
    timeZone: "UTC",
  }),
);
const cycleOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));

/** The cell being chosen: a template day, or one dated override. */
type Target = { week: number; day: number } | { date: string };

const emptyWeek = (): (string | null)[] => Array(7).fill(null);
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

  const [draft, setDraft] = useState<Plan>(() => {
    if (plan) {
      // The id names the record; it is not part of the saved plan.
      const { id: _id, ...saved } = plan;
      return saved;
    }
    // A new plan starts after the last plan ends, or today.
    const lastEnd = plans.reduce(
      (end, p) => (p.endDate > end ? p.endDate : end),
      "",
    );
    const startDate = lastEnd >= today ? shiftDate(lastEnd, 1) : today;
    return {
      name: "",
      startDate,
      endDate: shiftDate(startDate, 8 * 7 - 1),
      cycleWeeks: 1,
      template: [emptyWeek()],
      overrides: {},
      goalIds: [],
    };
  });
  const [target, setTarget] = useState<Target | null>(null);
  // Which day of the period the calendar asks for next.
  const [step, setStep] = useState<"start" | "end">("start");
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
    ? "Give the plan a name."
    : !validPeriod
      ? "Choose a start date and an end date on or after it."
      : overlap
        ? `This period overlaps “${overlap.name}” (${range(overlap.startDate)} – ${range(overlap.endDate)}). Only one plan can be active on a date; change these dates or edit that plan.`
        : "";

  const pickDay = (date: string) => {
    if (step === "start" || !draft.startDate || date < draft.startDate) {
      set({ startDate: date, endDate: "" });
      setStep("end");
    } else {
      set({ endDate: date });
      setStep("start");
    }
  };
  const pickRange = draft.startDate
    ? {
        start: draft.startDate,
        end: draft.endDate >= draft.startDate ? draft.endDate : draft.startDate,
      }
    : null;

  const changeCycle = (weeks: number) => {
    const template = Array.from(
      { length: weeks },
      (_, i) => draft.template[i] ?? emptyWeek(),
    );
    set({ cycleWeeks: weeks, template });
  };

  const choose = (cell: string | null | undefined) => {
    if (!target) return;
    if ("week" in target) {
      set({
        template: draft.template.map((row, w) =>
          w === target.week
            ? row.map((c, d) => (d === target.day ? (cell ?? null) : c))
            : row,
        ),
      });
    } else {
      const overrides = { ...draft.overrides };
      if (cell === undefined) delete overrides[target.date];
      else overrides[target.date] = cell;
      set({ overrides });
    }
    setTarget(null);
  };

  const describe = (date: string): PlanDay => {
    const planned = plannedFor([draft], date);
    const day = resolveCell(planned?.cell, names);
    return {
      kind: day ? (day.kind === "rest" ? "rest" : "planned") : null,
      label: day ? day.title : "nothing planned",
      override: !!planned?.override,
    };
  };

  const sheetTitle =
    target === null
      ? ""
      : "week" in target
        ? `${weekdayNames[target.day]}${draft.cycleWeeks > 1 ? `, week ${target.week + 1}` : ""}`
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
      const overrides = Object.fromEntries(
        Object.entries(draft.overrides).filter(
          ([date]) => date >= draft.startDate && date <= draft.endDate,
        ),
      );
      await save(plan?.id ?? crypto.randomUUID(), "plan", {
        ...draft,
        name: draft.name.trim(),
        overrides,
        goalIds: draft.goalIds.filter((id) => goals.some((g) => g.id === id)),
      });
      toast.success("Plan saved");
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Could not save the plan. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const first = draft.startDate > today ? draft.startDate : today;

  return (
    <>
      <Sheet
        open={open}
        size="full"
        onClose={() => {
          if (!busy) onClose();
        }}
        title={plan ? "Edit plan" : "New plan"}
        description="Nothing here is required. Train shows today's entry while the plan is active."
      >
        <label>
          Name
          <input
            value={draft.name}
            maxLength={100}
            placeholder="Autumn block"
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <div className="field-row">
          <label>
            From
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </label>
        </div>
        <section aria-labelledby="period-heading">
          <div className="section-head">
            <h3 className="group-title" id="period-heading">
              {step === "start" ? "Tap the first day" : "Now tap the last day"}
            </h3>
            <button
              type="button"
              className="btn-quiet btn-sm"
              onClick={() => {
                set({ startDate: "", endDate: "" });
                setStep("start");
              }}
            >
              <X size={16} aria-hidden="true" />
              Clear
            </button>
          </div>
          <PlanCalendar
            today={today}
            first={shiftDate(
              draft.startDate && draft.startDate < today
                ? draft.startDate
                : today,
              -366,
            )}
            last={shiftDate(today, 5 * 366)}
            range={pickRange}
            label="Plan period"
            initialMonth={(draft.startDate || today).slice(0, 7)}
            onPick={pickDay}
          />
        </section>
        {problem && draft.name.trim() && (
          <p className="field-error" role="alert">
            {problem}
          </p>
        )}
        <div className="plan-field">
          <span className="group-title">Repeats every (weeks)</span>
          <Segmented
            label="Weeks in the cycle"
            value={String(draft.cycleWeeks)}
            options={cycleOptions}
            onChange={(value) => changeCycle(Number(value))}
          />
        </div>
        <section aria-labelledby="template-heading">
          <h3 className="group-title" id="template-heading">
            {draft.cycleWeeks > 1 ? "Your weeks" : "Your week"}
          </h3>
          <div className="plan-grid">
            <div className="plan-grid-days" aria-hidden="true">
              {weekdayLetters.map((letter, i) => (
                <span key={i}>{letter}</span>
              ))}
            </div>
            {draft.template.map((row, week) => (
              <div key={week} className="plan-grid-week">
                {draft.cycleWeeks > 1 && (
                  <span className="row-sub">Week {week + 1}</span>
                )}
                <div className="plan-grid-row">
                  {row.map((cell, day) => {
                    const text = cellText(cell, names);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={
                          "plan-cell" +
                          (cell === REST ? " is-rest" : cell ? " is-set" : "")
                        }
                        aria-label={`${weekdayNames[day]}${draft.cycleWeeks > 1 ? `, week ${week + 1}` : ""}: ${text || "empty"}`}
                        onClick={() => setTarget({ week, day })}
                      >
                        <span>{text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="row-sub group-note">
            Tap a day to choose a routine, a group, a day type or rest. The
            weeks repeat from the first week of the period.
          </p>
        </section>
        {validPeriod && first <= draft.endDate && (
          <section aria-labelledby="upcoming-heading">
            <h3 className="group-title" id="upcoming-heading">
              Upcoming
            </h3>
            <PlanCalendar
              today={today}
              first={first}
              last={draft.endDate}
              describe={describe}
              onPick={(date) => setTarget({ date })}
            />
            <p className="row-sub group-note">
              Tap a day to change just that date. Past days cannot be changed.
            </p>
          </section>
        )}
        {goals.length > 0 && (
          <section aria-labelledby="plan-goals-heading">
            <h3 className="group-title" id="plan-goals-heading">
              Goals this plan works toward
            </h3>
            <div className="list">
              {goals.map((g) => {
                const linked = draft.goalIds.includes(g.id);
                return (
                  <ListRow
                    key={g.id}
                    title={goalTitle(g)}
                    sub={`By ${range(g.byDate)}`}
                    onClick={() =>
                      set({
                        goalIds: linked
                          ? draft.goalIds.filter((id) => id !== g.id)
                          : [...draft.goalIds, g.id],
                      })
                    }
                    trailing={
                      linked ? (
                        <Check
                          size={20}
                          className="plan-check"
                          aria-label="Linked"
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </section>
        )}
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
          {busy ? "Saving…" : "Save plan"}
        </button>
        {plan && (
          <button
            type="button"
            className="btn-danger btn-block"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            Delete plan
          </button>
        )}
      </Sheet>
      <CellSheet
        open={target !== null}
        title={sheetTitle}
        current={targetCurrent}
        routines={routines}
        groups={groups}
        emptyLabel={target && "date" in target ? "Nothing planned" : "Empty"}
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
        title={<>Delete {plan?.name}?</>}
        description="The plan and its dated changes are removed. Your routines and workouts stay."
        cancelLabel="Keep plan"
        confirmLabel={busy ? "Deleting…" : "Delete plan"}
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          if (!plan) return;
          setBusy(true);
          try {
            await deleteRecord(plan.id);
            toast("Plan deleted");
            onClose();
          } catch {
            toast.error("Could not delete. The plan is still here; retry.");
          } finally {
            setBusy(false);
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
