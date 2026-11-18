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

/** The three-way control's choices: – (none), Lite (helping), Mycket (main). */
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
