// One exercise's sessions and records, for the exercise page and the marks in
// a finished workout. Pure, so it is tested (tests/exercise-records.test.ts).
import { type RecordDoc, type WorkoutSet, validSet } from "./model";
import { isDrop } from "./drops";
import { estimate } from "./estimate";
import { completedWorkouts } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";

/** One finished workout's checked sets of an exercise. */
export type ExerciseSession = {
  workoutId: string;
  date: string;
  /** The workout's name as saved; show it with workoutTitle(). */
  workoutName: string;
  /** Checked, valid sets in the order they were logged, every section included. */
  sets: WorkoutSet[];
};

/**
 * The finished workouts that include the exercise with at least one checked
 * set, newest first. An exercise added twice to a workout is one session.
 */
export function exerciseSessions(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  exerciseId: string,
): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];
  for (const record of completedWorkouts(records)) {
    const sets = record.payload.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .flatMap((exercise) => exercise.sets)
      .filter((set) => set.done && validSet(set));
    if (sets.length)
      sessions.push({
        workoutId: record.id,
        date: record.payload.date,
        workoutName: record.payload.name,
        sets,
      });
  }
  return sessions;
}

/** A set that holds a record, and where it was done. */
export type RecordSet = {
  set: WorkoutSet;
  date: string;
  workoutId: string;
};
export type ValueRecord = RecordSet & { value: number };

export type ExerciseRecords = {
  /** Best estimated one-rep max (Epley), in kg. */
  bestE1rm: ValueRecord | null;
  /** Heaviest weight lifted; see heaviestLift() for the rule. */
  heaviest: RecordSet | null;
  /** Most reps in one working set; a tie goes to the heavier weight. */
  mostReps: RecordSet | null;
  /** Weight × reps of one weighted working set, in kg. */
  bestSetVolume: ValueRecord | null;
  /** Weight × reps of every weighted working set in one workout, drops included. */
  bestSessionVolume: { value: number; date: string; workoutId: string } | null;
  /** The most reps at each weight lifted, heaviest first. */
  repsAtWeight: (RecordSet & { weight: number; reps: number })[];
};

export const REPS_AT_WEIGHT_LIMIT = 8;

const weighted = (set: WorkoutSet) =>
  set.load === "weight" &&
  set.measure !== "seconds" &&
  set.measure !== "cardio" &&
  !!set.weight &&
  !!set.reps;
/** A working set that stands on its own: not a warm-up, cool-down or drop. */
const workingSet = (set: WorkoutSet) =>
  set.section === "working" && !isDrop(set);

/** Weighted, or bodyweight with added weight; reps, not time or cardio. */
const liftedLoad = (set: WorkoutSet): "weight" | "extra" | null =>
  set.measure === "seconds" || set.measure === "cardio" || !set.weight
    ? null
    : set.load === "weight"
      ? "weight"
      : hasExtraWeight(set)
        ? "extra"
        : null;

/**
 * The heaviest weight in any checked set, drops included, warm-ups not. A tie
 * on weight goes to the most reps, then the most recent. Weighted sets and
 * bodyweight sets with added weight are not compared: the kind of the latest
 * such set decides. `oldestFirst` is in the order the sets were done.
 */
function heaviestOf(oldestFirst: readonly ExerciseSession[]) {
  type Candidate = RecordSet & { order: number; kind: "weight" | "extra" };
  const candidates: Candidate[] = [];
  let order = 0;
  for (const session of oldestFirst)
    for (const set of session.sets) {
      order++;
      if (set.section === "warmup") continue;
      const kind = liftedLoad(set);
      if (kind)
        candidates.push({
          set,
          date: session.date,
          workoutId: session.workoutId,
          order,
          kind,
        });
    }
  if (!candidates.length) return null;
  const latest = candidates.at(-1)!;
  const best = candidates
    .filter((c) => c.kind === latest.kind)
    .reduce((a, b) => {
      const byWeight = (b.set.weight ?? 0) - (a.set.weight ?? 0);
      if (byWeight) return byWeight > 0 ? b : a;
      const byReps = (b.set.reps ?? 0) - (a.set.reps ?? 0);
      if (byReps) return byReps > 0 ? b : a;
      return b.order > a.order ? b : a;
    });
  return { set: best.set, date: best.date, workoutId: best.workoutId };
}

/** The records in sessions given oldest first. Ties keep the first time. */
export function recordsOf(
  oldestFirst: readonly ExerciseSession[],
): ExerciseRecords {
  let bestE1rm: ValueRecord | null = null;
  let mostReps: RecordSet | null = null;
  let bestSetVolume: ValueRecord | null = null;
  let bestSessionVolume: ExerciseRecords["bestSessionVolume"] = null;
  const atWeight = new Map<number, RecordSet & { reps: number }>();
  for (const session of oldestFirst) {
    const where = { date: session.date, workoutId: session.workoutId };
    let volume = 0;
    for (const set of session.sets) {
      if (set.section === "working" && weighted(set))
        volume += set.weight! * set.reps!;
      if (!workingSet(set)) continue;
      const e1rm = estimate(set);
      if (e1rm !== null && e1rm > (bestE1rm?.value ?? 0))
        bestE1rm = { set, value: e1rm, ...where };
      if (
        set.measure !== "seconds" &&
        set.measure !== "cardio" &&
        set.reps &&
        (!mostReps ||
          set.reps > mostReps.set.reps! ||
          (set.reps === mostReps.set.reps &&
            (set.weight ?? 0) > (mostReps.set.weight ?? 0)))
      )
        mostReps = { set, ...where };
      if (weighted(set)) {
        const value = set.weight! * set.reps!;
        if (value > (bestSetVolume?.value ?? 0))
          bestSetVolume = { set, value, ...where };
        const before = atWeight.get(set.weight!);
        if (!before || set.reps! > before.reps)
          atWeight.set(set.weight!, { set, reps: set.reps!, ...where });
      }
    }
    if (volume > (bestSessionVolume?.value ?? 0))
      bestSessionVolume = { value: volume, ...where };
  }
  return {
    bestE1rm,
    heaviest: heaviestOf(oldestFirst),
    mostReps,
    bestSetVolume,
    bestSessionVolume,
    repsAtWeight: [...atWeight.entries()]
      .sort(([a], [b]) => b - a)
      .slice(0, REPS_AT_WEIGHT_LIMIT)
      .map(([weight, hit]) => ({ ...hit, weight })),
  };
}

