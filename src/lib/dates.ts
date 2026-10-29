export function localizedDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  locale?: string,
) {
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, options);
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
