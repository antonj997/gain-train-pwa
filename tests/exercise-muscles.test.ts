import test from "node:test";
import assert from "node:assert/strict";
import { catalogue } from "../src/data/catalogue.ts";
import { customSchema, type RecordDoc } from "../src/data/model.ts";
import {
  MUSCLES,
  MUSCLE_GROUP,
  isMuscle,
  isMuscleLevel,
  knownMuscles,
} from "../src/data/muscles.ts";
import {
  CUSTOM_ICONS,
  MUSCLES_BY_NAME,
  customIconOf,
  customMuscles,
  exerciseMuscles,
  groupLevel,
  groupMuscles,
  helpingMuscles,
  isCardioExercise,
  mainMuscles,
  musclesFromCategories,
  musclesLookup,
  withGroupLevel,
  withMuscleLevel,
} from "../src/data/exercise-muscles.ts";
import { MUSCLE_GROUPS } from "../src/data/muscle-sets.ts";
import { en } from "../src/i18n/en.ts";
import { sv } from "../src/i18n/sv.ts";

test("every catalogue exercise has an explicit muscle mapping", () => {
  assert.equal(catalogue.length, 170);
  assert.deepEqual(
    catalogue.filter((e) => !MUSCLES_BY_NAME[e.name]).map((e) => e.name),
    [],
  );
});

test("the muscle map lists only catalogue exercises", () => {
  const names = new Set(catalogue.map((e) => e.name));
  assert.deepEqual(
    Object.keys(MUSCLES_BY_NAME).filter((name) => !names.has(name)),
    [],
  );
});

test("every mapping holds valid muscles and levels", () => {
  for (const [name, muscles] of Object.entries(MUSCLES_BY_NAME)) {
    assert.ok(Object.keys(muscles).length > 0, name);
    for (const [muscle, level] of Object.entries(muscles)) {
      assert.ok(isMuscle(muscle), `${name}: ${muscle}`);
      assert.ok(isMuscleLevel(level), `${name}: ${muscle} ${level}`);
    }
  }
});

test("lifts have a main muscle; cardio machines only helping ones", () => {
  for (const e of catalogue) {
    const muscles = MUSCLES_BY_NAME[e.name];
    if (isCardioExercise(e)) {
      assert.deepEqual(mainMuscles(muscles), [], e.name);
      assert.ok(helpingMuscles(muscles).length > 0, e.name);
    } else assert.ok(mainMuscles(muscles).length > 0, e.name);
  }
});

test("known exercises train the expected muscles", () => {
  const cases: [string, Record<string, number>][] = [
    [
      "Bench Press",
      { chest: 1, upperChest: 0.5, frontDelts: 0.5, triceps: 0.5 },
    ],
    [
      "Incline Press",
      { upperChest: 1, chest: 0.5, frontDelts: 0.5, triceps: 0.5 },
    ],
    ["Squat", { quads: 1, glutes: 1, adductors: 0.5, lowerBack: 0.5 }],
    [
      "Romanian Deadlift",
      {
        hamstrings: 1,
        glutes: 1,
        lowerBack: 0.5,
        adductors: 0.5,
        forearms: 0.5,
        traps: 0.5,
      },
    ],
    [
      "Overhead Press",
      { frontDelts: 1, sideDelts: 0.5, triceps: 0.5, traps: 0.5 },
    ],
    ["Lateral Raise", { sideDelts: 1, traps: 0.5, frontDelts: 0.5 }],
    ["Face Pull", { rearDelts: 1, upperBack: 0.5 }],
    ["Pull Up", { lats: 1, upperBack: 0.5, biceps: 0.5, forearms: 0.5 }],
    ["Barbell Curl", { biceps: 1, brachialis: 0.5, forearms: 0.5 }],
    ["Hammer Curl", { brachialis: 1, forearms: 1, biceps: 0.5 }],
    ["Shrugs", { traps: 1, forearms: 0.5 }],
    ["Farmer Carry", { forearms: 1, traps: 1, obliques: 0.5, abs: 0.5 }],
    ["Plank", { abs: 1, obliques: 0.5, frontDelts: 0.5 }],
    ["Hip Abduction Machine", { abductors: 1, glutes: 0.5 }],
    ["Hip Adduction Machine", { adductors: 1 }],
    ["Standing Calf Raise", { calves: 1, soleus: 0.5 }],
    ["Seated Calf Raise", { soleus: 1, calves: 0.5 }],
    ["Treadmill", { quads: 0.5, hamstrings: 0.5, glutes: 0.5, calves: 0.5 }],
    [
      "Rowing Machine",
      { lats: 0.5, upperBack: 0.5, quads: 0.5, glutes: 0.5, biceps: 0.5 },
    ],
    ["Exercise Bike", { quads: 0.5, glutes: 0.5, calves: 0.5 }],
  ];
  for (const [name, muscles] of cases)
    assert.deepEqual(MUSCLES_BY_NAME[name], muscles, name);
  // Rows: the upper back and lats pull, the arms and rear delts help.
  for (const name of ["Barbell Row", "Seated Cable Row", "Chest Supported Row"])
    assert.deepEqual(
      [mainMuscles(MUSCLES_BY_NAME[name]), MUSCLES_BY_NAME[name].biceps],
      [["upperBack", "lats"], 0.5],
      name,
    );
});

