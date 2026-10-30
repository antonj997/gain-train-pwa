import { t, type MessageKey } from "../i18n";

const NOUNS = {
  set: "count.set",
  "completed set": "count.completedSet",
  "unchecked set": "count.uncheckedSet",
  workout: "count.workout",
  drop: "count.drop",
  exercise: "count.exercise",
  routine: "count.routine",
  session: "count.session",
  day: "count.day",
} as const satisfies Record<string, MessageKey>;
export type CountNoun = keyof typeof NOUNS;

/** "1 set", "3 sets"; in Swedish "3 set", "2 övningar". */
export function countLabel(count: number, noun: CountNoun) {
  return t(NOUNS[noun], { count });
}
/**
 * Every duration the app shows, from a whole number of minutes: "<1 min",
 * "45 min", "1 h 53 min", "2 h". Nothing reads "0 min".
 */
export function durationLabel(minutes: number) {
  const total = Math.round(minutes);
  if (total < 1) return t("duration.underMinute");
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return t("duration.minutes", { m });
  return m ? t("duration.hoursMinutes", { h, m }) : t("duration.hours", { h });
}
/** The Finish sheet's one-line summary of what saving keeps and leaves out. */
export function finishSummary(completed: number, unchecked: number) {
  if (completed === 0) return t("finish.atLeastOne");
  const saved = t("finish.willBeSaved", { sets: countLabel(completed, "set") });
  return unchecked > 0
    ? t("finish.leftOut", {
        saved,
        unchecked: countLabel(unchecked, "unchecked set"),
      })
    : saved;
}
