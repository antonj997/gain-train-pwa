// Which muscles each exercise trains, and how much: the muscle map on the
// exercise page, the plan's week map and the small exercise icon read this.
// Pure, so it is tested (tests/exercise-muscles.test.ts).
import { catalogueById } from "./catalogue";
import type { RecordDoc } from "./model";
import {
  MUSCLES,
  MUSCLE_GROUP,
  knownMuscles,
  type ExerciseMuscles,
  type Muscle,
  type MuscleLevel,
} from "./muscles";
import { MUSCLE_GROUPS, type MuscleGroup } from "./muscle-sets";
import { customExercises } from "./selectors";

// Shared by the exercises that move the same way. Main muscles (1) are the
// prime movers; helping muscles (0.5) the synergists and stabilisers that do
// real work, not every muscle that is merely active.
const FLAT_PRESS: ExerciseMuscles = {
  chest: 1,
  upperChest: 0.5,
  frontDelts: 0.5,
  triceps: 0.5,
};
const INCLINE_PRESS: ExerciseMuscles = {
  upperChest: 1,
  chest: 0.5,
  frontDelts: 0.5,
  triceps: 0.5,
};
const FLY: ExerciseMuscles = { chest: 1, upperChest: 0.5, frontDelts: 0.5 };
const RDL: ExerciseMuscles = {
  hamstrings: 1,
  glutes: 1,
  lowerBack: 0.5,
  adductors: 0.5,
  forearms: 0.5,
  traps: 0.5,
};
/** A bent-over row: the torso is held by the lower back. */
const FREE_ROW: ExerciseMuscles = {
  upperBack: 1,
  lats: 1,
  rearDelts: 0.5,
  biceps: 0.5,
  brachialis: 0.5,
  forearms: 0.5,
  lowerBack: 0.5,
};
/** A supported or seated row: no lower back. */
const ROW: ExerciseMuscles = {
  upperBack: 1,
  lats: 1,
  rearDelts: 0.5,
  biceps: 0.5,
  brachialis: 0.5,
  forearms: 0.5,
};
const PULLDOWN: ExerciseMuscles = {
  lats: 1,
  upperBack: 0.5,
  biceps: 0.5,
  brachialis: 0.5,
  forearms: 0.5,
};
const PULL_UP: ExerciseMuscles = {
  lats: 1,
  upperBack: 0.5,
  biceps: 0.5,
  forearms: 0.5,
};
const SHOULDER_PRESS: ExerciseMuscles = {
  frontDelts: 1,
  sideDelts: 0.5,
  triceps: 0.5,
  traps: 0.5,
};
/** A guided press: the machine steadies the bar, so the traps do less. */
const MACHINE_SHOULDER_PRESS: ExerciseMuscles = {
  frontDelts: 1,
  sideDelts: 0.5,
  triceps: 0.5,
};
const LATERAL_RAISE: ExerciseMuscles = {
  sideDelts: 1,
  traps: 0.5,
  frontDelts: 0.5,
};
const REAR_DELT: ExerciseMuscles = { rearDelts: 1, upperBack: 0.5 };
const SHRUG: ExerciseMuscles = { traps: 1, forearms: 0.5 };
const CURL: ExerciseMuscles = { biceps: 1, brachialis: 0.5, forearms: 0.5 };
const NEUTRAL_CURL: ExerciseMuscles = {
  brachialis: 1,
  forearms: 1,
  biceps: 0.5,
};
const TRICEPS: ExerciseMuscles = { triceps: 1 };
const SQUAT: ExerciseMuscles = {
  quads: 1,
  glutes: 1,
  adductors: 0.5,
  lowerBack: 0.5,
};
/** Single-leg work: the outer hip keeps the knee and pelvis level. */
const SPLIT_SQUAT: ExerciseMuscles = {
  quads: 1,
  glutes: 1,
  adductors: 0.5,
  abductors: 0.5,
};
const LUNGE: ExerciseMuscles = {
  quads: 1,
  glutes: 1,
  hamstrings: 0.5,
  adductors: 0.5,
  abductors: 0.5,
};
const LEG_PRESS: ExerciseMuscles = { quads: 1, glutes: 0.5, adductors: 0.5 };
/** The calves (gastrocnemius) also bend the knee. */
const LEG_CURL: ExerciseMuscles = { hamstrings: 1, calves: 0.5 };
const STANDING_CALF: ExerciseMuscles = { calves: 1, soleus: 0.5 };
const HIP_THRUST: ExerciseMuscles = {
  glutes: 1,
  hamstrings: 0.5,
  quads: 0.5,
  adductors: 0.5,
};
const KICKBACK: ExerciseMuscles = { glutes: 1, hamstrings: 0.5 };
const ABDUCTION: ExerciseMuscles = { abductors: 1, glutes: 0.5 };
const CRUNCH: ExerciseMuscles = { abs: 1, obliques: 0.5 };
const ROTATION: ExerciseMuscles = { obliques: 1, abs: 0.5 };

