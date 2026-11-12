// Ranked records for History: one record per exercise per workout, by what
// matters most, and one badge per workout with their count. Pure, so it is
// tested (tests/record-rank.test.ts).
//
// Three kinds, strongest first:
// 1. heaviest: more weight than any earlier set of the exercise with the same
//    kind of load (a weight, or added weight on bodyweight). Drops count,
//    warm-ups do not.
// 2. reps: more reps at a load done before than ever at that load: the same
//    weight, added weight or assistance, or plain bodyweight. Working sets
//    only (no warm-ups, cool-downs or drops), reps not holds.
// 3. e1rm: a higher estimated one-rep max (Epley, at most 10 reps) than any
//    earlier working set. It is an estimate, so it is shown more quietly.
// Each needs something earlier to beat: an exercise's first session holds no
// record. Sets with no load ("none"), timed holds and cardio hold none.
//
// This is History's model. The workout screen's live record mark still uses
// prEvents() (heaviest weight and best set volume) in exercise-records.ts.
import { validSet, type RecordDoc, type WorkoutSet } from "./model";
import { isDrop } from "./drops";
import { estimate } from "./estimate";
import { completedWorkouts } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";
import { t, type MessageKey } from "../i18n";

/** The record kinds, strongest first. */
export const RECORD_KINDS = ["heaviest", "reps", "e1rm"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** One exercise's records in one workout. */
export type RankedRecord = {
  exerciseId: string;
  /** The exercise's name as it is called now (its latest session). */
  name: string;
  workoutId: string;
  date: string;
  /** Every kind it set, strongest first; never empty. */
  kinds: RecordKind[];
  /** kinds[0]: the one the workout shows. */
  top: RecordKind;
  /** The set that holds the top record: the first one that did. */
  set: WorkoutSet;
};

/** A workout's single record badge: how many records, and whether only estimates. */
export type RecordBadge = {
  /** Exercises with a record. */
  count: number;
  /** The strongest kind among them. */
  top: RecordKind;
  /** True when every record is an e1RM one: the badge is quieter. */
  quiet: boolean;
};

const EPSILON = 1e-6;
const rank = (kind: RecordKind) => RECORD_KINDS.indexOf(kind);

/** The kind of lifted load a heaviest record compares within, or null. */
const liftedKind = (set: WorkoutSet): "weight" | "extra" | null =>
  set.measure === "seconds" || set.measure === "cardio" || !set.weight
    ? null
    : set.load === "weight"
      ? "weight"
      : hasExtraWeight(set)
        ? "extra"
        : null;

/** The load a rep record is counted at, as a key, or null when it has none. */
function repsKey(set: WorkoutSet): string | null {
  if (
    set.measure === "seconds" ||
    set.measure === "cardio" ||
    set.section !== "working" ||
    isDrop(set) ||
    !set.reps
  )
    return null;
  // Weights are kg to the gram; pounds are stored that way too.
  const kg = (set.weight ?? 0).toFixed(3);
  if (set.load === "weight") return "w" + kg;
  if (set.load === "assisted") return "a" + kg;
  if (set.load === "bodyweight") return hasExtraWeight(set) ? "x" + kg : "bw";
  return null;
}

const e1rmOf = (set: WorkoutSet) =>
  set.section === "working" && !isDrop(set) ? estimate(set) : null;

type Running = {
  heaviest: { weight?: number; extra?: number };
  reps: Map<string, number>;
  e1rm: number | null;
  name: string;
};

/**
 * Every record in the finished workouts, oldest first: for each exercise in
 * each workout, the kinds it set against every earlier finished workout. A
 * later workout that beat it again does not take it away.
 */
export function rankedRecords(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): RankedRecord[] {
  const running = new Map<string, Running>();
  const events: RankedRecord[] = [];
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
        heaviest: {},
        reps: new Map(),
        e1rm: null,
        name,
      };
      running.set(exerciseId, state);
      state.name = name;
      // Every comparison is with the state before this workout.
      const before = {
        heaviest: { ...state.heaviest },
        reps: new Map(state.reps),
        e1rm: state.e1rm,
      };
      const hits = new Map<RecordKind, WorkoutSet>();
      const hit = (kind: RecordKind, set: WorkoutSet) => {
        if (!hits.has(kind)) hits.set(kind, set);
      };
      // The heaviest per load kind this workout, first set on a tie.
      const top: { weight?: WorkoutSet; extra?: WorkoutSet } = {};
      for (const set of sets) {
        const kind = set.section === "warmup" ? null : liftedKind(set);
        if (kind && (!top[kind] || set.weight! > top[kind]!.weight! + EPSILON))
          top[kind] = set;
        const key = repsKey(set);
        if (key) {
          const best = before.reps.get(key);
          if (best !== undefined && set.reps! > best) hit("reps", set);
          state.reps.set(key, Math.max(state.reps.get(key) ?? 0, set.reps!));
        }
        const e1rm = e1rmOf(set);
        if (e1rm !== null) {
          if (before.e1rm !== null && e1rm > before.e1rm + EPSILON) {
            const current = hits.get("e1rm");
            if (!current || e1rm > (estimate(current) ?? 0) + EPSILON)
              hits.set("e1rm", set);
          }
          state.e1rm = Math.max(state.e1rm ?? 0, e1rm);
        }
      }
      for (const kind of ["weight", "extra"] as const) {
        const set = top[kind];
        if (!set) continue;
        const best = before.heaviest[kind];
        if (best !== undefined && set.weight! > best + EPSILON)
          hit("heaviest", set);
        state.heaviest[kind] = Math.max(best ?? 0, set.weight!);
      }
      const kinds = RECORD_KINDS.filter((kind) => hits.has(kind));
      if (kinds.length)
        events.push({
          exerciseId,
          name,
          workoutId: record.id,
          date: record.payload.date,
          kinds,
          top: kinds[0],
          set: hits.get(kinds[0])!,
        });
    }
  }
  for (const event of events) event.name = running.get(event.exerciseId)!.name;
  return events;
}

