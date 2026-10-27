import { local, storageKeys, writeStored } from "./storage";
export const TRAINING_PREFERENCES_EVENT = "gain-preferences-change";
export type TrainingPreferences = { restSeconds: number; haptics: boolean };
export function normalizeTrainingPreferences(
  rest: string | null,
  haptics: string | null,
): TrainingPreferences {
  const value = Number(rest);
  return {
    restSeconds:
      Number.isInteger(value) && value >= 0 && value <= 600 ? value : 0,
    haptics: haptics === "true",
  };
}
export function readTrainingPreferences(): TrainingPreferences {
  return normalizeTrainingPreferences(
    local.getItem(storageKeys.restSeconds),
    local.getItem(storageKeys.haptics),
  );
}
export function saveTrainingPreferences(change: Partial<TrainingPreferences>) {
  const next = { ...readTrainingPreferences(), ...change };
  writeStored(storageKeys.restSeconds, String(next.restSeconds));
  writeStored(storageKeys.haptics, String(next.haptics));
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