/**
 * The muscles of every catalogue exercise, by its English name. Every entry
 * is listed (a test checks it), so a new one gets a deliberate choice; a
 * built-in id this version doesn't know falls back to its categories. Cardio
 * machines list helping muscles only: the map shows what they work, but a
 * cardio set is never a hard set, so they add nothing to a week's sets.
 */
export const MUSCLES_BY_NAME: Record<string, ExerciseMuscles> = {
  // Chest
  "Bench Press": FLAT_PRESS,
  "Incline Press": INCLINE_PRESS,
  // The decline angle takes the front delts mostly out of it.
  "Decline Bench Press": { chest: 1, triceps: 0.5 },
  "Dumbbell Press": FLAT_PRESS,
  "Incline Dumbbell Press": INCLINE_PRESS,
  "Dumbbell Fly": FLY,
  "Incline Dumbbell Fly": { upperChest: 1, chest: 0.5, frontDelts: 0.5 },
  "Cable Fly": FLY,
  // From the high pulleys the arms come down and in: the lower chest.
  "Cable Crossover": { chest: 1, frontDelts: 0.5 },
  "Machine Chest Press": FLAT_PRESS,
  "Pec Deck Machine": FLY,
  "Smith Bench Press": FLAT_PRESS,
  "Floor Press": { chest: 1, triceps: 0.5, frontDelts: 0.5 },
  "Push Up": { ...FLAT_PRESS, abs: 0.5 },
  "Diamond Push Up": { chest: 1, triceps: 1, frontDelts: 0.5, abs: 0.5 },
  Dip: { chest: 1, triceps: 1, frontDelts: 0.5 },
  // Back
  Deadlift: {
    glutes: 1,
    hamstrings: 1,
    lowerBack: 1,
    quads: 0.5,
    adductors: 0.5,
    traps: 0.5,
    upperBack: 0.5,
    lats: 0.5,
    forearms: 0.5,
  },
  "Romanian Deadlift": RDL,
  "Stiff Leg Deadlift": RDL,
  "Dumbbell Romanian Deadlift": RDL,
  // The handles sit at the sides, so the knees bend more than in a deadlift.
  "Trap Bar Deadlift": {
    quads: 1,
    glutes: 1,
    hamstrings: 0.5,
    adductors: 0.5,
    lowerBack: 0.5,
    traps: 0.5,
    forearms: 0.5,
  },
  // The top half of a deadlift: heavy for the back and the traps.
  "Rack Pull": {
    lowerBack: 1,
    glutes: 1,
    traps: 1,
    upperBack: 0.5,
    lats: 0.5,
    hamstrings: 0.5,
    forearms: 0.5,
  },
  "Barbell Row": FREE_ROW,
  "Pendlay Row": FREE_ROW,
  "Reverse Grip Barbell Row": FREE_ROW,
  "T-Bar Row": FREE_ROW,
  "Single Arm Dumbbell Row": ROW,
  "Chest Supported Row": ROW,
  "Machine Row": ROW,
  "Cable Row": ROW,
  "Seated Cable Row": ROW,
  "Single Arm Cable Row": ROW,
  "Inverted Row": { ...ROW, abs: 0.5 },
  "Lat Pulldown": PULLDOWN,
  "Wide Grip Lat Pulldown": {
    lats: 1,
    upperBack: 0.5,
    rearDelts: 0.5,
    biceps: 0.5,
    forearms: 0.5,
  },
  "Close Grip Lat Pulldown": PULLDOWN,
  // Straight arms leave the biceps out; the long head of the triceps helps.
  "Straight Arm Pulldown": { lats: 1, upperBack: 0.5, triceps: 0.5 },
  "Pull Up": PULL_UP,
  // Palms up: the biceps pull as hard as the lats.
  "Chin Up": {
    lats: 1,
    biceps: 1,
    upperBack: 0.5,
    brachialis: 0.5,
    forearms: 0.5,
  },
  "Neutral Grip Pull Up": PULLDOWN,
  "Assisted Pull Up": PULL_UP,
  "Dumbbell Pullover": { lats: 1, chest: 0.5, triceps: 0.5 },
  Hyperextension: { lowerBack: 1, glutes: 0.5, hamstrings: 0.5 },
  "Good Morning": {
    hamstrings: 1,
    lowerBack: 1,
    glutes: 0.5,
    adductors: 0.5,
  },
  "Kettlebell Row": ROW,
  "Band Row": { upperBack: 1, lats: 1, rearDelts: 0.5, biceps: 0.5 },
  Superman: { lowerBack: 1, glutes: 0.5, hamstrings: 0.5, upperBack: 0.5 },
  // Shoulders
  "Overhead Press": SHOULDER_PRESS,
  "Push Press": { ...SHOULDER_PRESS, quads: 0.5, glutes: 0.5 },
  "Dumbbell Shoulder Press": SHOULDER_PRESS,
  "Arnold Press": SHOULDER_PRESS,
  "Machine Shoulder Press": MACHINE_SHOULDER_PRESS,
  "Smith Shoulder Press": MACHINE_SHOULDER_PRESS,
  // Pressed up and forward from the hip: half a shoulder press, half an incline.
  "Landmine Press": {
    frontDelts: 1,
    upperChest: 0.5,
    triceps: 0.5,
    obliques: 0.5,
  },
  "Kettlebell Press": SHOULDER_PRESS,
  "Pike Push Up": {
    frontDelts: 1,
    sideDelts: 0.5,
    upperChest: 0.5,
    triceps: 0.5,
  },
  "Handstand Push Up": SHOULDER_PRESS,
  "Lateral Raise": LATERAL_RAISE,
  "Cable Lateral Raise": LATERAL_RAISE,
  "Front Raise": { frontDelts: 1, upperChest: 0.5, sideDelts: 0.5 },
  "Rear Delt Fly": REAR_DELT,
  "Cable Rear Delt Fly": REAR_DELT,
  "Reverse Pec Deck": REAR_DELT,
  "Face Pull": REAR_DELT,
  "Upright Row": { sideDelts: 1, traps: 1, frontDelts: 0.5, biceps: 0.5 },
  Shrugs: SHRUG,
  "Barbell Shrug": SHRUG,
  "Band Pull Apart": REAR_DELT,
  // Arms
  "Dumbbell Curl": CURL,
  "Barbell Curl": CURL,
  "EZ Bar Curl": CURL,
  "Hammer Curl": NEUTRAL_CURL,
  "Incline Dumbbell Curl": CURL,
  "Preacher Curl": CURL,
  "Concentration Curl": CURL,
  "Spider Curl": CURL,
  "Cable Curl": CURL,
  "Machine Curl": CURL,
  "Reverse Curl": NEUTRAL_CURL,
  "Wrist Curl": { forearms: 1 },
  "Tricep Pushdown": TRICEPS,
  "Rope Pushdown": TRICEPS,
  "Reverse Grip Pushdown": { triceps: 1, forearms: 0.5 },
  "Cable Tricep Extension": TRICEPS,
  "Overhead Tricep Extension": TRICEPS,
  "Cable Overhead Tricep Extension": TRICEPS,
  "Skull Crusher": TRICEPS,
  "Close Grip Bench Press": { triceps: 1, chest: 0.5, frontDelts: 0.5 },
  "Dumbbell Tricep Kickback": TRICEPS,
  "Machine Tricep Extension": TRICEPS,
  "Tricep Dip": { triceps: 1, chest: 0.5, frontDelts: 0.5 },
  // Legs
  Squat: SQUAT,
  // The upright torso shifts the work to the quads; the upper back holds the bar.
  "Front Squat": {
    quads: 1,
    glutes: 0.5,
    adductors: 0.5,
    upperBack: 0.5,
    abs: 0.5,
  },
  "Box Squat": { ...SQUAT, hamstrings: 0.5 },
  "Smith Squat": { quads: 1, glutes: 1, adductors: 0.5 },
  "Hack Squat": LEG_PRESS,
  "Goblet Squat": { quads: 1, glutes: 1, adductors: 0.5, abs: 0.5 },
  "Bulgarian Split Squat": SPLIT_SQUAT,
  "Split Squat": SPLIT_SQUAT,
  Lunges: LUNGE,
  "Walking Lunges": LUNGE,
  "Reverse Lunge": LUNGE,
  "Step Up": { quads: 1, glutes: 1, hamstrings: 0.5, abductors: 0.5 },
  "Leg Press": LEG_PRESS,
  "Leg Press Machine": LEG_PRESS,
  "Leg Extension": { quads: 1 },
  "Leg Curl": LEG_CURL,
  "Lying Leg Curl": LEG_CURL,
  "Seated Leg Curl": LEG_CURL,
  "Nordic Hamstring Curl": { hamstrings: 1, calves: 0.5, glutes: 0.5 },
  "Hip Adduction Machine": { adductors: 1 },
  // The wide stance makes the inner thighs a prime mover.
  "Sumo Deadlift": {
    glutes: 1,
    quads: 1,
    adductors: 1,
    hamstrings: 0.5,
    lowerBack: 0.5,
    traps: 0.5,
    forearms: 0.5,
  },
  "Calf Raise": STANDING_CALF,
  "Standing Calf Raise": STANDING_CALF,
  // With the knees bent the calves (gastrocnemius) go slack: the soleus works.
  "Seated Calf Raise": { soleus: 1, calves: 0.5 },
  "Bodyweight Squat": { quads: 1, glutes: 1, adductors: 0.5 },
  "Pistol Squat": { ...SPLIT_SQUAT, abs: 0.5 },
  "Wall Sit": { quads: 1, glutes: 0.5 },
  "Box Jump": { quads: 1, glutes: 1, calves: 0.5, hamstrings: 0.5 },
  // Glutes
  "Hip Thrust": HIP_THRUST,
  "Machine Hip Thrust": HIP_THRUST,
  "Single Leg Hip Thrust": {
    glutes: 1,
    hamstrings: 0.5,
    quads: 0.5,
    abductors: 0.5,
  },
  "Glute Bridge": KICKBACK,
  "Cable Pull Through": { glutes: 1, hamstrings: 0.5, lowerBack: 0.5 },
  "Cable Kickback": KICKBACK,
  "Glute Kickback Machine": KICKBACK,
  "Hip Abduction Machine": ABDUCTION,
  "Reverse Hyperextension": { glutes: 1, hamstrings: 0.5, lowerBack: 0.5 },
  "Single Leg Romanian Deadlift": {
    glutes: 1,
    hamstrings: 1,
    abductors: 0.5,
    lowerBack: 0.5,
  },
  "Curtsy Lunge": SPLIT_SQUAT,
  "Banded Lateral Walk": ABDUCTION,
  // Core
  Plank: { abs: 1, obliques: 0.5, frontDelts: 0.5 },
  // The outer hip holds the pelvis up off the floor.
  "Side Plank": { obliques: 1, abs: 0.5, abductors: 0.5 },
  "Hollow Hold": CRUNCH,
  // The quads' rectus femoris holds the legs up; the triceps the body.
  "L-Sit": { abs: 1, obliques: 0.5, quads: 0.5, triceps: 0.5 },
  "Ab Wheel": { abs: 1, obliques: 0.5, lats: 0.5 },
  "Cable Crunch": CRUNCH,
  "Machine Crunch": CRUNCH,
  Crunch: CRUNCH,
  "Sit Up": CRUNCH,
  "Bicycle Crunch": { abs: 1, obliques: 1 },
  "V-Up": CRUNCH,
  "Leg Raise": CRUNCH,
  "Hanging Leg Raise": { ...CRUNCH, forearms: 0.5 },
  "Toes To Bar": { ...CRUNCH, lats: 0.5, forearms: 0.5 },
  "Russian Twist": ROTATION,
  "Cable Woodchop": ROTATION,
  // Resisting the twist is the obliques' job.
  "Pallof Press": ROTATION,
  "Dumbbell Side Bend": { obliques: 1, lowerBack: 0.5 },
  "Dead Bug": CRUNCH,
  "Mountain Climber": { abs: 1, obliques: 0.5, frontDelts: 0.5, quads: 0.5 },
  // Full body
  "Kettlebell Swing": {
    glutes: 1,
    hamstrings: 1,
    lowerBack: 0.5,
    abs: 0.5,
    forearms: 0.5,
  },
  "Turkish Get Up": {
    frontDelts: 1,
    obliques: 1,
    abs: 0.5,
    sideDelts: 0.5,
    triceps: 0.5,
    glutes: 0.5,
    quads: 0.5,
  },
  "Kettlebell Deadlift": {
    glutes: 1,
    hamstrings: 1,
    quads: 0.5,
    lowerBack: 0.5,
    forearms: 0.5,
  },
  // Hips, knees and ankles extend hard together, then the traps pull the bar up.
  "Power Clean": {
    glutes: 1,
    hamstrings: 1,
    quads: 1,
    traps: 1,
    lowerBack: 0.5,
    upperBack: 0.5,
    calves: 0.5,
    forearms: 0.5,
  },
  "Clean And Jerk": {
    quads: 1,
    glutes: 1,
    frontDelts: 1,
    hamstrings: 0.5,
    traps: 0.5,
    triceps: 0.5,
    lowerBack: 0.5,
    upperBack: 0.5,
    calves: 0.5,
  },
  Snatch: {
    glutes: 1,
    quads: 1,
    traps: 1,
    hamstrings: 0.5,
    frontDelts: 0.5,
    triceps: 0.5,
    upperBack: 0.5,
    lowerBack: 0.5,
    calves: 0.5,
  },
  Thruster: {
    quads: 1,
    glutes: 1,
    frontDelts: 1,
    sideDelts: 0.5,
    triceps: 0.5,
    adductors: 0.5,
  },
  "Dumbbell Snatch": {
    glutes: 1,
    hamstrings: 1,
    quads: 0.5,
    traps: 0.5,
    frontDelts: 0.5,
    sideDelts: 0.5,
    triceps: 0.5,
  },
  "Farmer Carry": { forearms: 1, traps: 1, obliques: 0.5, abs: 0.5 },
  // One side loaded: the obliques keep the body from leaning.
  "Suitcase Carry": { obliques: 1, forearms: 1, traps: 0.5, abs: 0.5 },
  Burpee: {
    quads: 1,
    glutes: 0.5,
    chest: 0.5,
    frontDelts: 0.5,
    triceps: 0.5,
    abs: 0.5,
    calves: 0.5,
  },
  "Sled Push": {
    quads: 1,
    glutes: 1,
    calves: 0.5,
    hamstrings: 0.5,
    abs: 0.5,
  },
  // Cardio: helping muscles only.
  Treadmill: { quads: 0.5, hamstrings: 0.5, glutes: 0.5, calves: 0.5 },
  "Rowing Machine": {
    lats: 0.5,
    upperBack: 0.5,
    quads: 0.5,
    glutes: 0.5,
    biceps: 0.5,
  },
  "Cross Trainer": { quads: 0.5, glutes: 0.5, hamstrings: 0.5, calves: 0.5 },
  "Exercise Bike": { quads: 0.5, glutes: 0.5, calves: 0.5 },
  "Stair Climber": { quads: 0.5, glutes: 0.5, hamstrings: 0.5, calves: 0.5 },
  "Ski Erg": { lats: 0.5, triceps: 0.5, abs: 0.5, glutes: 0.5 },
  "Assault Bike": {
    quads: 0.5,
    glutes: 0.5,
    calves: 0.5,
    chest: 0.5,
    lats: 0.5,
  },
};

