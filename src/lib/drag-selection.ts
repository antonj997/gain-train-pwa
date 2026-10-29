import { daysBetween, localizedDate, shiftDate, weekdayIndex } from "./dates";
import { t } from "../i18n";

/** Hold this long, without moving, before a drag selects dates. */
export const LONG_PRESS_MS = 550;
/** Movement beyond this many px cancels the pending long press. */
export const LONG_PRESS_SLOP = 8;

export type GridCell = { column: number; row: number };

/** What a heatmap drag from one square to another selects. */
export type DragShape = "day" | "week-days" | "weekday" | "period";

/** Same square, same column (one week), same row (one weekday), or any other pair. */
export function dragShape(start: GridCell, end: GridCell): DragShape {
  if (start.column === end.column && start.row === end.row) return "day";
  if (start.column === end.column) return "week-days";
  if (start.row === end.row) return "weekday";
  return "period";
}

export type DragSelection =
  | { kind: "day"; date: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "dates"; dates: string[]; label: string };

/** The heatmap square a date sits in, given the Monday its first column starts on. */
export function heatmapCell(date: string, windowStart: string): GridCell {
  return {
    column: Math.floor(daysBetween(windowStart, date) / 7),
    row: weekdayIndex(date),
  };
}

const short = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/** "Mondays, 7 Sep – 26 Oct" */
export function weekdayLabel(first: string, last: string) {
  const name = localizedDate(first, { weekday: "long" });
  // Swedish writes weekdays in lower case; this one starts the caption.
  const weekday = name.charAt(0).toLocaleUpperCase() + name.slice(1);
  return t("history.weekdays", {
    weekday,
    from: short(first),
    to: short(last),
  });
}

/**
 * The selection a drag between two dates produces in the heatmap. A column
 * is one week (contiguous days), a row is one weekday across weeks (a set of
 * separate dates) and anything else is the continuous period between them.
 */
export function heatmapDragSelection(
  startDate: string,
  endDate: string,
  windowStart: string,
): DragSelection {
  const [first, last] =
    startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const shape = dragShape(
    heatmapCell(startDate, windowStart),
    heatmapCell(endDate, windowStart),
  );
  if (shape === "day") return { kind: "day", date: startDate };
  if (shape === "weekday") {
    const dates: string[] = [];
    for (let d = first; d <= last; d = shiftDate(d, 7)) dates.push(d);
    return { kind: "dates", dates, label: weekdayLabel(first, last) };
  }
  return { kind: "range", from: first, to: last };
}

/** Every date a drag selection covers, for previewing it. */
export function selectionDates(selection: DragSelection) {
  if (selection.kind === "day") return [selection.date];
  if (selection.kind === "dates") return selection.dates;
  const dates: string[] = [];
  for (let d = selection.from; d <= selection.to; d = shiftDate(d, 1))
    dates.push(d);
  return dates;
}

/** The contiguous range a month-calendar drag selects, whichever way it goes. */
export function monthDragRange(startDate: string, endDate: string) {
  return startDate <= endDate
    ? { from: startDate, to: endDate }
    : { from: endDate, to: startDate };
}

/** The first and last date of a selection, which get the stronger ring. */
export function selectionEdges(selection: DragSelection): [string, string] {
  if (selection.kind === "day") return [selection.date, selection.date];
  if (selection.kind === "range") return [selection.from, selection.to];
  const { dates } = selection;
  return [dates[0], dates[dates.length - 1]];
}
