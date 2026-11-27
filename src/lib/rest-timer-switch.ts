import {
  MAX_REST_SECONDS,
  readTrainingPreferences,
  saveTrainingPreferences,
  type TrainingPreferences,
} from "./preferences";
import { local, storageKeys, writeStored } from "./storage";

/**
 * What Settings' Vilotimer switch saves (v6 §D7, §G1). Times are per
 * exercise now, so switching on sets no time of its own: a new user's timer
 * follows the tiers (restSeconds 0). A time for all exercises that was put
 * aside when the timer went off (`last`, from gt-rest-last-seconds) comes
 * back with it, so a saved rest time is kept (decision 4).
 *
 * Off sets restSeconds to 0 as well as restOn false, so a screen that still
 * reads `restSeconds > 0` as "on" agrees with the switch.
 */
export function restTimerPatch(
  on: boolean,
  restSeconds: number,
  last: string | null,
): Pick<TrainingPreferences, "restOn" | "restSeconds"> {
  if (!on) return { restOn: false, restSeconds: 0 };
  if (restSeconds > 0) return { restOn: true, restSeconds };
  const saved = Number(last);
  return {
    restOn: true,
    restSeconds:
      Number.isInteger(saved) && saved > 0 && saved <= MAX_REST_SECONDS
        ? saved
        : 0,
  };
}

/** Switches the rest timer on or off from Settings and saves it. */
export function switchRestTimer(on: boolean) {
  const { restSeconds } = readTrainingPreferences();
  // Put the time for all exercises aside, for when it is switched on again;
  // with none (the tiers), on again follows the tiers too.
  if (!on)
    writeStored(
      storageKeys.restLastSeconds,
      restSeconds > 0 ? String(restSeconds) : null,
    );
  saveTrainingPreferences(
    restTimerPatch(on, restSeconds, local.getItem(storageKeys.restLastSeconds)),
  );
}
