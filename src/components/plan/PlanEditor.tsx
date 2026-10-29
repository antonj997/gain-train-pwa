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

const dayNames = weekdayNames();
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
    ? "Give the plan a name."
    : !validPeriod
      ? "Choose a start date and an end date on or after it."
      : overlap
        ? `This period overlaps “${overlap.name}” (${range(overlap.startDate)} – ${range(overlap.endDate)}). Only one plan can be active on a date; change these dates or edit that plan.`
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
        ? `${dayNames[target.day]}${draft.cycleWeeks > 1 ? `, week ${target.week + 1}` : ""}`
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
      toast.success("Plan saved");
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Could not save the plan. Try again."));
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
          <span className="group-title">Repeats every (weeks)</span>
          <Segmented
            label="Weeks in the cycle"
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
            Delete plan
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
            {busy ? "Saving…" : "Save plan"}
          </button>
        </div>
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
