import { local, storageKeys, writeStored } from "./storage";

/** A routine id, or "rest". */
export type PlanEntry = string;
export const REST = "rest";

/**
 * The optional training plan: a Monday-to-Sunday template and dated overrides.
 * It lives on this device, per account, and does not sync.
 */
export type TrainingPlan = {
  /** Monday first. Null means nothing planned that weekday. */
  weekly: (PlanEntry | null)[];
  /** ISO date to entry. A dated entry replaces the weekly one for that day. */
  dated: Record<string, PlanEntry>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const emptyPlan = (): TrainingPlan => ({
  weekly: Array<PlanEntry | null>(7).fill(null),
  dated: {},
});

/** True when anything at all is planned. */
export const hasPlan = (plan: TrainingPlan | null): plan is TrainingPlan =>
  !!plan &&
  (plan.weekly.some((entry) => entry !== null) ||
    Object.keys(plan.dated).length > 0);

/** Monday is 0. */
function weekdayIndex(date: string) {
  return (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
}

/** The weekly entry for a date's weekday, ignoring dated overrides. */
export function weeklyFor(plan: TrainingPlan | null, date: string) {
  return plan?.weekly[weekdayIndex(date)] ?? null;
}

/** What is planned for a date: a routine id, "rest", or null for nothing. */
export function plannedFor(
  plan: TrainingPlan | null,
  date: string,
): PlanEntry | null {
  if (!plan) return null;
  return plan.dated[date] ?? weeklyFor(plan, date);
}

/** The plan without dated entries older than `today`. */
export function prunePlan(plan: TrainingPlan, today: string): TrainingPlan {
  return {
    weekly: [...plan.weekly],
    dated: Object.fromEntries(
      Object.entries(plan.dated).filter(([date]) => date >= today),
    ),
  };
}

/** The last date a dated entry can be set: three months after `today`. */
export function planHorizon(today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1 + 3;
  const target = new Date(
    Date.UTC(year + Math.floor(month / 12), month % 12, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(Number(today.slice(8, 10)), lastDay);
  return target.toISOString().slice(0, 8) + String(day).padStart(2, "0");
}

/** Reads a stored plan, dropping anything malformed. Null when nothing is planned. */
export function parsePlan(raw: string | null): TrainingPlan | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { weekly, dated } = value as { weekly?: unknown; dated?: unknown };
  const plan = emptyPlan();
  if (Array.isArray(weekly))
    plan.weekly = plan.weekly.map((_, i) =>
      typeof weekly[i] === "string" && weekly[i] ? weekly[i] : null,
    );
  if (typeof dated === "object" && dated !== null && !Array.isArray(dated))
    for (const [date, entry] of Object.entries(dated))
      if (ISO_DATE.test(date) && typeof entry === "string" && entry)
        plan.dated[date] = entry;
  return hasPlan(plan) ? plan : null;
}

export function readPlan(account: string) {
  return parsePlan(local.getItem(storageKeys.plan(account)));
}

/** Stores the plan after pruning it; an empty plan is removed. Returns false when storage refused. */
export function savePlan(
  account: string,
  plan: TrainingPlan | null,
  today: string,
) {
  const next = plan && prunePlan(plan, today);
  return writeStored(
    storageKeys.plan(account),
    hasPlan(next) ? JSON.stringify(next) : null,
  );
}
