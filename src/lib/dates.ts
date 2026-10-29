// Creating an Intl.DateTimeFormat is far slower than using one, and screens
// such as the heatmap format hundreds of dates per render.
const formats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  const key = (locale ?? "") + JSON.stringify(options);
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formats.set(key, format);
  }
  return format;
}

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
