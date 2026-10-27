export type ExerciseOptions = { id: string; editing: boolean } | null;

export type OptionsAction =
  | { type: "open"; id: string }
  | { type: "edit"; id: string }
  | { type: "close"; id?: string };

export function changeExerciseOptions(
  options: ExerciseOptions,
  action: OptionsAction,
): ExerciseOptions {
  if (action.type === "close")
    return action.id && options?.id !== action.id ? options : null;
  if (action.type === "open") return { id: action.id, editing: false };
  if (options?.id !== action.id) return options;
  return { ...options, editing: !options.editing };
}
