import { local, storageKeys, writeStored } from "./storage";
export const TRAINING_PREFERENCES_EVENT = "gain-preferences-change";
export type TrainingPreferences = {
  restSeconds: number;
  haptics: boolean;
  /** Workouts per week to aim for (1-14); null when off. */
  weeklyGoal: number | null;
};
export function parseWeeklyGoal(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const goal = Number(value);
  return Number.isInteger(goal) && goal >= 1 && goal <= 14 ? goal : null;
}
export function normalizeTrainingPreferences(
  rest: string | null,
  haptics: string | null,
  weeklyGoal: string | null = null,
): TrainingPreferences {
  const value = Number(rest);
  return {
    restSeconds:
      Number.isInteger(value) && value >= 0 && value <= 600 ? value : 0,
    haptics: haptics === "true",
    weeklyGoal: parseWeeklyGoal(weeklyGoal),
  };
}
export function readTrainingPreferences(): TrainingPreferences {
  return normalizeTrainingPreferences(
    local.getItem(storageKeys.restSeconds),
    local.getItem(storageKeys.haptics),
    local.getItem(storageKeys.weeklyGoal),
  );
}
export function saveTrainingPreferences(change: Partial<TrainingPreferences>) {
  const next = { ...readTrainingPreferences(), ...change };
  writeStored(storageKeys.restSeconds, String(next.restSeconds));
  writeStored(storageKeys.haptics, String(next.haptics));
  writeStored(
    storageKeys.weeklyGoal,
    next.weeklyGoal === null ? null : String(next.weeklyGoal),
  );
  window.dispatchEvent(new Event(TRAINING_PREFERENCES_EVENT));
}
export function trainingHaptic(enabled: boolean) {
  if (
    !enabled ||
    typeof navigator === "undefined" ||
    !navigator.vibrate ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    navigator.vibrate(20);
  } catch {
    /* Unsupported devices use the visible check feedback. */
  }
}