// ---------------------------------------------------------------- icons

/** The icons an own exercise can show: the body figure or an equipment glyph. */
export const CUSTOM_ICONS = [
  "body",
  "dumbbell",
  "barbell",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "bodyweight",
] as const;
export type CustomIcon = (typeof CUSTOM_ICONS)[number];

/** An own exercise's icon: the dumbbell when none is chosen or a newer app's is unknown here. */
export const customIconOf = (payload: { icon?: unknown }): CustomIcon =>
  (CUSTOM_ICONS as readonly unknown[]).includes(payload.icon)
    ? (payload.icon as CustomIcon)
    : "dumbbell";

// ---------------------------------------------------------------- lookup

const isGroup = (value: string | undefined): value is MuscleGroup =>
  !!value && (MUSCLE_GROUPS as readonly string[]).includes(value);

/** The muscles of a group, in MUSCLES order. */
export const groupMuscles = (group: MuscleGroup): Muscle[] =>
  MUSCLES.filter((muscle) => MUSCLE_GROUP[muscle] === group);

/**
 * Muscles for an exercise that only has categories: every muscle of the main
 * category is a main muscle, every muscle of the others a helping one. A
 * category that is no muscle group (Cardio, Full body, Other) gives nothing.
 */
export function musclesFromCategories(
  category: string | undefined,
  categories: readonly string[] = [],
): ExerciseMuscles {
  const muscles: ExerciseMuscles = {};
  for (const other of categories)
    if (other !== category && isGroup(other))
      for (const muscle of groupMuscles(other)) muscles[muscle] = 0.5;
  if (isGroup(category))
    for (const muscle of groupMuscles(category)) muscles[muscle] = 1;
  return ordered(muscles);
}

