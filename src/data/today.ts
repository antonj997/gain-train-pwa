import type { PlannedDay } from "./plans";

/**
 * What Train's Idag card offers. Pure, so it is tested.
 *
 * - "planned": the active plan has a routine, a day type or a group today.
 *   `routineId` is what Start begins: the routine itself, or for a group the
 *   one of its routines done least recently; null for a day type, or a group
 *   with no routines left, which start with suggestions from its categories.
 * - "suggested": nothing is planned (no plan, an empty day, a rest day or a
 *   deleted routine), so Start begins the routine done least recently (see
 *   `leastRecent`). `rest` says the plan has a rest day today.
 * - "none": nothing planned and no routines to suggest.
 */
export type TodayPick =
  | { kind: "planned"; day: PlannedDay; routineId: string | null }
  | {
      kind: "suggested";
      routineId: string;
      /** "rotation": the least recently done; "first": nothing done yet, the first routine. */
      reason: "rotation" | "first";
      rest: boolean;
    }
  | { kind: "none"; rest: boolean };

/**
 * The suggestion rule: among the routines you have done, the one done least
 * recently, which is the next one when you rotate through them (ties keep the
 * saved order). Routines never done are left out, so an old unused routine
 * does not stick to the top; when none has been done yet, the first routine
 * in the saved order. Null without routines.
 *
 * `lastDone` maps a routine id to the date (YYYY-MM-DD) of its newest
 * finished workout.
 */
export function leastRecent(
  routineIds: readonly string[],
  lastDone: ReadonlyMap<string, string>,
): { routineId: string; reason: "rotation" | "first" } | null {
  let best: { id: string; date: string } | null = null;
  for (const id of routineIds) {
    const date = lastDone.get(id);
    if (date && (!best || date < best.date)) best = { id, date };
  }
  if (best) return { routineId: best.id, reason: "rotation" };
  return routineIds.length
    ? { routineId: routineIds[0], reason: "first" }
    : null;
}

/** Today's card from the plan's day (or null) and the routines in saved order. */
export function todayPick(
  planned: PlannedDay | null,
  routineIds: readonly string[],
  lastDone: ReadonlyMap<string, string>,
): TodayPick {
  if (planned && planned.kind !== "rest") {
    if (planned.kind === "routine")
      return {
        kind: "planned",
        day: planned,
        routineId: planned.routineIds[0],
      };
    if (planned.kind === "group")
      return {
        kind: "planned",
        day: planned,
        routineId: leastRecent(planned.routineIds, lastDone)?.routineId ?? null,
      };
    return { kind: "planned", day: planned, routineId: null };
  }
  const rest = planned?.kind === "rest";
  const pick = leastRecent(routineIds, lastDone);
  return pick ? { kind: "suggested", ...pick, rest } : { kind: "none", rest };
}

/** The newest finished workout's date per routine. */
export function lastDoneByRoutine(
  completed: readonly {
    payload: { routineId?: string | null; date: string };
  }[],
) {
  const dates = new Map<string, string>();
  for (const { payload } of completed) {
    const id = payload.routineId;
    if (id && payload.date > (dates.get(id) ?? "")) dates.set(id, payload.date);
  }
  return dates;
}
