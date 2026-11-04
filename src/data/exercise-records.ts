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

export type RecordKind =
  | "e1rm"
  | "heaviest"
  | "reps"
  | "setVolume"
  | "sessionVolume";

/** The records a set (or, for session volume, the exercise) set in one workout. */
export type WorkoutRecordHit = {
  exerciseId: string;
  kinds: RecordKind[];
  /** The set that holds the record; null for session volume. */
  setId: string | null;
};

/**
 * The records a finished workout set: for each exercise in it, the records
 * that it beat over every earlier session. An exercise's first session is a
 * starting point, not a record, as for Recent bests. A later workout that
 * beat it again does not take the mark away: it was a record when it was set.
 */
export function workoutRecordHits(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  workoutId: string,
): WorkoutRecordHit[] {
  const record = completedWorkouts(records).find((r) => r.id === workoutId);
  if (!record) return [];
  const ids = [...new Set(record.payload.exercises.map((e) => e.exerciseId))];
  const hits: WorkoutRecordHit[] = [];
  for (const exerciseId of ids) {
    const sessions = exerciseSessions(records, exerciseId);
    const index = sessions.findIndex((s) => s.workoutId === workoutId);
    if (index < 0 || index === sessions.length - 1) continue;
    const earlier = sessions.slice(index + 1).reverse();
    const before = recordsOf(earlier);
    const after = recordsOf([...earlier, sessions[index]]);
    const bySet = new Map<string, RecordKind[]>();
    const mark = (kind: RecordKind, hit: RecordSet | null, beaten: boolean) => {
      if (!hit || hit.workoutId !== workoutId || !beaten) return;
      bySet.set(hit.set.id, [...(bySet.get(hit.set.id) ?? []), kind]);
    };
    const value = (r: { value: number } | null) => r?.value ?? 0;
    mark(
      "e1rm",
      after.bestE1rm,
      value(after.bestE1rm) > value(before.bestE1rm),
    );
    mark(
      "heaviest",
      after.heaviest,
      !before.heaviest ||
        (after.heaviest?.set.weight ?? 0) > (before.heaviest.set.weight ?? 0),
    );
    mark(
      "reps",
      after.mostReps,
      (after.mostReps?.set.reps ?? 0) > (before.mostReps?.set.reps ?? 0),
    );
    mark(
      "setVolume",
      after.bestSetVolume,
      value(after.bestSetVolume) > value(before.bestSetVolume),
    );
    for (const [setId, kinds] of bySet)
      hits.push({ exerciseId, kinds, setId });
    if (
      after.bestSessionVolume?.workoutId === workoutId &&
      value(after.bestSessionVolume) > value(before.bestSessionVolume)
    )
      hits.push({ exerciseId, kinds: ["sessionVolume"], setId: null });
  }
  return hits;
}