/** Every record of an exercise across the finished workouts. */
export function exerciseRecords(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  exerciseId: string,
): ExerciseRecords {
  return recordsOf(exerciseSessions(records, exerciseId).reverse());
}

/** The two records that make a PR: the heaviest weight and the best set volume. */
export type PrKind = "heaviest" | "setVolume";

/**
 * A PR: an exercise that beat its heaviest weight or its best set volume over
 * every earlier finished workout. One per exercise per workout.
 */
export type ExercisePr = {
  exerciseId: string;
  /** The exercise's name in its latest session. */
  name: string;
  workoutId: string;
  date: string;
  /** Heaviest weight first. */
  kinds: PrKind[];
  /** The set that carries the PR chip: the heaviest set when both records fall on different sets. */
  set: WorkoutSet;
};

type Heaviest = { set: WorkoutSet; workoutId: string };

/** heaviestOf()'s order: more weight, then more reps; a tie goes to the later set. */
const heavierOrSame = (set: WorkoutSet, than: WorkoutSet) =>
  (set.weight ?? 0) > (than.weight ?? 0) ||
  ((set.weight ?? 0) === (than.weight ?? 0) &&
    (set.reps ?? 0) >= (than.reps ?? 0));

/**
 * Every PR in the finished workouts, oldest first. For each exercise, a
 * workout is a PR when it lifted more weight than any earlier set of the same
 * kind (heaviestOf's rule: drops count, warm-ups do not), or did a working set
 * with more weight × reps than any earlier one. Something earlier to beat is
 * needed, so an exercise's first session is never a PR. A later workout that
 * beat it again does not take it away: it was a record when it was set.
 * Best e1RM, most reps and session volume are records (recordsOf), not PRs.
 */
export function prEvents(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): ExercisePr[] {
  type Running = {
    name: string;
    heaviest: { weight?: Heaviest; extra?: Heaviest };
    latestKind: "weight" | "extra" | null;
    setVolume: number;
  };
  const running = new Map<string, Running>();
  const events: ExercisePr[] = [];
  for (const record of completedWorkouts(records).reverse()) {
    const byExercise = new Map<string, { name: string; sets: WorkoutSet[] }>();
    for (const exercise of record.payload.exercises) {
      const sets = exercise.sets.filter((set) => set.done && validSet(set));
      if (!sets.length) continue;
      const group = byExercise.get(exercise.exerciseId);
      if (group) group.sets.push(...sets);
      else byExercise.set(exercise.exerciseId, { name: exercise.name, sets });
    }
    for (const [exerciseId, { name, sets }] of byExercise) {
      const state: Running = running.get(exerciseId) ?? {
        name,
        heaviest: {},
        latestKind: null,
        setVolume: 0,
      };
      running.set(exerciseId, state);
      state.name = name;
      const before = { ...state.heaviest };
      let topVolume: { set: WorkoutSet; value: number } | null = null;
      for (const set of sets) {
        const kind = set.section === "warmup" ? null : liftedLoad(set);
        if (kind) {
          const best = state.heaviest[kind];
          if (!best || heavierOrSame(set, best.set))
            state.heaviest[kind] = { set, workoutId: record.id };
          state.latestKind = kind;
        }
        if (workingSet(set) && weighted(set)) {
          const value = set.weight! * set.reps!;
          if (value > (topVolume?.value ?? 0)) topVolume = { set, value };
        }
      }
      const kind = state.latestKind;
      const after = kind ? state.heaviest[kind] : undefined;
      const beaten = kind ? before[kind] : undefined;
      // Equal sets in one workout: the chip goes on the first of them.
      const heaviestSet =
        after &&
        beaten &&
        after.workoutId === record.id &&
        (after.set.weight ?? 0) > (beaten.set.weight ?? 0)
          ? sets.find(
              (set) =>
                set.section !== "warmup" &&
                liftedLoad(set) === kind &&
                set.weight === after.set.weight &&
                set.reps === after.set.reps,
            )
          : undefined;
      const volumeSet =
        topVolume && state.setVolume > 0 && topVolume.value > state.setVolume
          ? topVolume.set
          : undefined;
      if (topVolume)
        state.setVolume = Math.max(state.setVolume, topVolume.value);
      const kinds: PrKind[] = [];
      if (heaviestSet) kinds.push("heaviest");
      if (volumeSet) kinds.push("setVolume");
      if (kinds.length)
        events.push({
          exerciseId,
          name,
          workoutId: record.id,
          date: record.payload.date,
          kinds,
          set: (heaviestSet ?? volumeSet)!,
        });
    }
  }
  // Each event names the exercise as it is called now.
  for (const event of events) event.name = running.get(event.exerciseId)!.name;
  return events;
}

/** The PRs a finished workout set, one per exercise, in the workout's order. */
export function workoutPrs(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  workoutId: string,
): ExercisePr[] {
  return prEvents(records).filter((event) => event.workoutId === workoutId);
}
