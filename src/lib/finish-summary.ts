/**
 * The finish sheet's and the reward's numbers (v6 B9, B10): sets done and
 * open, the volume, the strongest record, the workout's place in its week.
 * Pure, so it is tested (tests/finish-summary.test.ts).
 */
import type { Workout } from "../data/model";
import { summarize } from "../data/summary";
import { doneSetCount, setCount } from "../data/selectors";
import { weekStart } from "./dates";
import type { Language } from "../i18n";

/** A record as the sheet says it, strongest first. */
export type FinishRecordLine = {
  /** "Knäböj 100 kg × 6". */
  text: string;
  /** Last best before today, "97,5 kg × 6", or null for a first. */
  previous: string | null;
};

export type FinishSummary = {
  done: number;
  total: number;
  unchecked: number;
  /** Weight × reps of the checked sets, in kg. */
  volumeKg: number;
  /** The strongest record, and how many more there are. */
  record: (FinishRecordLine & { more: number }) | null;
};

/** What the finish sheet and the reward say about the workout. */
export function finishSummary(
  workout: Workout,
  records: readonly FinishRecordLine[],
): FinishSummary {
  const done = doneSetCount(workout);
  const total = setCount(workout);
  const [first, ...rest] = records;
  return {
    done,
    total,
    unchecked: Math.max(0, total - done),
    // The app's own volume rule (summarize): weight × reps, drops included.
    volumeKg: summarize([workout], 1, workout.date).volume,
    record: first ? { ...first, more: rest.length } : null,
  };
}

/** "1:a, 2:a, 3:e …" in Swedish, "1st, 2nd, 3rd …" in English. */
export function weekOrdinal(n: number, language: Language): string {
  const tens = n % 100;
  const last = n % 10;
  if (language === "sv")
    return `${n}:${(last === 1 || last === 2) && tens !== 11 && tens !== 12 ? "a" : "e"}`;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : last === 1
        ? "st"
        : last === 2
          ? "nd"
          : last === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

/**
 * The volume as the app writes it everywhere (v6 B10): whole kilograms with a
 * narrow no-break space between thousands, "6 252".
 */
export function formatVolume(kg: number): string {
  const whole = String(Math.round(Math.max(0, kg)));
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * This workout's number in its week (Monday first): the finished workouts
 * dated in the same week up to `date`, plus this one.
 */
export function weekWorkoutNumber(
  finishedDates: readonly string[],
  date: string,
): number {
  const start = weekStart(date);
  return finishedDates.filter((d) => d >= start && d <= date).length + 1;
}
