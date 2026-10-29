import { type RecordDoc, type Workout } from "../data/model";
import { shiftDate } from "../data/summary";
import {
  DEFAULT_HEATMAP_SPAN,
  heatmapWindow,
  stepHeatmapEnd,
  type HeatmapSpan,
} from "./heatmap";

function parseMonth(month: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    Number(month.slice(0, 4)) < 1900
  )
    throw new RangeError("Choose a valid calendar month.");
  return new Date(month + "-01T12:00:00Z");
}

function validDate(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < "1900-01-01" ||
    Number.isNaN(new Date(date + "T12:00:00Z").getTime()) ||
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
  )
    throw new RangeError("Choose a valid calendar date.");
  return date;
}

export type HistoryCalendarState = {
  month: string;
  mode: "month" | "range";
  /** "simple" is the activity heatmap. */
  display: "detailed" | "simple";
  /** Heatmap only: how far back it reaches and the last day it shows. */
  span: HeatmapSpan;
  heatEnd: string;
  selectedDate: string | null;
  from: string | null;
  to: string | null;
  activeBound: "from" | "to";
};

export type HistoryCalendarAction =
  | { type: "browse"; month: string }
  | { type: "mode"; mode: HistoryCalendarState["mode"] }
  | { type: "display"; display: HistoryCalendarState["display"] }
  | { type: "span"; span: HeatmapSpan }
  | { type: "shift"; direction: -1 | 1 }
  | { type: "bound"; bound: HistoryCalendarState["activeBound"] }
  | { type: "date"; date: string }
  | { type: "clear" }
  | { type: "reset" };

export function createHistoryCalendar(now: string): HistoryCalendarState {
  return {
    month: validDate(now).slice(0, 7),
    mode: "month",
    display: "simple",
    span: DEFAULT_HEATMAP_SPAN,
    heatEnd: now,
    selectedDate: null,
    from: null,
    to: null,
    activeBound: "from",
  };
}

export function changeHistoryCalendar(
  state: HistoryCalendarState,
  action: HistoryCalendarAction,
  now: string,
): HistoryCalendarState {
  switch (action.type) {
    case "reset":
      return {
        ...createHistoryCalendar(now),
        display: state.display,
        span: state.span,
      };
    case "span":
      return { ...state, span: action.span, selectedDate: null };
    case "shift":
      return {
        ...state,
        heatEnd: stepHeatmapEnd(
          state.heatEnd,
          state.span,
          action.direction,
          now,
        ),
        selectedDate: null,
      };
    case "display":
      // A from–to range only exists in the detailed calendar.
      return action.display === "simple"
        ? {
            ...state,
            display: "simple",
            mode: "month",
            selectedDate: null,
            from: null,
            to: null,
            activeBound: "from",
          }
        : { ...state, display: action.display };
    case "clear":
      return {
        ...state,
        selectedDate: null,
        from: null,
        to: null,
        activeBound: "from",
      };
    case "mode":
      if (action.mode === state.mode) return state;
      return {
        ...state,
        mode: action.mode,
        selectedDate: null,
        from: null,
        to: null,
        activeBound: "from",
      };
    case "bound":
      return { ...state, activeBound: action.bound };
    case "browse": {
      parseMonth(action.month);
      const month =
        action.month > now.slice(0, 7) ? now.slice(0, 7) : action.month;
      return {
        ...state,
        month,
        selectedDate: state.mode === "month" ? null : state.selectedDate,
      };
    }
    case "date": {
      const date = validDate(action.date);
      if (date > now) return state;
      if (state.mode === "month")
        return {
          ...state,
          month: date.slice(0, 7),
          selectedDate: state.selectedDate === date ? null : date,
        };
      const from = state.activeBound === "from" ? date : state.from;
      const to = state.activeBound === "to" ? date : state.to;
      return {
        ...state,
        from: from && to && from > to ? to : from,
        to: from && to && from > to ? from : to,
        activeBound: state.activeBound === "from" ? "to" : "from",
      };
    }
  }
}

export function historyCalendarBounds(
  state: HistoryCalendarState,
  now: string,
) {
  if (state.mode === "range") {
    if (!state.from && !state.to) return null;
    return { start: state.from ?? state.to!, end: state.to ?? state.from! };
  }
  if (state.selectedDate)
    return { start: state.selectedDate, end: state.selectedDate };
  if (state.display === "simple")
    return heatmapWindow(state.heatEnd, state.span);
  const first = parseMonth(state.month);
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  return { start: state.month + "-01", end: last < now ? last : now };
}

export function moveCalendarMonth(month: string, offset: number) {
  const date = parseMonth(month);
  date.setUTCMonth(date.getUTCMonth() + offset);
  if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 9999)
    throw new RangeError("Choose a supported calendar month.");
  return date.toISOString().slice(0, 7);
}

export function calendarCells(month: string) {
  const first = parseMonth(month);
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  );
  const length = Math.ceil((offset + last.getUTCDate()) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const date = shiftDate(month + "-01", index - offset);
    return {
      date,
      day: Number(date.slice(8)),
      inMonth: date.startsWith(month),
    };
  });
}

export function workoutDates(records: readonly RecordDoc[]) {
  const dates = new Map<string, number>();
  for (const record of records) {
    if (record.deleted || record.kind !== "workout") continue;
    const workout = record.payload;
    if (workout.status !== "completed") continue;
    dates.set(workout.date, (dates.get(workout.date) ?? 0) + 1);
  }
  return dates;
}

/** Ends of a visible range band, including row wraps and month boundaries. */
export function calendarRangeEdges(
  cells: ReturnType<typeof calendarCells>,
  index: number,
  bounds: { start: string; end: string } | null,
) {
  const selected = (cell: (typeof cells)[number] | undefined) =>
    !!bounds &&
    !!cell?.inMonth &&
    cell.date >= bounds.start &&
    cell.date <= bounds.end;
  if (!selected(cells[index])) return null;
  return {
    start: index % 7 === 0 || !selected(cells[index - 1]),
    end: index % 7 === 6 || !selected(cells[index + 1]),
  };
}
