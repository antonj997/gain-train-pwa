import { doneSetCount } from "../data/selectors";
import type { Kind, Payload, Workout } from "../data/model";
import { localizedDate } from "./dates";
import { countLabel } from "./labels";
import { t, type MessageKey } from "../i18n";

const KIND_NAMES: Record<Kind, MessageKey> = {
  workout: "kind.workout",
  routine: "kind.routine",
  exercise: "kind.exercise",
  plan: "kind.plan",
  goal: "kind.goal",
  library: "kind.library",
};

/** What a record is, for lists of sync problems: "Workout", "Routine". */
export const kindName = (kind: Kind) =>
  KIND_NAMES[kind] ? t(KIND_NAMES[kind]) : t("kind.record");

/**
 * One version of a record in a line, so a sync conflict is not a blind choice:
 * "Deleted", "12 Oct · 5 sets", "4 exercises".
 */
export function versionSummary(kind: Kind, payload: Payload, deleted: boolean) {
  if (deleted) return t("summary.deleted");
  // A server version can come from a newer app; never fail on its shape.
  try {
    return summary(kind, payload);
  } catch {
    return t("summary.changed");
  }
}

function summary(kind: Kind, payload: Payload) {
  if (kind === "workout") {
    const w = payload as Workout;
    return [
      localizedDate(w.date),
      w.status === "draft" ? t("summary.notFinished") : null,
      countLabel(doneSetCount(w), "set"),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (kind === "routine") {
    const exercises = (payload as { exercises?: unknown[] }).exercises;
    return countLabel(exercises?.length ?? 0, "exercise");
  }
  return t("summary.changed");
}
