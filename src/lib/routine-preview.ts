import type { Exercise, RecordDoc, Routine } from "../data/model";
import { previousResult, type LastSession } from "../data/workouts";
import { shortSetText } from "./set-target";
import { holdLabel, holdOf } from "./rep-hold";
import { completedWorkouts } from "../data/selectors";
import { isDrop } from "../data/drops";
import { hasExtraWeight } from "./set-load";
import { cardioLabel, isCardioSet } from "./cardio";
import { countLabel, durationLabel } from "./labels";
import { t } from "../i18n";
import { formatWeightValue, getWeightUnit } from "./units";

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
    countLabel(exercises, "exercise") +
    (minutes ? ` · ~${durationLabel(minutes)}` : "")
  );
}

/**
 * A planned exercise in a few words: "3 × 8 · 80 kg", "3 × 6 · 2 s · 60 kg"
 * with a hold, "4 sets" or "20:00".
 * Warm-ups, cool-downs and drops are not part of it; see `exerciseExtras`.
 */
export function plannedSummary(exercise: Exercise) {
  const real = exercise.sets.filter((s) => !isDrop(s));
  const sets = real.filter((s) => s.section === "working");
  const main = sets.length ? sets : real;
  if (!main.length) return t("routine.noSets");
  const first = main[0];
  if (main.length === 1 && isCardioSet(first)) return cardioLabel(first);
  const same = main.every(
    (s) =>
      s.reps === first.reps &&
      s.weight === first.weight &&
      s.load === first.load &&
      s.measure === first.measure &&
      s.extraWeight === first.extraWeight &&
      holdOf(s) === holdOf(first),
  );
  if (!same || isCardioSet(first) || first.reps === null)
    return countLabel(main.length, "set");
  const reps =
    first.measure === "seconds"
      ? t("label.timesSec", { sets: main.length, n: first.reps })
      : `${main.length} × ${first.reps}` +
        (holdOf(first) ? ` · ${holdLabel(first)}` : "");
  const kg = first.weight === null ? "" : formatWeightValue(first.weight);
  const unit = getWeightUnit();
  if (hasExtraWeight(first))
    return `${reps} · ${t("label.bwPlus", { kg, unit })}`;
  if (first.load === "bodyweight") return `${reps} · ${t("label.bw")}`;
  if (first.weight === null) return reps;
  return `${reps} · ${first.load === "assisted" ? t("label.assistSuffix", { kg, unit }) : `${kg} ${unit}`}`;
}

/** Warm-up, cool-down and drop sets of an exercise: "2 warm-up · 1 drop". */
export function exerciseExtras(exercise: Exercise) {
  const count = (test: (s: Exercise["sets"][number]) => boolean) =>
    exercise.sets.filter(test).length;
  const warmup = count((s) => !isDrop(s) && s.section === "warmup");
  const winddown = count((s) => !isDrop(s) && s.section === "winddown");
  const drops = count(isDrop);
  return [
    warmup && t("routine.warmups", { count: warmup }),
    winddown && t("routine.cooldowns", { count: winddown }),
    drops && countLabel(drops, "drop"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Minutes a planned set takes with its rest, for a routine never done. */
export const SET_MINUTES = { working: 3, other: 1.5, drop: 0.5 } as const;
/** Minutes to set up each exercise. */
export const EXERCISE_MINUTES = 2;
/** A cardio set without a planned time counts this long. */
export const CARDIO_MINUTES = 10;

/**
 * A routine's length estimated from its sets, rounded to 5 minutes, for a
 * routine with no finished workout: 3 minutes a working set (with its rest),
 * 1.5 a warm-up or cool-down, half a minute a drop, a cardio set's planned
 * time (else 10 minutes) and 2 minutes to set up each exercise. Null with no
 * sets.
 */
export function estimatedMinutes(routine: Pick<Routine, "exercises">) {
  let minutes = 0;
  let sets = 0;
  for (const exercise of routine.exercises) {
    if (!exercise.sets.length) continue;
    minutes += EXERCISE_MINUTES;
    for (const set of exercise.sets) {
      sets += 1;
      if (isCardioSet(set))
        minutes += set.durationSec ? set.durationSec / 60 : CARDIO_MINUTES;
      else if (isDrop(set)) minutes += SET_MINUTES.drop;
      else if (set.section === "working") minutes += SET_MINUTES.working;
      else minutes += SET_MINUTES.other;
    }
  }
  return sets ? roundToFive(minutes) : null;
}

/**
 * A routine's length for its tile and preview: the average of its finished
 * workouts, else the estimate from its sets (`estimated`).
 */
export function routineLength(
  routineId: string,
  routine: Pick<Routine, "exercises">,
  records: readonly RecordDoc[] | Record<string, RecordDoc>,
): { minutes: number | null; estimated: boolean } {
  const average = routineAverageMinutes(routineId, records);
  if (average !== null) return { minutes: average, estimated: false };
  return { minutes: estimatedMinutes(routine), estimated: true };
}

/** "8–12 reps", or "30–45 s" for a hold. */
export function repRangeLabel(
  range: Exercise["repRange"],
  timed = false,
): string {
  if (!range) return "";
  const span =
    range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
  return t(timed ? "routineTile.rangeSeconds" : "routineTile.rangeReps", {
    range: span,
  });
}

/**
 * A planned exercise in the preview: "1 warm-up + 3 sets · 8–12 reps".
 * Drops and cool-downs are added when there are any.
 */
export function previewSetsLine(exercise: Exercise) {
  const real = exercise.sets.filter((s) => !isDrop(s));
  const count = (section: Exercise["sets"][number]["section"]) =>
    real.filter((s) => s.section === section).length;
  const working = count("working");
  const warmup = count("warmup");
  const winddown = count("winddown");
  const drops = exercise.sets.length - real.length;
  if (!real.length) return t("routine.noSets");
  const main = [
    warmup && t("routineTile.warmupsShort", { count: warmup }),
    working && countLabel(working, "set"),
    winddown && t("routineTile.cooldownsShort", { count: winddown }),
  ]
    .filter(Boolean)
    .join(" + ");
  const timed = real.some((s) => s.measure === "seconds");
  return [
    main,
    drops && countLabel(drops, "drop"),
    repRangeLabel(exercise.repRange, timed),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Last time's result for an exercise, as the preview shows it beside
 * "Förra": its first working set's match in the last session ("80 × 8",
 * "BW × 12", "60 s"). Null with no history or for cardio.
 */
export function lastResultText(
  exercise: Exercise,
  last: LastSession | undefined,
) {
  if (!last) return null;
  const index = exercise.sets.findIndex(
    (s) => s.section === "working" && !isDrop(s),
  );
  const at = index >= 0 ? index : exercise.sets.findIndex((s) => !isDrop(s));
  if (at < 0 || isCardioSet(exercise.sets[at])) return null;
  const result = previousResult(last.sets, exercise.sets, at);
  return result ? shortSetText(result, result) : null;
}
