import { doneSetCount } from "../data/selectors";
import type { Kind, Payload, Workout } from "../data/model";
import { localizedDate } from "./dates";
import { countLabel } from "./labels";

const KIND_NAMES: Record<Kind, string> = {
  workout: "Workout",
  routine: "Routine",
  exercise: "Exercise",
  plan: "Plan",
  goal: "Goal",
  library: "Exercise settings",
};

/** What a record is, for lists of sync problems: "Workout", "Routine". */
export const kindName = (kind: Kind) => KIND_NAMES[kind] ?? "Record";

/**
 * One version of a record in a line, so a sync conflict is not a blind choice:
 * "Deleted", "12 Oct · 5 sets", "4 exercises".
 */
export function versionSummary(kind: Kind, payload: Payload, deleted: boolean) {
  if (deleted) return "Deleted";
  // A server version can come from a newer app; never fail on its shape.
  try {
    return summary(kind, payload);
  } catch {
    return "Changed";
  }
}

function summary(kind: Kind, payload: Payload) {
  if (kind === "workout") {
    const w = payload as Workout;
    return [
      localizedDate(w.date),
      w.status === "draft" ? "not finished" : null,
      countLabel(doneSetCount(w), "set"),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (kind === "routine") {
    const exercises = (payload as { exercises?: unknown[] }).exercises;
    return countLabel(exercises?.length ?? 0, "exercise");
  }
  return "Changed";
}
