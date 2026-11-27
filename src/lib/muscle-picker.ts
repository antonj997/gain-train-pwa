// The muscle picker in the custom-exercise editor: which muscles it shows
// and how a choice changes the draft. Pure, so it is tested
// (tests/muscle-picker.test.ts).
import {
  customMuscles,
  groupLevel,
  withGroupLevel,
  withMuscleLevel,
} from "../data/exercise-muscles";
import type { CustomExercise } from "../data/model";
import {
  knownMuscles,
  type ExerciseMuscles,
  type Muscle,
  type MuscleLevel,
} from "../data/muscles";
import type { MuscleGroup } from "../data/muscle-sets";

/** The three-way control's choices: Ingen (none), Lite (helping), Mycket (main). */
export type LevelChoice = "none" | "some" | "much";
export const LEVEL_CHOICES: readonly LevelChoice[] = ["none", "some", "much"];

const LEVEL_OF: Record<LevelChoice, MuscleLevel | 0> = {
  none: 0,
  some: 0.5,
  much: 1,
};

/** A level as the control shows it; "mixed" for a group whose muscles differ. */
export function levelChoice(
  level: MuscleLevel | 0 | "mixed" | undefined,
): LevelChoice | "mixed" {
  if (level === "mixed") return "mixed";
  return level === 1 ? "much" : level === 0.5 ? "some" : "none";
}

/**
 * The muscles the picker shows: those chosen, else the ones its categories
 * give (customMuscles), and whether any were chosen.
 */
export function pickerMuscles(data: CustomExercise): {
  muscles: ExerciseMuscles;
  chosen: boolean;
} {
  return {
    muscles: customMuscles(data),
    chosen: Object.keys(knownMuscles(data.muscles)).length > 0,
  };
}

/** A group's choice in the simple picker. */
export const groupChoice = (data: CustomExercise, group: MuscleGroup) =>
  levelChoice(groupLevel(customMuscles(data), group));

/** A muscle's choice in the advanced picker. */
export const muscleChoice = (data: CustomExercise, muscle: Muscle) =>
  levelChoice(customMuscles(data)[muscle]);

/**
 * The draft with new muscles: the first change starts from what the picker
 * showed (its categories' muscles) and writes `muscles`. Choosing none for
 * every muscle leaves `muscles` out, so the categories stand in again.
 */
function withMuscles(
  data: CustomExercise,
  muscles: ExerciseMuscles,
): CustomExercise {
  const { muscles: _old, ...rest } = data;
  return Object.keys(muscles).length ? { ...rest, muscles } : rest;
}

/** Every muscle of a group set to a choice. */
export const withGroupChoice = (
  data: CustomExercise,
  group: MuscleGroup,
  choice: LevelChoice,
) =>
  withMuscles(
    data,
    withGroupLevel(customMuscles(data), group, LEVEL_OF[choice]),
  );

/** One muscle set to a choice. */
export const withMuscleChoice = (
  data: CustomExercise,
  muscle: Muscle,
  choice: LevelChoice,
) =>
  withMuscles(
    data,
    withMuscleLevel(customMuscles(data), muscle, LEVEL_OF[choice]),
  );

/**
 * A tap on the map (v6 §E3, a shortcut): Ingen → Mycket → Lite → Ingen.
 * Levels are `undefined` (none), 1 (main) and 0.5 (helping).
 */
export function cycleLevel(
  level: MuscleLevel | undefined,
): MuscleLevel | undefined {
  return level === undefined ? 1 : level === 1 ? 0.5 : undefined;
}

/** The same cycle on the control's choices; a mixed group starts at Ingen. */
export function cycleChoice(choice: LevelChoice | "mixed"): LevelChoice {
  const next = cycleLevel(
    choice === "much" ? 1 : choice === "some" ? 0.5 : undefined,
  );
  if (choice === "mixed") return "none";
  return next === 1 ? "much" : next === 0.5 ? "some" : "none";
}

/**
 * Each muscle's Latin name, the subtitle in the advanced picker (v6 §D1).
 * Latin reads the same in both languages. P3's muscleLatin (i18n) holds the
 * same names; this stands in until it lands.
 */
export const MUSCLE_LATIN: Readonly<Record<string, string>> = {
  chest: "pectoralis major",
  upperChest: "pectoralis major, pars clavicularis",
  frontDelts: "deltoideus, pars anterior",
  sideDelts: "deltoideus, pars lateralis",
  rearDelts: "deltoideus, pars posterior",
  biceps: "biceps brachii",
  brachialis: "brachialis",
  triceps: "triceps brachii",
  forearms: "flexores antebrachii",
  abs: "rectus abdominis",
  obliques: "obliquus externus et internus",
  traps: "trapezius, pars descendens",
  upperBack: "rhomboidei, trapezius pars transversa",
  lats: "latissimus dorsi",
  lowerBack: "erector spinae",
  glutes: "gluteus maximus",
  abductors: "gluteus medius",
  quads: "quadriceps femoris",
  hamstrings: "biceps femoris m.fl.",
  adductors: "adductores",
  calves: "gastrocnemius",
  soleus: "soleus",
  tibialis: "tibialis anterior",
  hipFlexors: "iliopsoas",
};
