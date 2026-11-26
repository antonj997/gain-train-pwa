import { t } from "../i18n";
import type { MapFigure } from "../components/muscles/detailed-geometry";
import { local, storageKeys, writeStored } from "./storage";
import {
  parseWeightUnit,
  setCurrentWeightUnit,
  type WeightUnit,
} from "./units";
export const TRAINING_PREFERENCES_EVENT = "gain-preferences-change";
export const MAP_FIGURE_EVENT = "gain-map-figure-change";

/** A stored figure; anything but "f" is the man, the default. */
export const parseMapFigure = (value: string | null): MapFigure =>
  value === "f" ? "f" : "m";
export const readMapFigure = (): MapFigure =>
  parseMapFigure(local.getItem(storageKeys.mapFigure));
/** Saves the figure on this device (the man is the default, so it removes the key). */
export function saveMapFigure(figure: MapFigure) {
  writeStored(storageKeys.mapFigure, figure === "f" ? "f" : null);
  window.dispatchEvent(new Event(MAP_FIGURE_EVENT));
}

/** v6: what to do when a muscle tires late in the workout (Settings → Coach). */
export const FATIGUE_MODES = ["off", "suggest", "auto"] as const;
export type FatigueMode = (typeof FATIGUE_MODES)[number];

export type TrainingPreferences = {
  /**
   * Whether the rest timer runs (v6). Off for a new user; a device that saved
   * a rest time before v6 reads as on (see normalizeTrainingPreferences).
   */
  restOn: boolean;
  /**
   * The rest time for every exercise without its own, in seconds; 0 means
   * each exercise's tier (rest-tiers.ts). See effectiveRest.
   */
  restSeconds: number;
  haptics: boolean;
  /** Workouts per week to aim for (1-14); null when off. */
  weeklyGoal: number | null;
  /** How weights are shown and typed; they are stored in kg either way. */
  weightUnit: WeightUnit;
  /** A short sound when a rest runs out (on unless switched off). */
  restSound: boolean;
  /** Ask for reps in reserve after reps (off unless switched on). */
  askRir: boolean;
  /** "Tips i passet": the warm-up and drop rows in the Set sheet (on). */
  workoutTips: boolean;
  /** "Trött muskel sent i passet": off, suggest (the default) or auto. */
  fatigueMode: FatigueMode;
};
export function parseWeeklyGoal(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const goal = Number(value);
  return Number.isInteger(goal) && goal >= 1 && goal <= 14 ? goal : null;
}
export const parseFatigueMode = (value: string | null | undefined): FatigueMode =>
  (FATIGUE_MODES as readonly (string | null | undefined)[]).includes(value)
    ? (value as FatigueMode)
    : "suggest";

/** The stored strings of the training preferences, each null when absent. */
export type StoredTrainingPreferences = {
  rest?: string | null;
  restOn?: string | null;
  haptics?: string | null;
  weeklyGoal?: string | null;
  weightUnit?: string | null;
  restSound?: string | null;
  askRir?: string | null;
  workoutTips?: string | null;
  fatigueMode?: string | null;
};

/**
 * The preferences from their stored strings, with every default. The rest
 * timer's migration (decision 4): with no stored on/off, a saved rest time
 * above 0 reads as on, with that time kept for every exercise; otherwise it
 * is off. An explicit "false" wins and keeps the time.
 *
 * The positional form (rest, haptics, weeklyGoal, weightUnit, restSound,
 * askRir) is kept for older callers.
 */
