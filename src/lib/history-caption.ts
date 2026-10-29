import { localizedDate } from "./dates";
import { lastWorkoutDate } from "./heatmap";
import { countLabel } from "./labels";
import { type HistoryCalendarState } from "./history-calendar";

const shortDay = (date: string) =>
  localizedDate(date, { weekday: "short", day: "numeric", month: "short" });
const shortDate = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/** The one line under both calendar views: the chosen day, the range, or the latest workout. */
export function historyCaption(
  value: Pick<
    HistoryCalendarState,
    "mode" | "selectedDate" | "from" | "to" | "activeBound"
  >,
  counts: ReadonlyMap<string, number>,
  now: string,
) {
  const day = (date: string) =>
    `${shortDay(date)} · ${countLabel(counts.get(date) ?? 0, "workout")}`;
  if (value.mode === "range") {
    const { from, to } = value;
    if (!from && !to) return "Choose a start date";
    if (!from || !to || from === to) {
      const only = (from ?? to)!;
      return from && to
        ? day(only)
        : `${shortDate(only)} · choose the ${value.activeBound === "to" ? "end" : "start"} date`;
    }
    let total = 0;
    for (const [date, count] of counts)
      if (date >= from && date <= to) total += count;
    return `${shortDate(from)} – ${shortDate(to)} · ${countLabel(total, "workout")}`;
  }
  if (value.selectedDate) return day(value.selectedDate);
  const last = lastWorkoutDate(counts, now);
  return last
    ? `Last workout ${shortDay(last)}`
    : "Tap a day to see its workouts";
}
