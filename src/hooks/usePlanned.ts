import { useMemo } from "react";
import { useData } from "@/contexts/useData";
import { routines as routineRecords } from "@/data/selectors";
import {
  activePlans,
  groupsOf,
  plannedFor,
  resolveCell,
  type PlannedDay,
} from "@/data/plans";

/**
 * What the active plans hold for a date: a routine, group, day type or rest,
 * or null. A deleted routine or group is ignored, as if nothing were planned.
 */
export function usePlanned(): (date: string) => PlannedDay | null {
  const { state } = useData();
  return useMemo(() => {
    const plans = activePlans(state.records);
    const names = {
      routines: routineRecords(state.records),
      groups: groupsOf(state.records),
    };
    return (date: string) =>
      plans.length ? resolveCell(plannedFor(plans, date)?.cell, names) : null;
  }, [state.records]);
}