export function normalizeTrainingPreferences(
  stored: StoredTrainingPreferences,
): TrainingPreferences;
export function normalizeTrainingPreferences(
  rest: string | null,
  haptics: string | null,
  weeklyGoal?: string | null,
  weightUnit?: string | null,
  restSound?: string | null,
  askRir?: string | null,
): TrainingPreferences;
export function normalizeTrainingPreferences(
  first: StoredTrainingPreferences | string | null,
  haptics: string | null = null,
  weeklyGoal: string | null = null,
  weightUnit: string | null = null,
  restSound: string | null = null,
  askRir: string | null = null,
): TrainingPreferences {
  const stored: StoredTrainingPreferences =
    first !== null && typeof first === "object"
      ? first
      : { rest: first, haptics, weeklyGoal, weightUnit, restSound, askRir };
  const value = Number(stored.rest ?? null);
  const restSeconds =
    Number.isInteger(value) && value >= 0 && value <= MAX_REST_SECONDS
      ? value
      : 0;
  const restOn =
    stored.restOn === "true" || (stored.restOn == null && restSeconds > 0);
  return {
    restOn,
    restSeconds,
    haptics: stored.haptics === "true",
    weeklyGoal: parseWeeklyGoal(stored.weeklyGoal ?? null),
    weightUnit: parseWeightUnit(stored.weightUnit ?? null),
    restSound: stored.restSound !== "false",
    askRir: stored.askRir === "true",
    workoutTips: stored.workoutTips !== "false",
    fatigueMode: parseFatigueMode(stored.fatigueMode),
  };
}
export function readTrainingPreferences(): TrainingPreferences {
  return normalizeTrainingPreferences({
    rest: local.getItem(storageKeys.restSeconds),
    restOn: local.getItem(storageKeys.restOn),
    haptics: local.getItem(storageKeys.haptics),
    weeklyGoal: local.getItem(storageKeys.weeklyGoal),
    weightUnit: local.getItem(storageKeys.weightUnit),
    restSound: local.getItem(storageKeys.restSound),
    askRir: local.getItem(storageKeys.askRir),
    workoutTips: local.getItem(storageKeys.workoutTips),
    fatigueMode: local.getItem(storageKeys.fatigueMode),
  });
}
export function saveTrainingPreferences(change: Partial<TrainingPreferences>) {
  const next = { ...readTrainingPreferences(), ...change };
  writeStored(storageKeys.restSeconds, String(next.restSeconds));
  // Written either way once saved, so the upgrade's reading (a saved time
  // reads as on) never applies again.
  writeStored(storageKeys.restOn, String(next.restOn));
  writeStored(storageKeys.haptics, String(next.haptics));
  writeStored(
    storageKeys.weeklyGoal,
    next.weeklyGoal === null ? null : String(next.weeklyGoal),
  );
  writeStored(storageKeys.weightUnit, next.weightUnit);
  writeStored(storageKeys.restSound, next.restSound ? null : "false");
  writeStored(storageKeys.askRir, next.askRir ? "true" : null);
  writeStored(storageKeys.workoutTips, next.workoutTips ? null : "false");
  writeStored(
    storageKeys.fatigueMode,
    next.fatigueMode === "suggest" ? null : next.fatigueMode,
  );
  // Labels built outside React read the unit from its module, so it changes first.
  setCurrentWeightUnit(next.weightUnit);
  window.dispatchEvent(new Event(TRAINING_PREFERENCES_EVENT));
}

/**
 * An exercise's rest time in seconds, 0 meaning no timer (v6 §D7):
 *
 * 1. its own time from the library (restOf), if any; 0 turns it off even
 *    while the timer is on;
 * 2. otherwise 0 while the timer is off;
 * 3. otherwise the all-exercises time when it is above 0;
 * 4. otherwise its tier (restTier).
 */
export function effectiveRest(
  prefs: Pick<TrainingPreferences, "restOn" | "restSeconds">,
  own: number | undefined,
  tier: number,
): number {
  if (own !== undefined) return own;
  if (!prefs.restOn) return 0;
  return prefs.restSeconds > 0 ? prefs.restSeconds : tier;
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
/**
 * Switches the rest timer off or on, writing restOn. As before v6, off keeps
 * the time to come back to and sets it to 0, and on restores it (else 2:00),
 * so the screens that still read `restSeconds > 0` as "on" agree.
 */
export function saveRestTimerOn(on: boolean) {
  const { restSeconds } = readTrainingPreferences();
  if (on) {
    saveTrainingPreferences({
      restOn: true,
      ...(restSeconds > 0
        ? {}
        : {
            restSeconds: restWhenOn(
              local.getItem(storageKeys.restLastSeconds),
            ),
          }),
    });
    return;
  }
  if (restSeconds > 0)
    writeStored(storageKeys.restLastSeconds, String(restSeconds));
  saveTrainingPreferences({ restOn: false, restSeconds: 0 });
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
