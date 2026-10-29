import type { Exercise, RecordDoc } from "../data/model";
import { completedWorkouts } from "../data/selectors";
import { isDrop } from "../data/drops";
import { hasExtraWeight } from "./set-load";
import { cardioLabel, isCardioSet } from "./cardio";
import { countLabel } from "./labels";

/** Minutes rounded to the nearest 5, never below 5. */
const roundToFive = (minutes: number) =>
  Math.max(5, Math.round(minutes / 5) * 5);

/**
 * The average length, rounded to 5 minutes, of the finished workouts started
 * from a routine. Null when none of them recorded a duration.
 */
export function routineAverageMinutes(
  routineId: string,
  records: readonly RecordDoc[] | Record<string, RecordDoc>,
): number | null {
  const durations = completedWorkouts(records).flatMap((r) =>
    r.payload.routineId === routineId && r.payload.duration !== null
      ? [r.payload.duration]
      : [],
  );
  if (!durations.length) return null;
  return roundToFive(durations.reduce((a, b) => a + b, 0) / durations.length);
}

/** "5 exercises" or "5 exercises · ~45 min". */
export function routineMeta(exercises: number, minutes: number | null) {
  return (
    countLabel(exercises, "exercise") + (minutes ? ` · ~${minutes} min` : "")
  );
}

/**
 * A planned exercise in a few words: "3 × 8 · 80 kg", "4 sets" or "20:00".
 * Warm-ups, cool-downs and drops are not part of it; see `exerciseExtras`.
 */
export function plannedSummary(exercise: Exercise) {
  const real = exercise.sets.filter((s) => !isDrop(s));
  const sets = real.filter((s) => s.section === "working");
  const main = sets.length ? sets : real;
  if (!main.length) return "No sets";
  const first = main[0];
  if (main.length === 1 && isCardioSet(first)) return cardioLabel(first);
  const same = main.every(
    (s) =>
      s.reps === first.reps &&
      s.weight === first.weight &&
      s.load === first.load &&
      s.measure === first.measure &&
      s.extraWeight === first.extraWeight,
  );
  if (!same || isCardioSet(first) || first.reps === null)
    return countLabel(main.length, "set");
  const reps =
    `${main.length} × ${first.reps}` +
    (first.measure === "seconds" ? " sec" : "");
  if (hasExtraWeight(first)) return `${reps} · BW + ${first.weight} kg`;
  if (first.load === "bodyweight") return `${reps} · BW`;
  if (first.weight === null) return reps;
  return `${reps} · ${first.weight} kg${first.load === "assisted" ? " assist" : ""}`;
}

/** Warm-up, cool-down and drop sets of an exercise: "2 warm-up · 1 drop". */
export function exerciseExtras(exercise: Exercise) {
  const count = (test: (s: Exercise["sets"][number]) => boolean) =>
    exercise.sets.filter(test).length;
  const warmup = count((s) => !isDrop(s) && s.section === "warmup");
  const winddown = count((s) => !isDrop(s) && s.section === "winddown");
  const drops = count(isDrop);
  return [
    warmup && `${warmup} warm-up`,
    winddown && `${winddown} cool-down`,
    drops && countLabel(drops, "drop"),
  ]
    .filter(Boolean)
    .join(" · ");
}
