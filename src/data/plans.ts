import {
  groupSchema,
  type Plan,
  type RecordDoc,
  type RoutineGroup,
} from "./model";
import {
  addMonths,
  daysBetween,
  shiftDate,
  weekStart,
  weekdayIndex,
} from "../lib/dates";

/**
 * Plan cells are plain strings: a routine's id, "rest", "type:<day type id>",
 * "group:<group id>", or null for nothing. The server only checks their shape.
 */
export const REST = "rest";
export const typeCell = (id: string) => "type:" + id;
export const groupCell = (id: string) => "group:" + id;

/** A kind of training day that suggests exercises from catalogue categories. */
export type DayType = { id: string; label: string; categories: string[] };
export const dayTypes: DayType[] = [
  { id: "legs", label: "Legs", categories: ["Legs", "Glutes"] },
  { id: "push", label: "Push", categories: ["Chest", "Shoulders", "Arms"] },
  { id: "pull", label: "Pull", categories: ["Back", "Arms"] },
  {
    id: "upper",
    label: "Upper",
    categories: ["Chest", "Back", "Shoulders", "Arms"],
  },
  { id: "lower", label: "Lower", categories: ["Legs", "Glutes"] },
  {
    id: "full",
    label: "Full body",
    categories: ["Full body", "Chest", "Back", "Legs", "Shoulders"],
  },
  { id: "cardio", label: "Cardio", categories: ["Cardio"] },
];

export type PlanItem = Plan & { id: string };

/** The user's plans that are not deleted, earliest period first. */
export function activePlans(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): PlanItem[] {
  const all = Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);
  return all
    .flatMap((r) =>
      r.kind === "plan" && !r.deleted ? [{ ...r.payload, id: r.id }] : [],
    )
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name),
    );
}

type Period = Pick<Plan, "startDate" | "endDate">;
type PlanLike = Period & Pick<Plan, "cycleWeeks" | "template" | "overrides">;

/** The template's cell for a date, looping the cycle from the plan's first week. */
function templateCell(plan: PlanLike, date: string) {
  const weeks = Math.floor(
    daysBetween(weekStart(plan.startDate), weekStart(date)) / 7,
  );
  const row =
    plan.template[
      ((weeks % plan.cycleWeeks) + plan.cycleWeeks) % plan.cycleWeeks
    ];
  return row?.[weekdayIndex(date)] ?? null;
}

/**
 * What the plans say about a date: the plan whose period holds it, the cell
 * (dated overrides first, then the looping template) and whether an override
 * set it. Null when no plan covers the date. A cell of null means a plan covers
 * the day but nothing is planned.
 */
export function plannedFor<T extends PlanLike>(
  plans: readonly T[],
  date: string,
): { plan: T; cell: string | null; override: boolean } | null {
  const plan = plans.find((p) => p.startDate <= date && date <= p.endDate);
  if (!plan) return null;
  if (date in plan.overrides)
    return { plan, cell: plan.overrides[date] ?? null, override: true };
  return { plan, cell: templateCell(plan, date), override: false };
}

/** A plan whose period shares a day with `period`, ignoring the plan with id `ignoreId`. */
export function findOverlap<T extends Period & { id: string }>(
  plans: readonly T[],
  period: Period,
  ignoreId?: string,
): T | null {
  return (
    plans.find(
      (p) =>
        p.id !== ignoreId &&
        p.startDate <= period.endDate &&
        period.startDate <= p.endDate,
    ) ?? null
  );
}

/** The routine groups saved in the library record, skipping any that are malformed. */
export function groupsOf(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): RoutineGroup[] {
  const all = Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);
  const groups: RoutineGroup[] = [];
  for (const record of all) {
    if (record.kind !== "library" || record.deleted) continue;
    const saved: unknown = record.payload.groups;
    if (!Array.isArray(saved)) continue;
    for (const item of saved) {
      const parsed = groupSchema.safeParse(item);
      if (parsed.success) groups.push(parsed.data);
    }
  }
  return groups;
}

/** A day of a plan, ready for Train: what to show and what can be started. */
export type PlannedDay = {
  kind: "routine" | "rest" | "type" | "group";
  title: string;
  /** Routines that can be started, in order. A routine entry has just itself. */
  routineIds: string[];
  /** Catalogue categories to suggest exercises from; empty for none. */
  categories: string[];
};

type Names = {
  routines: readonly { id: string; payload: { name: string } }[];
  groups: readonly RoutineGroup[];
};

