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
