import test from "node:test";
import assert from "node:assert/strict";
import { autoWorkoutName } from "../src/lib/workout-name";
import { finishWorkout } from "../src/lib/workout-editor";
import type { Workout } from "../src/data/model";

const ex = (name: string) => ({
  id: crypto.randomUUID(),
  exerciseId: `builtin:${name}`,
  name,
  sets: [
    {
      id: crypto.randomUUID(),
      reps: 5,
      weight: 60,
      load: "weight" as const,
      section: "working" as const,
      done: true,
    },
  ],
});
const named = (name: string, names: string[] = []) => ({
  name,
  exercises: names.map(ex),
});

test("autoWorkoutName keeps a typed name and fills in the default one", () => {
  assert.equal(autoWorkoutName(named("Push day", ["Bench"])), "Push day");
  assert.equal(autoWorkoutName(named("Workout"), { routine: "Legs" }), "Legs");
  assert.equal(autoWorkoutName(named(""), { plan: "Upper" }), "Upper");
  assert.equal(
    autoWorkoutName(named("Workout", ["Bench"]), { routine: "Legs" }),
    "Legs",
    "a routine's name beats the exercises",
  );
  assert.equal(autoWorkoutName(named("Workout")), "Workout");
  assert.equal(
    autoWorkoutName(named("Workout", ["Bench Press"])),
    "Bench Press",
  );
  assert.equal(
    autoWorkoutName(named(" ", ["Bench Press", "Pull Up", "Bench Press"])),
    "Bench Press, Pull Up",
  );
  assert.equal(
    autoWorkoutName(named("Workout", ["Bench Press", "Pull Up", "Squat"])),
    "Bench Press + 2 more",
  );
  const long = autoWorkoutName(
    named("Workout", ["A".repeat(60), "B".repeat(60)]),
  );
  assert.equal(long, `${"A".repeat(60)} + 1 more`);
});

test("finishing names an unnamed workout; saving an edit keeps the stored name", () => {
  const w: Workout = {
    name: "Workout",
    date: "2026-10-01",
    duration: 30,
    startedAt: null,
    status: "draft",
    exercises: [ex("Squat"), { ...ex("Row"), sets: [] }],
  };
  assert.equal(
    finishWorkout(w).name,
    "Squat",
    "only exercises with sets count",
  );
  assert.equal(finishWorkout({ ...w, status: "completed" }).name, "Workout");
});

const real = (exerciseId: string, sets = 3) => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets: Array.from({ length: sets }, () => ({
    id: crypto.randomUUID(),
    reps: 8,
    weight: 60,
    load: "weight" as const,
    section: "working" as const,
    done: true,
  })),
});
const unnamed = (...exercises: ReturnType<typeof real>[]) => ({
  name: "Workout",
  exercises,
});

test("an unnamed workout is named after its main categories, most common first", () => {
  // Rows and pulldowns also train arms, but only as a secondary focus.
  assert.equal(
    autoWorkoutName(
      unnamed(
        real("builtin:barbell-row"),
        real("builtin:lat-pulldown"),
        real("builtin:pull-up"),
        real("builtin:dumbbell-curl"),
      ),
    ),
    "Back & Arms",
  );
  assert.equal(
    autoWorkoutName(
      unnamed(
        real("builtin:bench-press"),
        real("builtin:overhead-press"),
        real("builtin:tricep-pushdown"),
        real("builtin:incline-press"),
      ),
    ),
    "Chest, Shoulders & Arms",
    "ties go to more sets, then to the first one",
  );
  assert.equal(
    autoWorkoutName(
      unnamed(real("builtin:dumbbell-curl", 2), real("builtin:barbell-row", 4)),
    ),
    "Back & Arms",
    "a tie in exercises goes to the category with more sets",
  );
  assert.equal(autoWorkoutName(unnamed(real("builtin:squat"))), "Legs");
  assert.equal(
    autoWorkoutName(unnamed(real("my-own")), {}, new Map([["my-own", "Core"]])),
    "Core",
    "custom exercises use their saved category",
  );
  assert.equal(
    autoWorkoutName(unnamed(real("builtin:squat")), { routine: "Legs A" }),
    "Legs A",
    "a routine's name still wins",
  );
});
