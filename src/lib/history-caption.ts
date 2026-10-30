import { localizedDate } from "./dates";
import { lastWorkoutDate } from "./heatmap";
import { countLabel } from "./labels";
import { type HistoryCalendarState } from "./history-calendar";
import { t } from "../i18n";

const shortDay = (date: string) =>
  localizedDate(date, { weekday: "short", day: "numeric", month: "short" });
const shortDate = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/** The one line under both calendar views: the chosen day, the range, or the latest workout. */
export function historyCaption(
  value: Pick<
    HistoryCalendarState,
    "mode" | "selectedDate" | "from" | "to" | "activeBound"
  > &
    Partial<Pick<HistoryCalendarState, "dates">>,
  counts: ReadonlyMap<string, number>,
  now: string,
) {
  const day = (date: string) =>
    `${shortDay(date)} · ${countLabel(counts.get(date) ?? 0, "workout")}`;
  if (value.dates) {
    const wanted = new Set(value.dates.dates);
    let total = 0;
    for (const [date, count] of counts) if (wanted.has(date)) total += count;
    return `${value.dates.label} · ${countLabel(total, "workout")}`;
  }
  if (value.mode === "range") {
    const { from, to } = value;
    if (!from && !to) return t("history.chooseStart");
    if (!from || !to || from === to) {
      const only = (from ?? to)!;
      return from && to
        ? day(only)
        : t(
            value.activeBound === "to"
              ? "history.chooseEndOf"
              : "history.chooseStartOf",
            { date: shortDate(only) },
          );
    }
    let total = 0;
    for (const [date, count] of counts)
      if (date >= from && date <= to) total += count;
    return `${shortDate(from)} – ${shortDate(to)} · ${countLabel(total, "workout")}`;
  }
  if (value.selectedDate) return day(value.selectedDate);
  const last = lastWorkoutDate(counts, now);
  return last
    ? t("history.lastWorkout", { date: shortDay(last) })
    : t("history.tapDay");
}
