import { local, writeStored, type KeyValueStorage } from "./storage";

/**
 * Slow motion, an admin's tool for reviewing the app's animations (Settings →
 * Admin → Developer). The choice lives on this device only, per account, and
 * applies only while that account is signed in and the server says it is an
 * admin. Pure, so it is tested; the player that slows the animations lives in
 * src/lib/slow-motion-player.ts and the controller in components/SlowMotion.tsx.
 */

/** 1 is off; the others slow every animation down that many times. */
export const SLOW_MOTION_SCALES = [1, 2, 5, 10] as const;
export type SlowMotionScale = (typeof SLOW_MOTION_SCALES)[number];

/** The device-only key for one account's choice. Never synced. */
export const slowMotionKey = (userId: string) => `gt-slowmo:${userId}`;

/** A stored value as a scale; anything unknown is off. */
export function parseSlowMotion(
  raw: string | null | undefined,
): SlowMotionScale {
  if (typeof raw !== "string") return 1;
  const value = raw.trim();
  return SLOW_MOTION_SCALES.find((scale) => String(scale) === value) ?? 1;
}

/** The account's stored choice, or off when there is none or storage refuses. */
export function readSlowMotion(
  userId: string,
  storage: KeyValueStorage = local,
): SlowMotionScale {
  if (!userId) return 1;
  try {
    return parseSlowMotion(storage.getItem(slowMotionKey(userId)));
  } catch {
    return 1;
  }
}

/** Saves the account's choice (off removes it). False when storage refused. */
export function writeSlowMotion(
  userId: string,
  scale: SlowMotionScale,
  storage: KeyValueStorage = local,
) {
  if (!userId) return false;
  const ok = writeStored(
    slowMotionKey(userId),
    scale === 1 ? null : String(scale),
    storage,
  );
  notifySetting();
  return ok;
}

/**
 * The scale that applies now: the stored one only for a signed-in account the
 * server has confirmed as an admin. Not known yet (undefined), not an admin,
 * or signed out is always 1.
 */
export function activeSlowMotion(input: {
  userId: string | null | undefined;
  isAdmin: boolean | undefined;
  stored: SlowMotionScale;
}): SlowMotionScale {
  if (!input.userId || input.isAdmin !== true) return 1;
  return parseSlowMotion(String(input.stored));
}

// The stored choice changed on this tab (the Admin page): readers re-read it.
const settingListeners = new Set<() => void>();
function notifySetting() {
  for (const listener of settingListeners) listener();
}
export function subscribeSlowMotionSetting(listener: () => void) {
  settingListeners.add(listener);
  return () => {
    settingListeners.delete(listener);
  };
}

// The scale in effect, set by the controller, read by motionMs and the toaster.
let currentScale: SlowMotionScale = 1;
const scaleListeners = new Set<() => void>();
export const motionScale = () => currentScale;
export function setMotionScale(scale: SlowMotionScale) {
  if (scale === currentScale) return;
  currentScale = scale;
  for (const listener of scaleListeners) listener();
}
export function subscribeMotionScale(listener: () => void) {
  scaleListeners.add(listener);
  return () => {
    scaleListeners.delete(listener);
  };
}

/**
 * A duration that ends something visual (a timer that removes a class, a
 * toast's time on screen), stretched by the slow-motion scale so it keeps
 * pace with the slowed animations. Not for autosave, sync or other timers.
 */
export function motionMs(ms: number, scale: number = currentScale) {
  if (!Number.isFinite(ms) || ms <= 0) return ms;
  if (!Number.isFinite(scale) || scale <= 1) return ms;
  return ms * scale;
}
