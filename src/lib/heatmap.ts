import { shiftDate } from "../data/summary";

/** The heatmap always shows this many Monday-first week columns, ending with the current week. */
export const HEATMAP_WEEKS = 53;

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(date: string) {
  return (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
}

/** The dates the heatmap covers: the Monday 52 weeks before this week's, through `end`. */
export function heatmapWindow(end: string) {
  return {
    start: shiftDate(end, -weekdayIndex(end) - (HEATMAP_WEEKS - 1) * 7),
    end,
  };
}

/**
 * Week columns ending with the week of `end`. Weeks start on Monday and each
 * has seven slots; the days after `end` are null so the grid keeps its shape.
 */
export function heatmapWeeks(end: string) {
  const window = heatmapWindow(end);
  const weeks: { days: (string | null)[] }[] = [];
  for (let column = 0; column < HEATMAP_WEEKS; column++) {
    const monday = shiftDate(window.start, column * 7);
    weeks.push({
      days: Array.from({ length: 7 }, (_, index) => {
        const date = shiftDate(monday, index);
        return date <= end ? date : null;
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

/** 0 or 1: alternates by calendar month so neighbouring months read apart. */
export function monthTone(date: string) {
  return (Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7))) % 2;
}

/** The most recent day with a workout on or before `now`, or null. */
export function lastWorkoutDate(
  counts: ReadonlyMap<string, number>,
  now: string,
) {
  let last: string | null = null;
  for (const [date, count] of counts)
    if (count > 0 && date <= now && (!last || date > last)) last = date;
  return last;
}

/** The class names that shade a day cell by its workout count, shared by the heatmap and the month grid. */
export function heatClass(count: number) {
  return `heat level-${intensityLevel(count)}`;
}
