import {
  local,
  storageKeys,
  writeStored,
  type KeyValueStorage,
} from "./storage";

/**
 * "Keep screen on" in a live workout: on unless this device switched it off.
 * The lock itself is src/hooks/useWakeLock.ts; the switch is in the workout's
 * details sheet, shown only where the Screen Wake Lock API exists.
 */

/** Whether the screen stays on through a running workout; on by default. */
export function readKeepScreenOn(storage: KeyValueStorage = local) {
  try {
    return storage.getItem(storageKeys.keepScreenOn) !== "false";
  } catch {
    return true;
  }
}

/** Saves the choice; on is the default, so it removes the key. False when storage refused. */
export function writeKeepScreenOn(
  on: boolean,
  storage: KeyValueStorage = local,
) {
  return writeStored(storageKeys.keepScreenOn, on ? null : "false", storage);
}

/** Whether this browser can keep the screen on (the Screen Wake Lock API). */
export function wakeLockSupported(nav: unknown = globalThis.navigator) {
  const api = (nav as { wakeLock?: { request?: unknown } } | undefined)
    ?.wakeLock;
  return !!api && typeof api.request === "function";
}