/** A cell as Train shows it. Null for an empty cell or one that points at a deleted routine or group. */
export function resolveCell(
  cell: string | null | undefined,
  { routines, groups }: Names,
): PlannedDay | null {
  if (!cell) return null;
  if (cell === REST)
    return { kind: "rest", title: "Rest day", routineIds: [], categories: [] };
  if (cell.startsWith("type:")) {
    const type = dayTypes.find((t) => t.id === cell.slice(5));
    return type
      ? {
          kind: "type",
          title: type.label,
          routineIds: [],
          categories: type.categories,
        }
      : null;
  }
  if (cell.startsWith("group:")) {
    const group = groups.find((g) => g.id === cell.slice(6));
    if (!group) return null;
    const existing = new Set(routines.map((r) => r.id));
    return {
      kind: "group",
      title: group.name,
      routineIds: group.routineIds.filter((id) => existing.has(id)),
      categories: group.categories,
    };
  }
  const routine = routines.find((r) => r.id === cell);
  return routine
    ? {
        kind: "routine",
        title: routine.payload.name,
        routineIds: [routine.id],
        categories: [],
      }
    : null;
}

/** How a cell reads in the plan editor: empty, "Rest", a name, or "Deleted" for a missing target. */
export function cellText(cell: string | null | undefined, names: Names) {
  if (!cell) return "";
  return cell === REST
    ? "Rest"
    : (resolveCell(cell, names)?.title ?? "Deleted");
}

/** The last day of the default period for an imported plan: three months after `today`. */
export const threeMonthsAfter = (today: string) => addMonths(today, 3);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The plan the earlier, device-only version stored (a Monday-first `weekly`
 * list and a `dated` map), as a synced plan from `today` to three months on
 * with a one-week cycle. Null when the stored text is unreadable or empty.
 */
export function legacyPlanToPlan(
  raw: string | null,
  today: string,
): Plan | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { weekly, dated } = value as { weekly?: unknown; dated?: unknown };
  const endDate = threeMonthsAfter(today);
  const row = Array.from({ length: 7 }, (_, i): string | null => {
    const entry = Array.isArray(weekly) ? weekly[i] : null;
    return typeof entry === "string" && entry ? entry : null;
  });
  const overrides: Record<string, string | null> = {};
  if (typeof dated === "object" && dated !== null && !Array.isArray(dated))
    for (const [date, entry] of Object.entries(dated))
      if (
        ISO_DATE.test(date) &&
        date >= today &&
        date <= endDate &&
        typeof entry === "string" &&
        entry
      )
        overrides[date] = entry;
  if (!row.some(Boolean) && !Object.keys(overrides).length) return null;
  return {
    name: "My plan",
    startDate: today,
    endDate,
    cycleWeeks: 1,
    template: [row],
    overrides,
    goalIds: [],
  };
}

const emptyWeek = (): (string | null)[] => Array(7).fill(null);

/** A new plan: eight empty weeks from the day after the last plan ends, or today. */
export function defaultNewPlan(
  plans: readonly { endDate: string }[],
  today: string,
): Plan {
  const lastEnd = plans.reduce(
    (end, p) => (p.endDate > end ? p.endDate : end),
    "",
  );
  const startDate = lastEnd >= today ? shiftDate(lastEnd, 1) : today;
  return {
    name: "",
    startDate,
    endDate: shiftDate(startDate, 8 * 7 - 1),
    cycleWeeks: 1,
    template: [emptyWeek()],
    overrides: {},
    goalIds: [],
  };
}

/** The plan repeating every `weeks` weeks; weeks it keeps stay as they were. */
export const withCycle = (plan: Plan, weeks: number): Plan => ({
  ...plan,
  cycleWeeks: weeks,
  template: Array.from(
    { length: weeks },
    (_, i) => plan.template[i] ?? emptyWeek(),
  ),
});

/** The plan with one template day set; null empties it. */
export const withTemplateCell = (
  plan: Plan,
  week: number,
  day: number,
  cell: string | null,
): Plan => ({
  ...plan,
  template: plan.template.map((row, w) =>
    w === week ? row.map((c, d) => (d === day ? cell : c)) : row,
  ),
});

/** The plan with a dated change; undefined goes back to the template. */
export function withOverride(
  plan: Plan,
  date: string,
  cell: string | null | undefined,
): Plan {
  const overrides = { ...plan.overrides };
  if (cell === undefined) delete overrides[date];
  else overrides[date] = cell;
  return { ...plan, overrides };
}

/** Dated changes inside the plan's period; ones left outside by a new period are dropped. */
export const trimOverrides = (plan: Plan): Plan["overrides"] =>
  Object.fromEntries(
    Object.entries(plan.overrides).filter(
      ([date]) => date >= plan.startDate && date <= plan.endDate,
    ),
  );
