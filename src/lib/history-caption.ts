import { localizedDate } from "./dates";
import { lastWorkoutDate } from "./heatmap";
import { countLabel } from "./labels";
import { type HistoryCalendarState } from "./history-calendar";
import { t, formatFixed } from "../i18n";
import { weightTotal, type WeightUnit } from "./units";

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

/** A chosen period's dates, short: "2–9 Nov", or "30 Oct–5 Nov" across months. */
export function periodRangeLabel(from: string, to: string) {
  const day = (date: string) => localizedDate(date, { day: "numeric" });
  const month = (date: string) => localizedDate(date, { month: "short" });
  if (from === to) return shortDate(from);
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${day(from)}–${day(to)} ${month(to)}`
    : `${shortDate(from)}–${shortDate(to)}`;
}

/**
 * Volume for a small tile, as a number and a short unit, so it fits a quarter
 * of a 360px card: plain kg under a tonne ("850 kg"), then tonnes with one
 * decimal ("18,6 t") and whole tonnes from 100 ("186 t", "1234 t"). Pounds go
 * by the thousand ("41,1k lb"). Four digits and more get a smaller type.
 */
export function volumeTile(kg: number, unit: WeightUnit) {
  const total = weightTotal(Math.max(0, kg), unit);
  if (Math.round(total) < 1000)
    return { value: String(Math.round(total)), unit };
  const tenths = Math.round(total / 100) / 10;
  const value =
    tenths < 100 ? formatFixed(tenths, 1) : String(Math.round(total / 1000));
  return { value, unit: unit === "kg" ? "t" : "k lb" };
}
