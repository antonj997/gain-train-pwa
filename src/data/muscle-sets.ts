// Hard sets per muscle group and week, for Progress ("Sets per muscle
// group"). Pure, so it is tested (tests/muscle-sets.test.ts).
import {
  validSet,
  type RecordDoc,
  type Workout,
  type WorkoutSet,
} from "./model";
import { catalogueById } from "./catalogue";
import { isDrop } from "./drops";
import { completedWorkouts, customExercises } from "./selectors";
import { isCardioSet } from "../lib/cardio";
import { shiftDate, weekStart } from "../lib/dates";

/** The groups the card lists, in its order. Cardio, Full body and Other are not muscle groups. */
export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Glutes",
  "Core",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** The common guideline for growth: about 10 to 20 hard sets per muscle group a week. */
export const WEEKLY_SET_GUIDE = { min: 10, max: 20 } as const;
/** A secondary group gets half a set for each set. */
export const SECONDARY_SHARE = 0.5;
/** The bars' scale reaches at least this many sets, so the guide band sits still. */
export const MUSCLE_SCALE_MIN = 24;
/** Weeks before this one whose groups are listed even with no sets now. */
export const MUSCLE_LOOKBACK_WEEKS = 4;

/** An exercise's main category and the others it also trains. */
export type ExerciseCategories = {
  category?: string;
  categories?: readonly string[];
};
export type CategoriesOf = (exerciseId: string) => ExerciseCategories;

/**
 * A hard set: a checked, valid working set, not a warm-up or cool-down and
 * not cardio. A drop is part of its set, so it adds nothing.
 */
export const isHardSet = (set: WorkoutSet) =>
  set.done &&
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  validSet(set);

const isGroup = (value: string | undefined): value is MuscleGroup =>
  !!value && (MUSCLE_GROUPS as readonly string[]).includes(value);

/**
 * Hard sets per muscle group in the workouts: each set counts 1 for the
 * exercise's main category and 0.5 for every other category it trains.
 * Categories that are not muscle groups (Cardio, Full body, Other) count
 * nothing, so a full-body lift counts only for its other groups.
 */
export function hardSetsByMuscle(
  workouts: readonly Pick<Workout, "exercises">[],
  categoriesOf: CategoriesOf,
): Map<MuscleGroup, number> {
  const sets = new Map<MuscleGroup, number>();
  const add = (group: MuscleGroup, value: number) =>
    sets.set(group, (sets.get(group) ?? 0) + value);
  for (const workout of workouts)
    for (const exercise of workout.exercises) {
      const hard = exercise.sets.filter(isHardSet).length;
      if (!hard) continue;
      const { category, categories = [] } = categoriesOf(exercise.exerciseId);
      if (isGroup(category)) add(category, hard);
      for (const other of new Set(categories))
        if (other !== category && isGroup(other))
          add(other, hard * SECONDARY_SHARE);
    }
  return sets;
}

/** The categories lookup for the log: the catalogue's, else the custom exercise's. */
export function categoriesLookup(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): CategoriesOf {
  const custom = new Map<string, ExerciseCategories>();
  for (const record of customExercises(records))
    custom.set(record.id, {
      category: record.payload.category,
      categories: record.payload.categories,
    });
  return (exerciseId) =>
    catalogueById.get(exerciseId) ?? custom.get(exerciseId) ?? {};
}

export type MuscleSetRow = {
  group: MuscleGroup;
  /** Hard sets this week; halves come from secondary groups. */
  sets: number;
  /** Against the 10–20 guide. */
  status: "under" | "in" | "over";
};

export type WeeklyMuscleSets = {
  /** The Monday and Sunday of the week. */
  start: string;
  end: string;
  rows: MuscleSetRow[];
  /** The bars' full width in sets: MUSCLE_SCALE_MIN, or the most sets if more. */
  scale: number;
};

export const guideStatus = (sets: number): MuscleSetRow["status"] =>
  sets < WEEKLY_SET_GUIDE.min
    ? "under"
    : sets > WEEKLY_SET_GUIDE.max
      ? "over"
      : "in";

/**
 * The Monday-to-Sunday week that holds `now`: hard sets per muscle group in
 * its finished workouts. A group is listed when it has sets this week or had
 * some in the four weeks before, so one skipped this week shows as 0. Rows
 * follow MUSCLE_GROUPS' order.
 */
export function weeklyMuscleSets(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  now: string,
  categoriesOf: CategoriesOf = categoriesLookup(records),
): WeeklyMuscleSets {
  const start = weekStart(now);
  const end = shiftDate(start, 6);
  const since = shiftDate(start, -7 * MUSCLE_LOOKBACK_WEEKS);
  const done = completedWorkouts(records).map((record) => record.payload);
  const week = hardSetsByMuscle(
    done.filter((w) => w.date >= start && w.date <= end),
    categoriesOf,
  );
  const before = hardSetsByMuscle(
    done.filter((w) => w.date >= since && w.date < start),
    categoriesOf,
  );
  const rows = MUSCLE_GROUPS.filter(
    (group) => (week.get(group) ?? 0) > 0 || (before.get(group) ?? 0) > 0,
  ).map((group): MuscleSetRow => {
    const sets = week.get(group) ?? 0;
    return { group, sets, status: guideStatus(sets) };
  });
  const most = Math.max(0, ...rows.map((row) => row.sets));
  return {
    start,
    end,
    rows,
    scale: Math.max(MUSCLE_SCALE_MIN, Math.ceil(most)),
  };
}
