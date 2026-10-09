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
  try {
    return normalizeTrainingPreferences(
      localStorage.getItem("gt-rest-seconds"),
      localStorage.getItem("gt-haptics"),
    );
  } catch {
    return { restSeconds: 0, haptics: false };
  }
}
export function saveTrainingPreferences(change: Partial<TrainingPreferences>) {
  const next = { ...readTrainingPreferences(), ...change };
  localStorage.setItem("gt-rest-seconds", String(next.restSeconds));
  localStorage.setItem("gt-haptics", String(next.haptics));
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
