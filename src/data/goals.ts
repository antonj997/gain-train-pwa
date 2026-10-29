import { validSet, type Goal, type RecordDoc, type WorkoutSet } from "./model";
import { estimate } from "./analytics";
import { isDrop } from "./drops";
import { completedWorkouts } from "./selectors";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, isoDate } from "../lib/dates";

export type GoalItem = Goal & { id: string };

/** The user's goals that are not deleted, soonest deadline first. */
export function activeGoals(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): GoalItem[] {
  const all = Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);
  return all
    .flatMap((r) =>
      r.kind === "goal" && !r.deleted ? [{ ...r.payload, id: r.id }] : [],
    )
    .sort(
      (a, b) => a.byDate.localeCompare(b.byDate) || a.createdAt - b.createdAt,
    );
}

export type GoalProgress = {
  /** What the goal is measured in: kilograms, or estimated one-rep max kilograms. */
  unit: "kg" | "kg e1RM";
  /** Where the bar starts, where the user is now (null with no data) and the target. */
  start: number;
  current: number | null;
  target: number;
  /** 0 to 1. */
  fraction: number;
  met: boolean;
  /** The day the goal was reached; null until then. */
  reachedOn: string | null;
  /** Whole days until `byDate`; negative once it has passed. */
  daysLeft: number;
};

/** Heaviest or best-estimated checked working sets of an exercise, with their dates. */
function liftSamples(
  goal: Goal,
  records: readonly RecordDoc[],
  mode: "weight" | "e1rm",
) {
  const samples: { date: string; value: number }[] = [];
  for (const record of completedWorkouts(records as RecordDoc[])) {
    for (const exercise of record.payload.exercises) {
      if (exercise.exerciseId !== goal.exerciseId) continue;
      for (const set of exercise.sets) {
        if (!countsForLift(set)) continue;
        const value = mode === "e1rm" ? estimate(set) : set.weight;
        if (value !== null && value > 0)
          samples.push({ date: record.payload.date, value });
      }
    }
  }
  return samples.sort((a, b) => a.date.localeCompare(b.date));
}

const countsForLift = (set: WorkoutSet) =>
  set.done &&
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  set.measure !== "seconds" &&
  set.load === "weight" &&
  validSet(set);

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How far a goal has come. A bodyweight goal compares the profile's weight with
 * the weight saved when the goal was set. A lift goal compares the best checked
 * working set of the exercise: for one rep the heaviest weight, otherwise the
 * estimated one-rep max against the target's. The bar runs from the best before
 * the goal was made (zero if none) to the target.
 */
export function goalProgress(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
): GoalProgress {
  const daysLeft = daysBetween(today, goal.byDate);
  if (goal.kind === "bodyweight") {
    const current = profile.bodyWeightKg;
    const start = goal.startKg ?? current ?? goal.targetKg;
    const losing = start > goal.targetKg;
    const reached =
      current !== null &&
      (losing ? current <= goal.targetKg : current >= goal.targetKg);
    const met = !!goal.reachedOn || reached;
    return {
      unit: "kg",
      start,
      current,
      target: goal.targetKg,
      fraction: met
        ? 1
        : current === null || start === goal.targetKg
          ? 0
          : clamp((current - start) / (goal.targetKg - start)),
      met,
      reachedOn: goal.reachedOn ?? (reached ? today : null),
      daysLeft,
    };
  }

  const reps = goal.reps ?? 1;
  const mode = goal.estimated || reps > 1 ? "e1rm" : "weight";
  const target =
    mode === "weight" || goal.estimated
      ? goal.targetKg
      : goal.targetKg * (1 + reps / 30);
  const samples = liftSamples(goal, records, mode);
  const created = isoDate(new Date(goal.createdAt));
  const best = (list: typeof samples) =>
    list.reduce((top, s) => Math.max(top, s.value), 0);
  const start = best(samples.filter((s) => s.date <= created));
  const current = samples.length ? best(samples) : null;
  const first = samples.find((s) => s.value >= target && s.date >= created);
  const reachedOn =
    goal.reachedOn ??
    (current !== null && current >= target ? (first?.date ?? created) : null);
  const met = reachedOn !== null;
  return {
    unit: mode === "e1rm" ? "kg e1RM" : "kg",
    start,
    current,
    target,
    fraction: met
      ? 1
      : current === null || target <= start
        ? 0
        : clamp((current - start) / (target - start)),
    met,
    reachedOn,
    daysLeft,
  };
}

/** A goal's name for lists: "Bench Press 110 kg × 1" or "Bodyweight 80 kg". */
export function goalTitle(goal: Goal) {
  const kg = (value: number) => `${Number(value.toFixed(2))} kg`;
  if (goal.kind === "bodyweight") return `Bodyweight ${kg(goal.targetKg)}`;
  const name = goal.exerciseName ?? "Lift";
  return goal.estimated
    ? `${name} ${kg(goal.targetKg)} est. 1RM`
    : `${name} ${kg(goal.targetKg)} × ${goal.reps ?? 1}`;
}
