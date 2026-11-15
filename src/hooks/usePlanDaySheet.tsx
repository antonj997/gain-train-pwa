import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/contexts/useData";
import type { Plan, RoutineRecord } from "@/data/model";
import {
  activePlans,
  groupsOf,
  plannedFor,
  resolveCell,
  type PlannedDay,
  type PlanItem,
} from "@/data/plans";
import {
  canMoveTo,
  isWorkoutCell,
  moveDay,
  restoreDay,
  skipDay,
  snapshotDay,
} from "@/data/plan-moves";
import { phaseWeek } from "@/data/phase";
import { routines as routineRecords } from "@/data/selectors";
import { categoryLabel } from "@/lib/catalogue-labels";
import { localizedDate, shiftDate } from "@/lib/dates";
import { notify, offerUndo } from "@/lib/message-store";
import { routineAverageMinutes, routineMeta } from "@/lib/routine-preview";
import DaySheet from "@/components/home/DaySheet";
import { useT } from "@/i18n/useT";

const short = (date: string) =>
  localizedDate(date, { weekday: "short", day: "numeric" });

const planOf = ({ id: _id, ...plan }: PlanItem): Plan => plan;

export type PlanMove = {
  from: string;
  to: string;
  /** The day it went to held another workout, so the two traded days. */
  swapped: boolean;
  /** "Push day moved to Fri 13" or "Push day and Legs day swapped". */
  text: string;
  /** Where a drag let go, for the week strip's ring. */
  start?: { x: number };
};

/**
 * Moving and skipping planned days, and the day sheet that does it: Train's
 * week strip and the Calendar tab (its month view and the plan card's coming
 * workouts) share it, so a change is saved the same way from either. Every
 * change is a dated override on the plan (src/data/plan-moves.ts). Changes
 * are saved one after another; until a save lands, the next change builds on
 * what the last one made, so quick steps in the sheet add up. A skip leaves
 * an Undo in `undoScope`, which the caller shows.
 */