/** Cardio shows the heart figure: the Cardio category or sets that log cardio. */
export const isCardioExercise = (exercise: {
  category?: string;
  measure?: string;
}) => exercise.category === "Cardio" || exercise.measure === "cardio";

/**
 * An own exercise's muscles: those chosen in the picker, else from its
 * categories. `muscles` is read as stored, so a newer app's entries never
 * reach the map.
 */
export function customMuscles(payload: {
  category?: string;
  categories?: readonly string[];
  muscles?: unknown;
}): ExerciseMuscles {
  const chosen = knownMuscles(payload.muscles);
  return Object.keys(chosen).length
    ? chosen
    : musclesFromCategories(payload.category, payload.categories);
}

export type MusclesOf = (exerciseId: string) => ExerciseMuscles;

/**
 * The muscles lookup for the log, like categoriesLookup: the catalogue's
 * mapping, else the own exercise's (chosen, else from its categories), else
 * nothing for an exercise that no longer exists.
 */
export function musclesLookup(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): MusclesOf {
  const custom = new Map<string, ExerciseMuscles>();
  for (const record of customExercises(records))
    custom.set(record.id, customMuscles(record.payload));
  return (exerciseId) => {
    const builtin = catalogueById.get(exerciseId);
    if (builtin)
      return (
        MUSCLES_BY_NAME[builtin.name] ??
        musclesFromCategories(builtin.category, builtin.categories)
      );
    return custom.get(exerciseId) ?? {};
  };
}

