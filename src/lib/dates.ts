import { currentLocale } from "../i18n";

// Creating an Intl.DateTimeFormat is far slower than using one, and screens
// such as the heatmap format hundreds of dates per render.
const formats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options);
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formats.set(key, format);
  }
  return format;
}

/** A YYYY-MM-DD date in the app's language ("26 Oct 2026", "26 okt. 2026"). */
export function localizedDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  locale: string = currentLocale(),
) {
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime())
    ? value
    : dateFormat(locale, options).format(date);
}
/** A moment (Date or epoch ms) in the app's language. */
export function localizedMoment(
  value: Date | number,
  options: Intl.DateTimeFormatOptions,
  locale: string = currentLocale(),
) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : dateFormat(locale, options).format(date);
}
/** The local calendar date as YYYY-MM-DD. */
export function isoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
/** The local date `days` before `from`, as YYYY-MM-DD. */
export function daysAgo(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() - days);
  return isoDate(date);
}
/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) /
      86_400_000,
  );
}

// Calendar arithmetic on YYYY-MM-DD strings, done in UTC so a date never
// shifts with the device's time zone or a daylight-saving change.
const DAY_MS = 86_400_000;
const atUtc = (date: string) => new Date(date + "T00:00:00Z");
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** `date` moved by `days` (negative for earlier). */
export function shiftDate(date: string, days: number) {
  return dayOf(new Date(atUtc(date).getTime() + days * DAY_MS));
}

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(date: string) {
  return (atUtc(date).getUTCDay() + 6) % 7;
}

/** The Monday of the week that holds `date`. */
export const weekStart = (date: string) => shiftDate(date, -weekdayIndex(date));

/** True for a real calendar day written as YYYY-MM-DD (no 31 April). */
export function isIsoDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && dayOf(date) === day;
}

/** The last day of `month` (YYYY-MM) as YYYY-MM-DD. */
export function endOfMonth(month: string) {
  const first = atUtc(month + "-01");
  return dayOf(
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)),
  );
}

/**
 * `date` moved by whole months, keeping its day of the month where that
 * month has it and using the month's last day otherwise (31 Jan + 1 = 28 Feb).
 */
export function addMonths(date: string, months: number) {
  const from = atUtc(date);
  const first = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1),
  );
  const month = dayOf(first).slice(0, 7);
  const last = Number(endOfMonth(month).slice(8));
  return `${month}-${String(Math.min(from.getUTCDate(), last)).padStart(2, "0")}`;
}

/**
 * The weekdays' names in the app's language, Monday first: "long" (Monday),
 * "short" (Mon, mån) or "narrow" (M, M).
 */
export const weekdayNames = (
  format: "long" | "short" | "narrow" = "long",
  locale: string = currentLocale(),
) =>
  Array.from({ length: 7 }, (_, i) =>
    dateFormat(locale, { weekday: format, timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, i + 1)),
    ),
  );
