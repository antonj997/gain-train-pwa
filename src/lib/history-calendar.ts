import { type RecordDoc, type Workout } from "../data/model";
import {
  addMonths,
  endOfMonth,
  isIsoDay,
  shiftDate,
  weekdayIndex,
} from "./dates";
import { heatmapWindow } from "./heatmap";

// These run during render (the calendars and the History reducer), where a
// throw would take down the whole app. Bad input is ignored instead: an
// invalid month or date reads as null, and actions with one change nothing.

/** True for a month written as YYYY-MM, 1900 or later. */
const validMonth = (month: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= "1900-01";

/** `date` when it is a real calendar day from 1900 on, else null. */
const validDate = (date: string) =>
  isIsoDay(date) && date >= "1900-01-01" ? date : null;

export type HistoryCalendarState = {
  month: string;
  mode: "month" | "range";
  /** "simple" is the activity heatmap. */
  display: "detailed" | "simple";
  selectedDate: string | null;
  from: string | null;
  to: string | null;
  activeBound: "from" | "to";
  /** Separate dates picked by a horizontal heatmap drag, such as every Monday. */
  dates: { dates: string[]; label: string } | null;
};

export type HistoryCalendarAction =
  | { type: "browse"; month: string }
  | { type: "mode"; mode: HistoryCalendarState["mode"] }
  | { type: "display"; display: HistoryCalendarState["display"] }
  | { type: "bound"; bound: HistoryCalendarState["activeBound"] }
  | { type: "date"; date: string }
  | { type: "day"; date: string; toggle?: boolean }
  | { type: "range"; from: string; to: string }
  | { type: "dates"; dates: string[]; label: string }
  | { type: "clear" }
  | { type: "reset" };

export function createHistoryCalendar(now: string): HistoryCalendarState {
  return {
    month: (validDate(now) ?? "1970-01-01").slice(0, 7),
    mode: "month",
    display: "simple",
    selectedDate: null,
    from: null,
    to: null,
    activeBound: "from",
    dates: null,
  };
}

const NO_SELECTION = {
  selectedDate: null,
  from: null,
  to: null,
  activeBound: "from",
  dates: null,
} as const;

export function changeHistoryCalendar(
  state: HistoryCalendarState,
  action: HistoryCalendarAction,
  now: string,
): HistoryCalendarState {
  switch (action.type) {
    case "reset":
      return { ...createHistoryCalendar(now), display: state.display };
    case "display": {
      if (action.display === state.display) return state;
      // A set of weekdays only exists in the heatmap; a half-chosen range
      // cannot be shown there. A day or a finished range goes either way.
      const keepRange = !!state.from && !!state.to;
      const base = { ...state, display: action.display, dates: null };
      if (state.mode === "range" && !keepRange)
        return { ...base, ...NO_SELECTION, mode: "month" };
      if (action.display === "detailed") {
        const shown = state.mode === "range" ? state.from : state.selectedDate;
        return shown ? { ...base, month: shown.slice(0, 7) } : base;
      }
      return base;
    }
    case "clear":
      return { ...state, ...NO_SELECTION };
    case "mode":
      if (action.mode === state.mode) return state;
      return { ...state, ...NO_SELECTION, mode: action.mode };
    case "bound":
      return { ...state, activeBound: action.bound };
    case "browse": {
      if (!validMonth(action.month)) return state;
      const month =
        action.month > now.slice(0, 7) ? now.slice(0, 7) : action.month;
      return {
        ...state,
        month,
        selectedDate: state.mode === "month" ? null : state.selectedDate,
      };
    }
    case "day": {
      const date = validDate(action.date);
      if (!date || date > now) return state;
      return {
        ...state,
        ...NO_SELECTION,
        mode: "month",
        month: date.slice(0, 7),
        selectedDate:
          action.toggle && state.mode === "month" && state.selectedDate === date
            ? null
            : date,
      };
    }
    case "range": {
      const a = validDate(action.from);
      const b = validDate(action.to);
      if (!a || !b || a > now || b > now) return state;
      return {
        ...state,
        ...NO_SELECTION,
        mode: "range",
        from: a <= b ? a : b,
        to: a <= b ? b : a,
      };
    }
    case "dates": {
      const dates = action.dates
        .map(validDate)
        .filter((d): d is string => !!d && d <= now);
      if (!dates.length) return state;
      return {
        ...state,
        ...NO_SELECTION,
        mode: "month",
        dates: { dates: dates.sort(), label: action.label },
      };
    }
    case "date": {
      const date = validDate(action.date);
      if (!date || date > now) return state;
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
  if (state.dates) {
    const { dates } = state.dates;
    return { start: dates[0], end: dates[dates.length - 1] };
  }
  if (state.mode === "range") {
    if (!state.from && !state.to) return null;
    return { start: state.from ?? state.to!, end: state.to ?? state.from! };
  }
  if (state.selectedDate)
    return { start: state.selectedDate, end: state.selectedDate };
  if (state.display === "simple") return heatmapWindow(now);
  if (!validMonth(state.month)) return null;
  const last = endOfMonth(state.month);
  return { start: state.month + "-01", end: last < now ? last : now };
}

/** The month `offset` months on; the same month when that is out of range. */
export function moveCalendarMonth(month: string, offset: number) {
  if (!validMonth(month)) return month;
  const moved = addMonths(month + "-01", offset).slice(0, 7);
  return moved >= "1900-01" && /^\d{4}-/.test(moved) ? moved : month;
}

/** The day cells of a month grid, Monday first; none for an invalid month. */
export function calendarCells(month: string) {
  if (!validMonth(month)) return [];
  const offset = weekdayIndex(month + "-01");
  const length =
    Math.ceil((offset + Number(endOfMonth(month).slice(8))) / 7) * 7;
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

export type HistorySelection =
  | { kind: "day"; date: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "dates"; dates: string[]; label: string };

/** What the person has chosen, or null while History shows the default view. */
export function historySelection(
  state: HistoryCalendarState,
): HistorySelection | null {
  if (state.dates) return { kind: "dates", ...state.dates };
  if (state.mode === "range") {
    const from = state.from ?? state.to;
    const to = state.to ?? state.from;
    return from && to ? { kind: "range", from, to } : null;
  }
  return state.selectedDate ? { kind: "day", date: state.selectedDate } : null;
}

/** The records History lists: those on the chosen day, range or dates, else in the default period. */
export function filterBySelection<T extends { payload: { date: string } }>(
  records: readonly T[],
  state: HistoryCalendarState,
  now: string,
) {
  const selection = historySelection(state);
  if (selection?.kind === "dates") {
    const wanted = new Set(selection.dates);
    return records.filter((r) => wanted.has(r.payload.date));
  }
  const period = historyCalendarBounds(state, now);
  return period
    ? records.filter(
        ({ payload: { date } }) => date >= period.start && date <= period.end,
      )
    : [];
}