/** One exercise's muscles, for its page. */
export const exerciseMuscles = (
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  exerciseId: string,
): ExerciseMuscles => musclesLookup(records)(exerciseId);

// ---------------------------------------------------------------- picker

/** Main muscles, in MUSCLES order. */
export const mainMuscles = (muscles: ExerciseMuscles): Muscle[] =>
  MUSCLES.filter((muscle) => muscles[muscle] === 1);

/** Helping muscles, in MUSCLES order. */
export const helpingMuscles = (muscles: ExerciseMuscles): Muscle[] =>
  MUSCLES.filter((muscle) => muscles[muscle] === 0.5);

/**
 * A group's level in the simple picker: the level all its muscles share (0
 * when none is trained), or "mixed" when they differ.
 */
export function groupLevel(
  muscles: ExerciseMuscles,
  group: MuscleGroup,
): MuscleLevel | 0 | "mixed" {
  const levels = new Set(groupMuscles(group).map((m) => muscles[m] ?? 0));
  return levels.size === 1 ? [...levels][0] : "mixed";
}

/** Every muscle of a group set to one level; 0 leaves the group out. */
export function withGroupLevel(
  muscles: ExerciseMuscles,
  group: MuscleGroup,
  level: MuscleLevel | 0,
): ExerciseMuscles {
  const next = { ...muscles };
  for (const muscle of groupMuscles(group))
    if (level) next[muscle] = level;
    else delete next[muscle];
  return ordered(next);
}

/** One muscle set to a level; 0 leaves it out. */
export function withMuscleLevel(
  muscles: ExerciseMuscles,
  muscle: Muscle,
  level: MuscleLevel | 0,
): ExerciseMuscles {
  const next = { ...muscles };
  if (level) next[muscle] = level;
  else delete next[muscle];
  return ordered(next);
}

/** The same muscles with the keys in MUSCLES order, so saved records read alike. */
const ordered = (muscles: ExerciseMuscles): ExerciseMuscles =>
  Object.fromEntries(
    MUSCLES.filter((muscle) => muscles[muscle]).map((muscle) => [
      muscle,
      muscles[muscle],
    ]),
  );
