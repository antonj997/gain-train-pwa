// Calendar's "Gjort" list (v6 C1): finished workouts grouped by week, newest
// first. This week reads "Den här veckan", a week before the plan started is
// marked "före schemat", and weeks older than the last three fold under
// "Äldre veckor" (not while searching). A search keeps the workouts whose
// name, exercises or date match, and the week heads count only those. Pure,
// so it is tested (tests/history-weeks.test.ts).
import type { WorkoutRecord } from "@/data/model";
import { doneSetCount } from "@/data/selectors";
import { localizedDate, shiftDate, weekStart } from "@/lib/dates";
import { exerciseDisplayName } from "@/lib/exercise-name";
import { t } from "@/i18n";

/** Weeks shown open before the rest fold under "Äldre veckor". */
export const OPEN_WEEKS = 3;

const plain = (text: string) =>
  text.toLocaleLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

/** Whether a workout matches a search: its name, an exercise's name (either language) or its date as text. */
export function matchesQuery(
  workout: Pick<WorkoutRecord, "payload">,
  query: string,
) {
  const q = plain(query);
  if (!q) return true;
  const { name, date, exercises } = workout.payload;
  const texts = [
    name,
    ...exercises.flatMap((ex) => [
      ex.name,
      exerciseDisplayName(ex.exerciseId, ex.name),
    ]),
    localizedDate(date, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    localizedDate(date, { day: "numeric", month: "short" }),
    date,
  ];
  return texts.some((text) => plain(text).includes(q));
}

/** "Den här veckan", or the Monday–Sunday span such as "19–25 okt". */
export function weekTitle(week: string, now: string) {
  if (week === weekStart(now)) return t("history.thisWeek");
  const end = shiftDate(week, 6);
  const day = (date: string) => localizedDate(date, { day: "numeric" });
  const month = (date: string) =>
    localizedDate(date, { month: "short" }).replace(/\./g, "");
  return month(week) === month(end)
    ? `${day(week)}–${day(end)} ${month(end)}`
    : `${day(week)} ${month(week)}–${day(end)} ${month(end)}`;
}

export type UpcomingDay = {
  date: string;
  title: string;
  /** The plan's week (1-based) the day falls in. */
  week: number;
};

/**
 * Calendar's "Planerat" list: the planned workout days from today over the
 * next `days` days, today's first (left out once a workout is done today).
 * `at` says what a date plans (null for nothing, a rest day or a deleted
 * routine) and the plan's week for it.
 */
export function upcomingPlanned(
  at: (date: string) => { title: string; week: number } | null,
  today: string,
  doneToday: boolean,
  days = 14,
): UpcomingDay[] {
  const out: UpcomingDay[] = [];
  for (let i = doneToday ? 1 : 0; i < days; i++) {
    const date = shiftDate(today, i);
    const found = at(date);
    if (found) out.push({ date, ...found });
  }
  return out;
}

export type HistoryWeek = {
  /** The week's Monday. */
  key: string;
  label: string;
  summary: { workouts: number; sets: number; records: number };
  /** The week ended before the plan started: "· före schemat". */
  beforePlan: boolean;
  /** Folds under "Äldre veckor". */
  older: boolean;
  items: WorkoutRecord[];
};

/**
 * The finished workouts in weeks, newest first, each with its summary.
 * `recordsOf` counts a workout's records for "· 1 rekord".
 */
export function historyWeeks(
  workouts: readonly WorkoutRecord[],
  today: string,
  plan: { startDate: string } | null,
  query: string,
  recordsOf: (workoutId: string) => number = () => 0,
): HistoryWeek[] {
  const searching = !!plain(query);
  const matching = workouts.filter((w) => matchesQuery(w, query));
  const keys = [
    ...new Set(matching.map((w) => weekStart(w.payload.date))),
  ].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys.map((key, index) => {
    const items = matching
      .filter((w) => weekStart(w.payload.date) === key)
      .sort(
        (a, b) =>
          b.payload.date.localeCompare(a.payload.date) ||
          (b.payload.completedAt ?? 0) - (a.payload.completedAt ?? 0),
      );
    return {
      key,
      label: weekTitle(key, today),
      summary: {
        workouts: items.length,
        sets: items.reduce((sum, w) => sum + doneSetCount(w.payload), 0),
        records: items.reduce((sum, w) => sum + recordsOf(w.id), 0),
      },
      beforePlan: !!plan && shiftDate(key, 6) < plan.startDate,
      older: !searching && index >= OPEN_WEEKS,
      items,
    };
  });
}
