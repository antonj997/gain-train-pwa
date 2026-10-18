import { type RecordDoc, type Workout } from "../data/model";
import { shiftDate } from "../data/summary";

function parseMonth(month: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    Number(month.slice(0, 4)) < 1900
  )
    throw new RangeError("Choose a valid calendar month.");
  return new Date(month + "-01T12:00:00Z");
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
    const workout = record.payload as Workout;
    if (workout.status !== "completed") continue;
    dates.set(workout.date, (dates.get(workout.date) ?? 0) + 1);
  }
  return dates;
}
