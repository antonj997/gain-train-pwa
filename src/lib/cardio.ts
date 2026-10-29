import type { WorkoutSet } from "../data/model";
import { parseSetNumber } from "./set-input";

/** The server's limits for cardio values (see the cardio migration). */
export const CARDIO_MAX = {
  durationSec: 86400,
  distanceM: 1_000_000,
  level: 100,
  calories: 100_000,
} as const;

export const isCardioSet = (set: Pick<WorkoutSet, "measure">) =>
  set.measure === "cardio";

/** 1200 becomes "20:00", 65 "1:05", 3900 "1:05:00". */
export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Time as typed: "20:00" or "1:05:00". A bare number is minutes ("20" is
 * 20:00). Blank is null; text that is not a time yet ("20:", "20:5") is NaN,
 * like parseSetNumber, so the editor keeps it as unfinished text.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  let match = /^(\d{1,4})$/.exec(value);
  if (match) return Number(match[1]) * 60;
  match = /^(\d{1,4}):([0-5]\d)$/.exec(value);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(value);
  if (match)
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return NaN;
}

/** Metres as kilometres without trailing zeros: 3200 becomes "3.2". */
export function formatKm(meters: number | null | undefined) {
  if (meters === null || meters === undefined || !Number.isFinite(meters))
    return "";
  return String(Number((meters / 1000).toFixed(3)));
}

/** Kilometres as typed ("3.2" or "3,2") to whole metres. Blank is null; unfinished text is NaN. */
export function parseKm(text: string): number | null {
  const km = parseSetNumber(text);
  if (km === null || !Number.isFinite(km)) return km;
  return km < 0 ? NaN : Math.round(km * 1000);
}

/** "20:00 · 3.2 km · L8 · 250 kcal", leaving out what was not entered. */
export function cardioLabel(set: WorkoutSet) {
  const parts: string[] = [];
  if (set.durationSec) parts.push(formatDuration(set.durationSec));
  if (set.distanceM) parts.push(`${formatKm(set.distanceM)} km`);
  if (set.level !== null && set.level !== undefined)
    parts.push(`L${set.level}`);
  if (set.calories) parts.push(`${set.calories} kcal`);
  return parts.join(" · ");
}

/** Time, distance and calories over the done cardio sets given. */
export function cardioTotals(sets: WorkoutSet[]) {
  let durationSec = 0,
    distanceM = 0,
    calories = 0;
  for (const set of sets) {
    durationSec += set.durationSec ?? 0;
    distanceM += set.distanceM ?? 0;
    calories += set.calories ?? 0;
  }
  return { durationSec, distanceM, calories };
}

/** "20:00 · 3.2 km" from totals; distance is left out when none was logged. */
export function totalsLabel(totals: ReturnType<typeof cardioTotals>) {
  return [
    formatDuration(totals.durationSec),
    totals.distanceM ? `${formatKm(totals.distanceM)} km` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
