import type { WorkoutSet } from "../data/model";
import { parseSetNumber } from "./set-input";
import { formatDecimal, t } from "../i18n";

/** The server's limits for cardio values (see the cardio migrations). */
export const CARDIO_MAX = {
  durationSec: 86400,
  distanceM: 1_000_000,
  level: 100,
  calories: 100_000,
  inclinePct: 100,
  heartRate: 300,
} as const;

export const isCardioSet = (set: Pick<WorkoutSet, "measure">) =>
  set.measure === "cardio";

/**
 * What a cardio card can show, in the order its columns run. Time is always
 * shown: a cardio set needs one to be checked. Pace is worked out from time
 * and distance and never stored.
 */
export const CARDIO_METRICS = [
  "time",
  "distance",
  "pace",
  "level",
  "incline",
  "calories",
  "heartRate",
] as const;
export type CardioMetric = (typeof CARDIO_METRICS)[number];
export const DISTANCE_UNITS = ["km", "m", "mi"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];
/** The fields a cardio exercise shows, and the unit its distance is typed in. */
export type CardioFields = {
  fields: readonly CardioMetric[];
  distanceUnit: DistanceUnit;
};
/** The set value each typed metric is stored in. */
export const METRIC_KEYS = {
  time: "durationSec",
  distance: "distanceM",
  level: "level",
  incline: "inclinePct",
  calories: "calories",
  heartRate: "heartRate",
} as const satisfies Record<Exclude<CardioMetric, "pace">, keyof WorkoutSet>;
export type CardioKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];
export const CARDIO_KEYS = Object.values(METRIC_KEYS) as CardioKey[];

const fieldSet = (
  fields: CardioMetric[],
  distanceUnit: DistanceUnit = "km",
): CardioFields => ({ fields, distanceUnit });
// The machines' own defaults; any other cardio exercise gets the last one.
const MACHINE_FIELDS: Record<string, CardioFields> = {
  "builtin:treadmill": fieldSet(["time", "distance", "incline"]),
  "builtin:exercise-bike": fieldSet(["time", "distance", "level"]),
  "builtin:cross-trainer": fieldSet(["time", "distance", "level"]),
  "builtin:rowing-machine": fieldSet(["time", "distance"], "m"),
  "builtin:ski-erg": fieldSet(["time", "distance"], "m"),
  "builtin:stair-climber": fieldSet(["time", "level", "calories"]),
};
const OTHER_FIELDS = fieldSet(["time", "distance", "calories"]);

/** The fields an exercise starts with before the user chooses their own. */
export const defaultCardioFields = (exerciseId: string): CardioFields =>
  MACHINE_FIELDS[exerciseId] ?? OTHER_FIELDS;

const isMetric = (value: unknown): value is CardioMetric =>
  CARDIO_METRICS.includes(value as CardioMetric);
const isUnit = (value: unknown): value is DistanceUnit =>
  DISTANCE_UNITS.includes(value as DistanceUnit);

/**
 * Saved fields as the app uses them: known fields only, in column order, time
 * always first. Anything unreadable (a newer app's field, a bad unit) falls
 * back to the exercise's defaults for that part.
 */
export function cardioFieldsOf(saved: unknown, exerciseId: string) {
  const fallback = defaultCardioFields(exerciseId);
  if (!saved || typeof saved !== "object") return fallback;
  const { fields, distanceUnit } = saved as Record<string, unknown>;
  const chosen = Array.isArray(fields) ? fields.filter(isMetric) : null;
  return {
    fields: chosen
      ? CARDIO_METRICS.filter((m) => m === "time" || chosen.includes(m))
      : fallback.fields,
    distanceUnit: isUnit(distanceUnit) ? distanceUnit : fallback.distanceUnit,
  };
}

/** The fields with one metric turned on or off. Time stays on; pace needs distance. */
export function withMetric(
  current: CardioFields,
  metric: CardioMetric,
  on: boolean,
): CardioFields {
  if (metric === "time") return current;
  const chosen = new Set(current.fields);
  if (on) chosen.add(metric);
  else chosen.delete(metric);
  if (metric === "distance" && !on) chosen.delete("pace");
  if (metric === "pace" && on) chosen.add("distance");
  return {
    ...current,
    fields: CARDIO_METRICS.filter((m) => m === "time" || chosen.has(m)),
  };
}

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

/*
 * Time is typed like a timer (iOS Timer, Strong, Hevy): digits fill from the
 * right and the colons come by themselves. "4" is 0:04, "400" is 4:00, "0400"
 * is 4:00 and "13000" is 1:30:00. Six digits at most, read as h:mm:ss.
 */
export const TIMER_DIGITS = 6;

