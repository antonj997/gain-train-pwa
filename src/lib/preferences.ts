import { t } from "../i18n";
import { local, storageKeys, writeStored } from "./storage";
import {
  parseWeightUnit,
  setCurrentWeightUnit,
  type WeightUnit,
} from "./units";
export const TRAINING_PREFERENCES_EVENT = "gain-preferences-change";
export type TrainingPreferences = {
  restSeconds: number;
  haptics: boolean;
  /** Workouts per week to aim for (1-14); null when off. */
  weeklyGoal: number | null;
  /** How weights are shown and typed; they are stored in kg either way. */
  weightUnit: WeightUnit;
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
  weightUnit: string | null = null,
): TrainingPreferences {
  const value = Number(rest);
  return {
    restSeconds:
      Number.isInteger(value) && value >= 0 && value <= 600 ? value : 0,
    haptics: haptics === "true",
    weeklyGoal: parseWeeklyGoal(weeklyGoal),
    weightUnit: parseWeightUnit(weightUnit),
  };
}
export function readTrainingPreferences(): TrainingPreferences {
  return normalizeTrainingPreferences(
    local.getItem(storageKeys.restSeconds),
    local.getItem(storageKeys.haptics),
    local.getItem(storageKeys.weeklyGoal),
    local.getItem(storageKeys.weightUnit),
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
  writeStored(storageKeys.weightUnit, next.weightUnit);
  // Labels built outside React read the unit from its module, so it changes first.
  setCurrentWeightUnit(next.weightUnit);
  window.dispatchEvent(new Event(TRAINING_PREFERENCES_EVENT));
}
/** Rest time as shown on the row: "Off", "0:30", "2:00". */
export const restLabel = (seconds: number) =>
  seconds
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
    : t("common.off");
/** The rest time a timer switched on for the first time gets. */
export const DEFAULT_REST_SECONDS = 120;
/** The longest rest the timer runs (normalizeTrainingPreferences' limit). */
export const MAX_REST_SECONDS = 600;
/**
 * The rest time steps of the shared rest control: 15 s up to 3:00, 30 s up
 * to 5:00, then a minute at a time.
 */
export function stepRest(seconds: number, direction: 1 | -1) {
  const steps: number[] = [];
  for (let s = 15; s <= MAX_REST_SECONDS; s += s < 180 ? 15 : s < 300 ? 30 : 60)
    steps.push(s);
  if (direction > 0)
    return steps.find((s) => s > seconds) ?? steps[steps.length - 1];
  return [...steps].reverse().find((s) => s < seconds) ?? steps[0];
}
/** The time a rest timer switched on again gets: the last one it had, else 2:00. */
export function restWhenOn(last: string | null) {
  const value = Number(last);
  return Number.isInteger(value) && value > 0 && value <= MAX_REST_SECONDS
    ? value
    : DEFAULT_REST_SECONDS;
}
/** Switches the rest timer off (time 0) or on again with the time it had. */
export function saveRestTimerOn(on: boolean) {
  const { restSeconds } = readTrainingPreferences();
  if (on) {
    if (restSeconds > 0) return;
    saveTrainingPreferences({
      restSeconds: restWhenOn(local.getItem(storageKeys.restLastSeconds)),
    });
    return;
  }
  if (restSeconds > 0)
    writeStored(storageKeys.restLastSeconds, String(restSeconds));
  saveTrainingPreferences({ restSeconds: 0 });
}
/** Whether this browser can vibrate at all; iPhone Safari cannot. */
export const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
export function trainingHaptic(enabled: boolean) {
  if (
    !enabled ||
    !canVibrate() ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    navigator.vibrate(20);
  } catch {
    /* Unsupported devices use the visible check feedback. */
  }
}