export function usePlanDaySheet({
  day,
  undoScope,
  onMoved,
  onSkipped,
}: {
  /** Today. */
  day: string;
  undoScope: string;
  /** After a move is saved (it may still be on its way). */
  onMoved?: (move: PlanMove) => void;
  /** After a skip, with its Undo offered. */
  onSkipped?: (date: string) => void;
}) {
  const { state, save } = useData();
  const { t } = useT();
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const names = useMemo(
    () => ({ routines, groups: groupsOf(state.records) }),
    [routines, state.records],
  );
  const callbacks = useRef({ onMoved, onSkipped });
  callbacks.current = { onMoved, onSkipped };

  const pending = useRef(new Map<string, Plan>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const livePlans = useCallback(
    (): PlanItem[] =>
      plans.map((p) => {
        const next = pending.current.get(p.id);
        return next ? { ...next, id: p.id } : p;
      }),
    [plans],
  );
  const commit = (id: string, next: Plan) => {
    pending.current.set(id, next);
    const run = queue.current.then(() => save(id, "plan", next));
    queue.current = run.catch(() => {});
    return run
      .catch((cause) => {
        notify.error(t("week.changeFailed"));
        throw cause;
      })
      .finally(() => {
        if (pending.current.get(id) === next) pending.current.delete(id);
      });
  };

  const titleOf = (cell: string | null | undefined) =>
    resolveCell(cell, names)?.title ?? "";
  const [sheet, setSheet] = useState<{ date: string; dir: -1 | 0 | 1 } | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const move = (from: string, to: string, start?: { x: number }) => {
    const live = livePlans();
    if (!canMoveTo(live, from, to, day)) return false;
    const source = plannedFor(live, from)!;
    const target = plannedFor(live, to)!;
    const swapped = isWorkoutCell(target.cell);
    const next = moveDay(planOf(source.plan), from, to);
    void commit(source.plan.id, next).catch(() => {});
    const text = swapped
      ? t("week.swapped", {
          a: titleOf(source.cell),
          b: titleOf(target.cell),
        })
      : t("week.moved", { name: titleOf(source.cell), day: short(to) });
    callbacks.current.onMoved?.({ from, to, swapped, text, start });
    setSheet((s) =>
      s && s.date === from ? { date: to, dir: to > from ? 1 : -1 } : s,
    );
    return true;
  };

  const skip = (date: string) => {
    const found = plannedFor(livePlans(), date);
    if (!found || !isWorkoutCell(found.cell)) return;
    const id = found.plan.id;
    const before = snapshotDay(planOf(found.plan), date);
    const name = titleOf(found.cell);
    void commit(id, skipDay(planOf(found.plan), date)).catch(() => {});
    offerUndo({
      scope: undoScope,
      index: 0,
      text: t("week.skipped", { name, day: short(date) }),
      undo: () => {
        const current = livePlans().find((p) => p.id === id);
        if (!current) return Promise.resolve();
        return commit(id, restoreDay(planOf(current), before));
      },
      failed: t("week.restoreFailed"),
    });
    setSheetOpen(false);
    callbacks.current.onSkipped?.(date);
  };

  const open = (date: string) => {
    setSheet({ date, dir: 0 });
    setSheetOpen(true);
  };
  const close = () => setSheetOpen(false);

  // ---- The day sheet.
  const sheetDate = sheet?.date ?? day;
  const sheetFound = plannedFor(plans, sheetDate);
  const sheetEntry = resolveCell(sheetFound?.cell, names);
  // A day that stops being a workout (another device, or it was skipped) closes the sheet.
  useEffect(() => {
    if (sheetOpen && !isWorkoutCell(plannedFor(livePlans(), sheetDate)?.cell))
      setSheetOpen(false);
  }, [sheetOpen, sheetDate, livePlans]);
  const metaOf = (entry: PlannedDay | null) =>
    plannedDayMeta(entry, routines, state.records, t);
  const sheetRoutine = routineOf(sheetEntry, routines);
  const sheetPhase = sheetFound ? phaseWeek(sheetFound.plan, sheetDate) : null;
  const live = sheet ? livePlans() : plans;
  const canEarlier =
    !!sheet && canMoveTo(live, sheetDate, shiftDate(sheetDate, -1), day);
  const canLater =
    !!sheet && canMoveTo(live, sheetDate, shiftDate(sheetDate, 1), day);

  const sheetNode = sheet && (
    <DaySheet
      open={sheetOpen && !!sheetEntry}
      date={sheetDate}
      today={day}
      entry={sheetEntry}
      routine={sheetRoutine}
      phase={
        sheetPhase
          ? t("plan.weekOf", {
              week: sheetPhase.week,
              weeks: sheetPhase.weeks,
            })
          : null
      }
      meta={metaOf(sheetEntry)}
      direction={sheet.dir}
      canEarlier={canEarlier}
      canLater={canLater}
      busy={false}
      onStep={(dir) => move(sheetDate, shiftDate(sheetDate, dir))}
      onDoToday={() => move(sheetDate, day)}
      onSkip={() => skip(sheetDate)}
      onClose={close}
    />
  );

  return {
    plans,
    routines,
    names,
    livePlans,
    titleOf,
    move,
    skip,
    open,
    close,
    /** The day the sheet is about, while it is open. */
    openDate: sheetOpen ? (sheet?.date ?? null) : null,
    sheetOpen,
    metaOf,
    sheetNode,
  };
}

/** The routine a planned day starts with its badge: the routine of a routine day. */
export const routineOf = (
  entry: PlannedDay | null,
  routines: readonly RoutineRecord[],
) =>
  entry?.kind === "routine"
    ? (routines.find((r) => r.id === entry.routineIds[0]) ?? null)
    : null;

/**
 * A planned day's line: a routine's exercises and length, a group's routines,
 * a day type's categories.
 */
export function plannedDayMeta(
  entry: PlannedDay | null,
  routines: readonly RoutineRecord[],
  records: Parameters<typeof routineAverageMinutes>[1],
  t: ReturnType<typeof useT>["t"],
) {
  const routine = routineOf(entry, routines);
  if (routine)
    return routineMeta(
      routine.payload.exercises.length,
      routineAverageMinutes(routine.id, records),
    );
  if (entry?.kind === "group")
    return entry.routineIds
      .map((id) => routines.find((r) => r.id === id)?.payload.name)
      .filter(Boolean)
      .join(" · ");
  if (entry)
    return t("home.typeText", {
      categories: entry.categories.map(categoryLabel).join(", "),
    });
  return "";
}
