// A plan's whole period in the compact calendar's squares (v6 §D12): one
// Monday-first column per week, with "v. 1", "nu" and "deload" under it.
// Pure, so it is tested (tests/period-calendar.test.ts).
import type { Plan } from "@/data/model";
import { deloadWeeks, phaseWeek } from "@/data/phase";
import { daysBetween, shiftDate, weekStart } from "@/lib/dates";
import { t } from "@/i18n";

export type PeriodColumn = { weekStart: string; days: string[] };

/** The week columns from the Monday of `start`'s week through the week holding `end`. */
export function periodColumns(start: string, end: string): PeriodColumn[] {
  const first = weekStart(start);
  const count = Math.floor(daysBetween(first, end) / 7) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, column) => {
    const monday = shiftDate(first, column * 7);
    return {
      weekStart: monday,
      days: Array.from({ length: 7 }, (_, day) => shiftDate(monday, day)),
    };
  });
}

export type PeriodLabel = { column: number; text: string };

/** Labels closer than this many columns would overlap at 12 px squares. */
const LABEL_SPAN = 3;

/**
 * The words under the columns (0-based): "nu" on the week holding today,
 * "deload" on each deload week and "v. 1" on the first; one that would
 * overlap a stronger one gives way (nu, then deload, then v. 1).
 */
export function periodLabels(
  plan: Pick<Plan, "startDate" | "endDate" | "cycleWeeks" | "weekKinds">,
  today: string,
): PeriodLabel[] {
  const candidates: PeriodLabel[] = [];
  if (today >= plan.startDate && today <= plan.endDate) {
    const now = phaseWeek(plan as Plan, today);
    if (now)
      candidates.push({ column: now.week - 1, text: t("plan.periodNow") });
  }
  for (const week of deloadWeeks(plan))
    candidates.push({ column: week - 1, text: t("plan.periodDeload") });
  candidates.push({ column: 0, text: t("plan.periodWeekOne") });
  const placed: PeriodLabel[] = [];
  for (const label of candidates)
    if (placed.every((p) => Math.abs(p.column - label.column) >= LABEL_SPAN))
      placed.push(label);
  return placed.sort((a, b) => a.column - b.column);
}
