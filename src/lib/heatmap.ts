import { shiftDate } from "../data/summary";
import { local, writeStored } from "./storage";

/** How far back the activity heatmap reaches. */
export type HeatmapSpan = "month" | "3m" | "6m" | "year";

export const HEATMAP_SPANS: readonly {
  value: HeatmapSpan;
  label: string;
  months: number;
  /** Reads after "in the last". */
  phrase: string;
}[] = [
  { value: "month", label: "Month", months: 1, phrase: "month" },
  { value: "3m", label: "3 months", months: 3, phrase: "3 months" },
  { value: "6m", label: "6 months", months: 6, phrase: "6 months" },
  { value: "year", label: "Year", months: 12, phrase: "year" },
];

export const DEFAULT_HEATMAP_SPAN: HeatmapSpan = "3m";
const SPAN_KEY = "gain-train:history-heatmap-span";

export function isHeatmapSpan(value: unknown): value is HeatmapSpan {
  return HEATMAP_SPANS.some((span) => span.value === value);
}

export function readStoredSpan(): HeatmapSpan {
  const value = local.getItem(SPAN_KEY);
  return isHeatmapSpan(value) ? value : DEFAULT_HEATMAP_SPAN;
}

export function storeSpan(span: HeatmapSpan) {
  writeStored(SPAN_KEY, span);
}

export function spanInfo(span: HeatmapSpan) {
  return HEATMAP_SPANS.find((item) => item.value === span)!;
}

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(date: string) {
  return (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
}

/** Calendar-month arithmetic that clamps to the last day (31 Mar - 1 = 28 Feb). */
export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0));
  const target = new Date(
    Date.UTC(
      lastDay.getUTCFullYear(),
      lastDay.getUTCMonth(),
      Math.min(day, lastDay.getUTCDate()),
    ),
  );
  return target.toISOString().slice(0, 10);
}

/** The dates a span ending on `end` covers, both included. */
export function heatmapWindow(end: string, span: HeatmapSpan) {
  return {
    start: shiftDate(addMonths(end, -spanInfo(span).months), 1),
    end,
  };
}

/**
 * Week columns for a span ending on `end`. Weeks start on Monday and each has
 * seven slots; a slot outside the span is null so the grid keeps its shape.
 */
export function heatmapWeeks(end: string, span: HeatmapSpan) {
  const window = heatmapWindow(end, span);
  const first = shiftDate(window.start, -weekdayIndex(window.start));
  const last = shiftDate(end, 6 - weekdayIndex(end));
  const weeks: { days: (string | null)[] }[] = [];
  for (let monday = first; monday <= last; monday = shiftDate(monday, 7)) {
    weeks.push({
      days: Array.from({ length: 7 }, (_, index) => {
        const date = shiftDate(monday, index);
        return date >= window.start && date <= window.end ? date : null;
      }),
    });
  }
  return { ...window, weeks };
}

/**
 * Where month names go: the column holding the 1st of a month. The first
 * column is named too unless the next label is too close to fit beside it.
 */
export function heatmapMonthLabels(
  weeks: readonly { days: (string | null)[] }[],
) {
  const labels: { column: number; month: string }[] = [];
  weeks.forEach((week, column) => {
    const firstOfMonth = week.days.find((date) => date?.endsWith("-01"));
    if (firstOfMonth) labels.push({ column, month: firstOfMonth.slice(0, 7) });
  });
  const firstDate = weeks[0]?.days.find((date) => date !== null);
  if (firstDate && labels[0]?.column !== 0 && (labels[0]?.column ?? 99) >= 3)
    labels.unshift({ column: 0, month: firstDate.slice(0, 7) });
  return labels;
}

/** 0 none, 1 one workout, 2 two, 3 three or more. */
export function intensityLevel(count: number): 0 | 1 | 2 | 3 {
  return count >= 3 ? 3 : count === 2 ? 2 : count === 1 ? 1 : 0;
}

export function countWorkoutsBetween(
  counts: ReadonlyMap<string, number>,
  start: string,
  end: string,
) {
  let total = 0;
  for (const [date, count] of counts)
    if (date >= start && date <= end) total += count;
  return total;
}

/** The end date of the previous (-1) or next (1) span, never past `now`. */
export function stepHeatmapEnd(
  end: string,
  span: HeatmapSpan,
  direction: -1 | 1,
  now: string,
) {
  const target = addMonths(end, direction * spanInfo(span).months);
  if (target > now) return now;
  return target < "1901-01-01" ? end : target;
}