/** The records one finished workout set, in the order its exercises came. */
export function workoutRecords(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  workoutId: string,
): RankedRecord[] {
  return rankedRecords(records).filter(
    (event) => event.workoutId === workoutId,
  );
}

/** One badge per workout id: the count of records and how loud it is. */
export function recordBadges(
  events: readonly RankedRecord[],
): Map<string, RecordBadge> {
  const badges = new Map<string, RecordBadge>();
  for (const event of events) {
    const badge = badges.get(event.workoutId);
    if (!badge)
      badges.set(event.workoutId, {
        count: 1,
        top: event.top,
        quiet: event.top === "e1rm",
      });
    else {
      badge.count++;
      if (rank(event.top) < rank(badge.top)) badge.top = event.top;
      badge.quiet = badge.top === "e1rm";
    }
  }
  return badges;
}

/** The record set of each exercise, by set id, with its kinds. */
export function recordSetKinds(
  events: readonly RankedRecord[],
): Map<string, RecordKind[]> {
  return new Map(events.map((event) => [event.set.id, event.kinds]));
}

const KIND_NAMES: Record<RecordKind, MessageKey> = {
  heaviest: "records.heaviest",
  reps: "records.repRecord",
  e1rm: "records.e1rmRecord",
};
const KIND_SHORT: Record<RecordKind, MessageKey> = {
  heaviest: "records.short.heaviest",
  reps: "records.short.reps",
  e1rm: "records.short.e1rm",
};

/** The kind's name: "Heaviest weight", "Rep record", "Est. 1RM record". */
export const recordKindName = (kind: RecordKind) => t(KIND_NAMES[kind]);
/** The kind on a set's chip: "Record", "Reps", "e1RM". */
export const recordKindShort = (kind: RecordKind) => t(KIND_SHORT[kind]);
/** "Heaviest weight · Rep record": the kinds, strongest first. */
export const rankedKindsText = (kinds: readonly RecordKind[]) =>
  kinds.map(recordKindName).join(" · ");
/** "Record: Heaviest weight · Rep record", for screen readers and titles. */
export const rankedKindsLabel = (kinds: readonly RecordKind[]) =>
  t("records.prLabel", { kinds: rankedKindsText(kinds) });
/** "2 records", "1 record": the workout's badge. */
export const recordBadgeText = (badge: Pick<RecordBadge, "count">) =>
  t("records.count", { count: badge.count });