/** The digits of a text without leading zeros: "0:04:00" becomes "400". */
export const timerDigits = (text: string) =>
  text.replace(/\D/g, "").replace(/^0+/, "");

/** Seconds for timer digits, read as h:mm:ss from the right. "90" is 90 s; "" is null. */
export function digitsToSeconds(digits: string): number | null {
  const d = digits.replace(/^0+/, "");
  if (!d) return null;
  if (!/^\d+$/.test(d) || d.length > TIMER_DIGITS) return NaN;
  const padded = d.padStart(6, "0");
  return (
    Number(padded.slice(0, 2)) * 3600 +
    Number(padded.slice(2, 4)) * 60 +
    Number(padded.slice(4, 6))
  );
}

/**
 * Timer digits as shown while typing, before any rollover: "4" is "0:04",
 * "90" is "0:90", "4500" is "45:00". `typed` shows a lone zero as "0:00".
 */
export function formatTimerDigits(digits: string, typed = false) {
  const d = digits.replace(/^0+/, "");
  if (!d) return typed ? "0:00" : "";
  if (d.length <= 2) return `0:${d.padStart(2, "0")}`;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

/** A clock time as written: "4:00", "04:00", "4:5" (4:05) or "1:30:00". */
function parseClock(text: string): number | null {
  const match = /^(\d{1,4}):(\d{1,2})(?::(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const [a, b, c] = match.slice(1).map((part) => Number(part ?? 0));
  if (match[3] === undefined) return b < 60 ? a * 60 + b : null;
  return a <= 99 && b < 60 && c < 60 ? a * 3600 + b * 60 + c : null;
}

/**
 * What the time field shows after an edit. `next` is the field's new text and
 * `previous` what it showed before. A digit typed at the end shifts in from
 * the right, a backspace takes the last digit off, and a pasted clock time
 * ("4:00", "1:5:00") is read as a time. Null when the edit is refused: a
 * seventh digit, or text with no digits but more than blank.
 */
export function timerEntry(next: string, previous: string): string | null {
  const text = next.trim();
  if (!text) return "";
  // More than one character at once is a paste or a replacement.
  if (text.includes(":") && Math.abs(next.length - previous.length) > 1) {
    const seconds = parseClock(text);
    if (seconds !== null) return formatTimerDigits(secondsToDigits(seconds));
  }
  if (!/\d/.test(text)) return null;
  const digits = timerDigits(text);
  if (digits.length > TIMER_DIGITS) return null;
  // A typed zero shows 0:00; taking the last digit off empties the field.
  return formatTimerDigits(digits, next.length > previous.length);
}

/** The digits that show a number of seconds: 240 is "400", 5400 is "13000". */
export const secondsToDigits = (seconds: number) =>
  timerDigits(formatDuration(seconds));

/**
 * Time as the field holds it, in seconds: its digits read as h:mm:ss from the
 * right, so "0:90" is 90 s (shown as 1:30 once the field is left) and "4:00"
 * 240 s. Blank, or no time ("0:00"), is null; anything else is NaN.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  if (!/^[\d:]+$/.test(value)) return NaN;
  return digitsToSeconds(timerDigits(value));
}

/* Distance is stored in metres and typed in the exercise's unit. */
export const METRES_PER_MILE = 1609.344;
const UNIT_METRES: Record<DistanceUnit, number> = {
  km: 1000,
  m: 1,
  mi: METRES_PER_MILE,
};
// Kilometres to the metre, metres whole, miles to a hundredth.
const UNIT_DECIMALS: Record<DistanceUnit, number> = { km: 3, m: 0, mi: 2 };

/** Metres in a unit, rounded as it is shown: 3200 m is 3.2 km or 1.99 mi. */
export const metresIn = (meters: number, unit: DistanceUnit) =>
  Number((meters / UNIT_METRES[unit]).toFixed(UNIT_DECIMALS[unit]));

/** Metres in a unit without trailing zeros: 3200 becomes "3.2" (km). */
export function formatDistance(
  meters: number | null | undefined,
  unit: DistanceUnit = "km",
) {
  if (meters === null || meters === undefined || !Number.isFinite(meters))
    return "";
  return formatDecimal(metresIn(meters, unit));
}

/** A distance as typed in a unit ("3.2" or "3,2") to whole metres. Blank is null; unfinished text is NaN. */
export function parseDistance(text: string, unit: DistanceUnit = "km") {
  const value = parseSetNumber(text);
  if (value === null || !Number.isFinite(value)) return value;
  return value < 0 ? NaN : Math.round(value * UNIT_METRES[unit]);
}

/** "3.2 km", "3200 m" or "1.99 mi". */
export const distanceLabel = (meters: number, unit: DistanceUnit = "km") =>
  `${formatDistance(meters, unit)} ${unit}`;

/** Metres as kilometres without trailing zeros: 3200 becomes "3.2". */
export const formatKm = (meters: number | null | undefined) =>
  formatDistance(meters, "km");

/** Kilometres as typed ("3.2" or "3,2") to whole metres. Blank is null; unfinished text is NaN. */
export const parseKm = (text: string) => parseDistance(text, "km");

/** What pace is per: a mile for miles, otherwise a kilometre. */
export const paceUnit = (unit: DistanceUnit) =>
  unit === "mi" ? "min/mi" : "min/km";

/**
 * Seconds per kilometre (or per mile for miles) from a time and a distance,
 * or null when either is missing.
 */
export function paceSeconds(
  durationSec: number | null | undefined,
  distanceM: number | null | undefined,
  unit: DistanceUnit = "km",
) {
  if (!durationSec || !distanceM || durationSec <= 0 || distanceM <= 0)
    return null;
  if (!Number.isFinite(durationSec) || !Number.isFinite(distanceM)) return null;
  return durationSec / (distanceM / (unit === "mi" ? METRES_PER_MILE : 1000));
}

/** "6:15" for a pace; blank when there is none. */
export const formatPace = (
  durationSec: number | null | undefined,
  distanceM: number | null | undefined,
  unit: DistanceUnit = "km",
) => formatDuration(paceSeconds(durationSec, distanceM, unit));

const present = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value);

/**
 * "20:00 · 3.2 km · L8 · 2% incline · 250 kcal · 142 bpm", leaving out what
 * was not entered. Every value the set holds is listed, shown or not.
 */
export function cardioLabel(set: WorkoutSet, unit: DistanceUnit = "km") {
  const parts: string[] = [];
  if (set.durationSec) parts.push(formatDuration(set.durationSec));
  if (set.distanceM) parts.push(distanceLabel(set.distanceM, unit));
  if (present(set.level)) parts.push(`L${formatDecimal(set.level)}`);
  if (present(set.inclinePct))
    parts.push(t("cardio.inclineValue", { n: formatDecimal(set.inclinePct) }));
  if (set.calories) parts.push(`${formatDecimal(set.calories)} kcal`);
  if (set.heartRate)
    parts.push(`${formatDecimal(Math.round(set.heartRate))} bpm`);
  return parts.join(" · ");
}

export type CardioTotals = {
  durationSec: number;
  distanceM: number;
  calories: number;
  /** Average over the sets that have one, weighted by their time; null for none. */
  heartRate: number | null;
  inclinePct: number | null;
};

/** Time, distance and calories over the done cardio sets given, with average heart rate and incline. */
export function cardioTotals(sets: WorkoutSet[]): CardioTotals {
  let durationSec = 0,
    distanceM = 0,
    calories = 0;
  const average = (key: "heartRate" | "inclinePct") => {
    let sum = 0,
      weight = 0;
    for (const set of sets) {
      const value = set[key];
      if (!present(value)) continue;
      const w = set.durationSec && set.durationSec > 0 ? set.durationSec : 1;
      sum += value * w;
      weight += w;
    }
    return weight ? Number((sum / weight).toFixed(1)) : null;
  };
  for (const set of sets) {
    durationSec += set.durationSec ?? 0;
    distanceM += set.distanceM ?? 0;
    calories += set.calories ?? 0;
  }
  return {
    durationSec,
    distanceM,
    calories,
    heartRate: average("heartRate"),
    inclinePct: average("inclinePct"),
  };
}

/**
 * "20:00 · 3.2 km" from totals, with calories and average heart rate when any
 * were logged; distance is left out when none was.
 */
export function totalsLabel(
  totals: Pick<CardioTotals, "durationSec" | "distanceM"> &
    Partial<CardioTotals>,
  unit: DistanceUnit = "km",
) {
  return [
    formatDuration(totals.durationSec),
    totals.distanceM ? distanceLabel(totals.distanceM, unit) : "",
    totals.calories ? `${formatDecimal(totals.calories)} kcal` : "",
    totals.heartRate ? `${Math.round(totals.heartRate)} bpm` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Most fields a cardio row fits on one line; more wrap to a second. */
export const CARDIO_FIELDS_PER_LINE = 4;

/**
 * The columns of a cardio row's fields: up to four on one line, more split
 * over two lines. Time, the first, is the widest; every column is at least
 * 44px, so each field stays a full touch target at 360px.
 */
export function cardioGridColumns(count: number) {
  const perLine =
    count <= CARDIO_FIELDS_PER_LINE ? Math.max(1, count) : Math.ceil(count / 2);
  return [
    "minmax(56px, 1.3fr)",
    ...Array(perLine - 1).fill("minmax(44px, 1fr)"),
  ].join(" ");
}