test("categories give muscles: the main group at 1, the others at 0.5", () => {
  assert.deepEqual(musclesFromCategories("Chest", ["Arms"]), {
    chest: 1,
    upperChest: 1,
    biceps: 0.5,
    brachialis: 0.5,
    triceps: 0.5,
    forearms: 0.5,
  });
  // A main group listed among the others too stays a main group.
  assert.deepEqual(
    musclesFromCategories("Glutes", ["Glutes", "Other"]),
    musclesFromCategories("Glutes"),
  );
  assert.deepEqual(musclesFromCategories("Glutes"), {
    glutes: 1,
    abductors: 1,
  });
  // Cardio, Full body and Other are no muscle groups.
  assert.deepEqual(musclesFromCategories("Full body", ["Legs"]), {
    quads: 0.5,
    hamstrings: 0.5,
    adductors: 0.5,
    calves: 0.5,
    soleus: 0.5,
    tibialis: 0.5,
  });
  assert.deepEqual(musclesFromCategories("Cardio"), {});
  assert.deepEqual(musclesFromCategories("Other", ["Cardio"]), {});
  assert.deepEqual(musclesFromCategories(undefined), {});
});

test("cardio is the Cardio category or sets that log cardio", () => {
  assert.equal(isCardioExercise({ category: "Cardio" }), true);
  assert.equal(
    isCardioExercise({ category: "Other", measure: "cardio" }),
    true,
  );
  assert.equal(isCardioExercise({ category: "Full body" }), false);
  assert.equal(isCardioExercise({ category: "Legs", measure: "reps" }), false);
  assert.equal(isCardioExercise({}), false);
});

const ownExercise = (
  id: string,
  payload: Record<string, unknown>,
  deleted = false,
): RecordDoc =>
  ({
    id,
    kind: "exercise",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted,
    payload: { name: id, note: "", favourite: false, ...payload },
  }) as RecordDoc;

test("the lookup: catalogue, else chosen muscles, else categories", () => {
  const records = [
    ownExercise("chosen", {
      category: "Legs",
      muscles: { quads: 1, glutes: 0.5 },
    }),
    ownExercise("derived", { category: "Arms", categories: ["Chest"] }),
    // Only entries from a newer app: nothing chosen that this version knows.
    ownExercise("newer", { category: "Core", muscles: { neck: 1 } }),
    ownExercise("empty", { category: "Legs", muscles: {} }),
    ownExercise("gone", { category: "Chest", muscles: { chest: 1 } }, true),
  ];
  const musclesOf = musclesLookup(records);
  assert.equal(musclesOf("builtin:squat"), MUSCLES_BY_NAME.Squat);
  assert.deepEqual(musclesOf("chosen"), { quads: 1, glutes: 0.5 });
  assert.deepEqual(
    musclesOf("derived"),
    musclesFromCategories("Arms", ["Chest"]),
  );
  assert.deepEqual(musclesOf("newer"), { abs: 1, obliques: 1 });
  assert.deepEqual(musclesOf("empty"), musclesFromCategories("Legs"));
  assert.deepEqual(musclesOf("gone"), {});
  assert.deepEqual(musclesOf("builtin:not-in-this-version"), {});
  assert.deepEqual(exerciseMuscles(records, "chosen"), {
    quads: 1,
    glutes: 0.5,
  });
  assert.deepEqual(
    exerciseMuscles({ chosen: records[0] }, "builtin:hammer-curl"),
    MUSCLES_BY_NAME["Hammer Curl"],
  );
});

test("an own exercise's muscles read only known entries", () => {
  assert.deepEqual(
    customMuscles({
      category: "Back",
      muscles: { lats: 1, chest: 0.75, neck: 0.5, biceps: "1" },
    }),
    { lats: 1 },
  );
  assert.deepEqual(knownMuscles(null), {});
  assert.deepEqual(knownMuscles(["chest"]), {});
});

test("own exercises show their icon, else the dumbbell", () => {
  for (const icon of CUSTOM_ICONS) assert.equal(customIconOf({ icon }), icon);
  assert.equal(customIconOf({}), "dumbbell");
  assert.equal(customIconOf({ icon: "rings" }), "dumbbell");
  assert.equal(customIconOf({ icon: 3 }), "dumbbell");
});

