import { useMemo } from "react";
import { useData } from "@/contexts/useData";
import type { WorkoutRecord } from "@/data/model";
import {
  activePlans,
  groupsOf,
  planDay,
  plannedFor,
  resolveCell,
  type PlannedDay,
} from "@/data/plans";
import { nextPlannedDays } from "@/data/plan-status";
import { categoriesLookup } from "@/data/muscle-sets";
import { routines as routineRecords } from "@/data/selectors";
import {
  COUNT_AS_DAYS,
  todayStatus,
  type UpcomingDay,
} from "@/data/today-status";

/**
 * The Today card's state for `day` (src/data/today-status.ts) from the data:
 * today's finished workouts, the plan running today, today's cell and the
 * planned workouts of the coming week. A deleted routine or group counts as
 * nothing planned, as on the rest of Train.
 */
export function useTodayStatus(completed: WorkoutRecord[], day: string) {
  const { state } = useData();
  return useMemo(() => {
    const names = {
      routines: routineRecords(state.records),
      groups: groupsOf(state.records),
    };
    const isWorkout = (cell: string | null | undefined) => {
      const entry = resolveCell(cell, names);
      return !!entry && entry.kind !== "rest";
    };
    const found = plannedFor(activePlans(state.records), day);
    const plan = found?.plan ?? null;
    const planned = found ? resolveCell(found.cell, names) : null;
    // Enough days for a week of planned workouts, one a day at most.
    const upcoming: UpcomingDay[] = plan
      ? nextPlannedDays(plan, day, true, COUNT_AS_DAYS, isWorkout).map(
          (date) => ({
            date,
            day: resolveCell(planDay(plan, date).cell, names) as PlannedDay,
          }),
        )
      : [];
    const status = todayStatus({
      today: day,
      completed,
      plan,
      planned,
      upcoming,
      categoriesOf: categoriesLookup(state.records),
    });
    return { status, plan, isWorkout, upcoming };
  }, [state.records, completed, day]);
}
