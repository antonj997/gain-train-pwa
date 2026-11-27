// Library → Scheman's rows (v6 §E2): each plan's status line and word. Pure,
// so it is tested (tests/plans.test.ts).
import type { Plan } from "../data/model";
import { deloadWeeks, phaseWeek, phaseWeeks } from "../data/phase";
import { planDay } from "../data/plans";
import { isWorkoutCell } from "../data/plan-moves";
import { workoutsPerWeek } from "../data/plan-status";
import { t } from "../i18n";
import { localizedDate, shiftDate, weekStart } from "./dates";
import { countLabel } from "./labels";

/** Whole weeks of the plan that have ended, and how many of them were fulfilled. */
export type WeeksFulfilled = { weeksFulfilled: number; weeksFinished: number };

export type PlanRowKind = "active" | "upcoming" | "ended" | "paused";

export type PlanRowStatus = {
  /** "Vecka 4 av 8 · 3 pass i veckan · deload v. 8" and the like. */
  line: string;
  /** "Aktivt" (in the accent), "Kommande", "Avslutat" or "Pausat". */
  word: string;
  kind: PlanRowKind;
};

/** "21 dec": a day and month without the locale's abbreviation dots. */
const dayMonth = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" }).replace(/\./g, "");

/** A month's three-letter name: "jun", "aug". */
const month3 = (date: string) =>
  localizedDate(date, { month: "short" }).replace(/\./g, "").slice(0, 3);

/** "Jun–aug", or "Jun" for a plan inside one month. */
function monthSpan(start: string, end: string) {
  const from = month3(start);
  const to = month3(end);
  const span = from === to ? from : `${from}–${to}`;
  return span.charAt(0).toLocaleUpperCase() + span.slice(1);
}

/** "3 pass i veckan", or "2–3 pass i veckan" when the weeks differ. */
function perWeek(plan: Plan) {
  const count = workoutsPerWeek(plan);
  if (!count) return "";
  return count.min === count.max
    ? t("library.planPerWeek", { count: count.max })
    : t("library.planPerWeekRange", {
        min: count.min,
        max: count.max,
        count: count.max,
      });
}

/**
 * A plan's row in Scheman:
 *
 * - running: "Vecka 4 av 8 · 3 pass i veckan · deload v. 8" (the next
 *   deload week from this one) and "Aktivt";
 * - still to come: "Startar 21 dec · 8 veckor" and "Kommande";
 * - over: "Jun–aug · 11 av 12 veckor fullföljda" (its months and length
 *   without `adherence`) and "Avslutat";
 * - paused: the line it would have, and "Pausat".
 */
export function planRowStatus(
  plan: Plan,
  today: string,
  adherence: WeeksFulfilled | null,
): PlanRowStatus {
  const weeks = phaseWeeks(plan);
  const word = (kind: PlanRowKind) =>
    kind === "active"
      ? t("plan.active")
      : kind === "upcoming"
        ? t("library.planUpcoming")
        : kind === "ended"
          ? t("plan.ended")
          : t("plan.paused");
  const result = (line: string, kind: PlanRowKind): PlanRowStatus => ({
    line,
    word: word(plan.paused ? "paused" : kind),
    kind: plan.paused ? "paused" : kind,
  });
  if (plan.startDate > today)
    return result(
      [
        t("plan.starts", { date: dayMonth(plan.startDate) }),
        countLabel(weeks, "week"),
      ].join(" · "),
      "upcoming",
    );
  if (plan.endDate < today)
    return result(
      [
        monthSpan(plan.startDate, plan.endDate),
        adherence
          ? t("library.planFulfilled", {
              done: adherence.weeksFulfilled,
              weeks: adherence.weeksFinished,
            })
          : countLabel(weeks, "week"),
      ].join(" · "),
      "ended",
    );
  const at = phaseWeek(plan, today);
  const deload = at ? deloadWeeks(plan).find((w) => w >= at.week) : undefined;
  return result(
    [
      at ? t("plan.weekOf", { week: at.week, weeks: at.weeks }) : "",
      perWeek(plan),
      deload ? t("library.planDeloadWeek", { week: deload }) : "",
    ]
      .filter(Boolean)
      .join(" · "),
    "active",
  );
}

/**
 * The plan's whole weeks that have ended by `today` (Monday to Sunday,
 * inside its period), and those in which every planned workout day has a
 * finished workout on its date. A week with nothing planned is fulfilled.
 * Week matching (v6 §D9, which also counts a workout moved within its week)
 * can replace this once it is in.
 */
export function weeksFulfilledOf(
  plan: Plan,
  doneDates: ReadonlySet<string>,
  today: string,
): WeeksFulfilled {
  let weeksFinished = 0;
  let weeksFulfilled = 0;
  const first = weekStart(plan.startDate);
  for (let week = 0; week < phaseWeeks(plan); week++) {
    const monday = shiftDate(first, week * 7);
    const sunday = shiftDate(monday, 6);
    if (sunday >= today) break;
    weeksFinished++;
    let fulfilled = true;
    for (let i = 0; i < 7; i++) {
      const date = shiftDate(monday, i);
      if (date < plan.startDate || date > plan.endDate) continue;
      if (isWorkoutCell(planDay(plan, date).cell) && !doneDates.has(date))
        fulfilled = false;
    }
    if (fulfilled) weeksFulfilled++;
  }
  return { weeksFulfilled, weeksFinished };
}