test("main and helping muscles list in MUSCLES order", () => {
  const muscles = { calves: 1, chest: 0.5, quads: 1, biceps: 0.5 } as const;
  assert.deepEqual(mainMuscles(muscles), ["quads", "calves"]);
  assert.deepEqual(helpingMuscles(muscles), ["chest", "biceps"]);
  assert.deepEqual(mainMuscles({}), []);
});

test("groups cover every muscle once, in the app's groups", () => {
  assert.deepEqual(
    MUSCLE_GROUPS.flatMap(groupMuscles).sort(),
    [...MUSCLES].sort(),
  );
  for (const muscle of MUSCLES)
    assert.ok(MUSCLE_GROUPS.includes(MUSCLE_GROUP[muscle]), muscle);
  assert.deepEqual(groupMuscles("Glutes"), ["glutes", "abductors"]);
});

test("the simple picker reads and sets a whole group", () => {
  assert.equal(groupLevel({}, "Chest"), 0);
  assert.equal(groupLevel({ chest: 1, upperChest: 1 }, "Chest"), 1);
  assert.equal(groupLevel({ chest: 0.5, upperChest: 0.5 }, "Chest"), 0.5);
  assert.equal(groupLevel({ chest: 1, upperChest: 0.5 }, "Chest"), "mixed");
  assert.equal(groupLevel({ chest: 1 }, "Chest"), "mixed");

  const start = { triceps: 0.5, chest: 1 } as const;
  const chest = withGroupLevel(start, "Chest", 0.5);
  assert.deepEqual(chest, { chest: 0.5, upperChest: 0.5, triceps: 0.5 });
  assert.deepEqual(start, { triceps: 0.5, chest: 1 }); // not changed
  // Keys follow MUSCLES order, so saved records read alike.
  assert.deepEqual(Object.keys(chest), ["chest", "upperChest", "triceps"]);
  assert.deepEqual(withGroupLevel(chest, "Chest", 0), { triceps: 0.5 });
  assert.deepEqual(withGroupLevel({}, "Glutes", 1), {
    glutes: 1,
    abductors: 1,
  });
});

test("the advanced picker sets one muscle", () => {
  const muscles = withMuscleLevel({ quads: 1 }, "glutes", 0.5);
  assert.deepEqual(muscles, { glutes: 0.5, quads: 1 });
  assert.deepEqual(Object.keys(muscles), ["glutes", "quads"]);
  assert.deepEqual(withMuscleLevel(muscles, "glutes", 1), {
    glutes: 1,
    quads: 1,
  });
  assert.deepEqual(withMuscleLevel(muscles, "quads", 0), { glutes: 0.5 });
  assert.deepEqual(withMuscleLevel({}, "quads", 0), {});
});

const custom = (change: Record<string, unknown> = {}) => ({
  name: "Landmine row",
  category: "Back",
  note: "",
  ...change,
});

test("the schema takes muscles and an icon, both optional", () => {
  const plain = customSchema.parse(custom());
  assert.equal("muscles" in plain, false);
  assert.equal("icon" in plain, false);
  const parsed = customSchema.parse(
    custom({ muscles: { lats: 1, upperBack: 1, biceps: 0.5 }, icon: "body" }),
  );
  assert.deepEqual(parsed.muscles, { upperBack: 1, lats: 1, biceps: 0.5 });
  assert.equal(parsed.icon, "body");
});

test("the schema drops unknown muscles and levels instead of failing", () => {
  assert.deepEqual(
    customSchema.parse(custom({ muscles: { lats: 1, neck: 1, Lats: 1 } }))
      .muscles,
    { lats: 1 },
  );
  assert.deepEqual(
    customSchema.parse(
      custom({
        muscles: {
          lats: 2,
          upperBack: 0,
          biceps: 0.5,
          traps: "1",
          forearms: true,
          rearDelts: 0.25,
          brachialis: null,
        },
      }),
    ).muscles,
    { biceps: 0.5 },
  );
  // Not a map at all is a broken record, like any other wrong field.
  assert.equal(
    customSchema.safeParse(custom({ muscles: "lats" })).success,
    false,
  );
  assert.equal(
    customSchema.safeParse(custom({ icon: "x".repeat(31) })).success,
    false,
  );
});

test("every muscle and level has a name in both languages", () => {
  for (const muscle of MUSCLES) {
    const key = `muscleName.${muscle}` as keyof typeof en;
    assert.equal(typeof en[key], "string", muscle);
    assert.equal(typeof sv[key], "string", muscle);
  }
  assert.equal(en["muscleName.quads"], "Quads");
  assert.equal(sv["muscleName.quads"], "Framsida lår");
  assert.equal(en["muscleLevel.main"], "Main muscle");
  assert.equal(sv["muscleLevel.helping"], "Hjälpmuskel");
});
