// The exercise page's Overview for a strength exercise: the latest session
// set by set against the one before, the next target, the trend (a verdict,
// a chart per metric and three stats) and the headline records. Pure, so it
// is tested (tests/exercise-overview.test.ts).
//
// Bodyweight exercises compare and estimate on the whole load (loadEstimate:
// the bodyweight logged with the set plus added weight, minus assistance) and
// show it as added weight: "BW + 33 kg", "BW − 12 kg".
import {
  labelSet,
  type RecordDoc,
  type Workout,
  type WorkoutSet,
} from "./model";
import { isDrop } from "./drops";
import { estimate, loadEstimate } from "./estimate";
import {
  exerciseSessions,
  recordsOf,
  type ExerciseSession,
} from "./exercise-records";
import { workoutTargets, type SetTarget } from "./targets";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, shiftDate } from "../lib/dates";
import { countLabel } from "../lib/labels";
import { hasExtraWeight } from "../lib/set-load";
import {
  formatWeight,
  formatWeightValue,
  getWeightUnit,
  weightTotal,
  type WeightUnit,
} from "../lib/units";
import { formatDecimal, formatFixed, t } from "../i18n";

/**
 * What kind of exercise the Overview shows, by the latest working set:
 * weighted; bodyweight with added weight or assistance in some session;
 * plain bodyweight (or no load) counted in reps; or a timed hold.
 */
export type OverviewKind = "weighted" | "bodyweight" | "reps" | "timed";

/**
 * The chart's metrics: the top set's load with its reps (top), the estimated
 * 1RM (e1rm), session volume, total reps or seconds per session (total) and
 * the most reps or seconds in one set (best).
 */
export type Metric = "top" | "e1rm" | "volume" | "total" | "best";

/** An estimated 1RM: of the whole load, and as shown (added weight for bodyweight). */
export type Strength = {
  set: WorkoutSet;
  /** Epley on the whole load, kg. */
  whole: number;
  /** The bodyweight it was worked out with; null for a weighted set. */
  bodyKg: number | null;
  /** What the app shows, kg: the whole load, or for bodyweight the whole load minus the bodyweight. */
  shown: number;
};

/** One session of the exercise as the Overview reads it. */
export type SessionSummary = {
  date: string;
  workoutId: string;
  /** Every working set in logged order, drops included: what "Latest" lists. */
  working: WorkoutSet[];
  /** Working sets of the exercise's kind, without drops: compared and charted. */
  main: WorkoutSet[];
  /** The heaviest set (most added weight, least assistance), then most reps. */
  top: WorkoutSet;
  /** The most reps (seconds for a hold) in one set. */
  best: WorkoutSet;
  /** Reps (or seconds) of the kind's working sets, drops included, in order. */
  counts: number[];
  /** Their sum. */
  total: number;
  /** Weight × reps of the weighted working sets, drops included, kg. */
  volume: number;
  /** The best estimated 1RM of the session, or null without one. */
  strength: Strength | null;
};

export type Overview = {
  kind: OverviewKind;
  /** Oldest first; only sessions with a working set of the kind. */
  sessions: SessionSummary[];
  /** The metrics with something to show, in chip order. */
  metrics: Metric[];
};

const EPSILON = 1e-6;
type Family = "weight" | "body" | "timed";

const familyOf = (set: WorkoutSet): Family =>
  set.measure === "seconds"
    ? "timed"
    : set.load === "weight"
      ? "weight"
      : "body";

/** A working set, drops included; never cardio. */
const isWorking = (set: WorkoutSet) =>
  set.section === "working" && !isCardioSet(set);

/** Working sets that stand on their own: what set-by-set comparisons use. */
export const mainWorkingSets = (sets: readonly WorkoutSet[]) =>
  sets.filter((set) => isWorking(set) && !isDrop(set));

/**
 * A set's load on one signed scale, kg: the weight; for bodyweight the added
 * weight (0 for plain bodyweight or no load); assistance counts below zero.
 */
export function signedLoad(set: WorkoutSet) {
  if (set.load === "weight") return set.weight ?? 0;
  if (set.load === "assisted") return -(set.weight ?? 0);
  return hasExtraWeight(set) ? (set.weight ?? 0) : 0;
}

/**
 * An estimated 1RM worked out on the whole load. A bodyweight set without a
 * bodyweight of its own uses `bodyWeightKg` (the profile's) when there is one.
 */
export function strengthOf(
  set: WorkoutSet,
  bodyWeightKg: number | null = null,
): Strength | null {
  if (set.load === "weight") {
    const whole = estimate(set);
    return whole === null ? null : { set, whole, bodyKg: null, shown: whole };
  }
  const bodyKg = set.bodyWeightKg ?? bodyWeightKg ?? null;
  if (!bodyKg) return null;
  const whole = loadEstimate({ ...set, bodyWeightKg: bodyKg });
  return whole === null ? null : { set, whole, bodyKg, shown: whole - bodyKg };
}

const heavier = (a: WorkoutSet, b: WorkoutSet) => {
  const load = signedLoad(b) - signedLoad(a);
  if (Math.abs(load) > EPSILON) return load > 0 ? b : a;
  return (b.reps ?? 0) > (a.reps ?? 0) ? b : a;
};
const moreReps = (a: WorkoutSet, b: WorkoutSet) =>
  (b.reps ?? 0) > (a.reps ?? 0) ? b : a;

function summarize(
  session: ExerciseSession,
  family: Family,
  bodyWeightKg: number | null,
): SessionSummary | null {
  const working = session.sets.filter(isWorking);
  const main = working.filter(
    (set) => !isDrop(set) && familyOf(set) === family,
  );
  if (!main.length) return null;
  const counted = working.filter((set) => familyOf(set) === family);
  const counts = counted.map((set) => set.reps ?? 0);
  let strength: Strength | null = null;
  if (family !== "timed")
    for (const set of main) {
      const next = strengthOf(set, bodyWeightKg);
      if (next && (!strength || next.whole > strength.whole + EPSILON))
        strength = next;
    }
  return {
    date: session.date,
    workoutId: session.workoutId,
    working,
    main,
    top: family === "timed" ? main.reduce(moreReps) : main.reduce(heavier),
    best: main.reduce(moreReps),
    counts,
    total: counts.reduce((sum, n) => sum + n, 0),
    volume: counted.reduce(
      (sum, set) =>
        set.load === "weight" && set.measure !== "seconds"
          ? sum + (set.weight ?? 0) * (set.reps ?? 0)
          : sum,
      0,
    ),
    strength,
  };
}

/**
 * The Overview of an exercise from its sessions, newest first (as
 * exerciseSessions gives them). Null when no session has a working set.
 * `bodyWeightKg` stands in for sets logged without a bodyweight.
 */
export function exerciseOverview(
  sessionsNewestFirst: readonly ExerciseSession[],
  bodyWeightKg: number | null = null,
): Overview | null {
  let family: Family | null = null;
  for (const session of sessionsNewestFirst) {
    const last = mainWorkingSets(session.sets).at(-1);
    if (last) {
      family = familyOf(last);
      break;
    }
  }
  if (!family) return null;
  const sessions = [...sessionsNewestFirst]
    .reverse()
    .map((session) => summarize(session, family, bodyWeightKg))
    .filter((summary): summary is SessionSummary => summary !== null);
  const kind: OverviewKind =
    family === "weight"
      ? "weighted"
      : family === "timed"
        ? "timed"
        : sessions.some((s) => s.main.some((set) => signedLoad(set) !== 0))
          ? "bodyweight"
          : "reps";
  const hasStrength = sessions.some((s) => s.strength !== null);
  const metrics: Metric[] =
    kind === "weighted"
      ? ["top", ...(hasStrength ? (["e1rm"] as const) : []), "volume"]
      : kind === "bodyweight"
        ? ["top", ...(hasStrength ? (["e1rm"] as const) : []), "total"]
        : ["best", "total"];
  return { kind, sessions, metrics };
}

/** The metric a chart opens on: the top set, or the best set for plain bodyweight and holds. */
export const defaultMetric = (kind: OverviewKind): Metric =>
  kind === "weighted" || kind === "bodyweight" ? "top" : "best";

/** One set's change against the same set last session. */
export type SetDelta =
  | { kind: "more" | "fewer" | "same"; count: number; seconds: boolean }
  | { kind: "heavier" | "lighter" }
  | null;

/**
 * Each standing working set of the latest session against the set at the same
 * index in the previous one: more, fewer or the same reps (seconds for a hold)
 * at the same load. Where the load changed, the first such row says heavier or
 * lighter and the rest say nothing. Null where there is nothing to compare.
 */
export function setDeltas(
  latest: readonly WorkoutSet[],
  previous: readonly WorkoutSet[] | null,
): SetDelta[] {
  let loadShown = false;
  return mainWorkingSets(latest).map((set, index) => {
    const before = previous ? mainWorkingSets(previous)[index] : undefined;
    if (!before) return null;
    const load = signedLoad(set) - signedLoad(before);
    if (Math.abs(load) > EPSILON || familyOf(set) !== familyOf(before)) {
      if (loadShown) return null;
      loadShown = true;
      return { kind: load >= 0 ? "heavier" : "lighter" };
    }
    const reps = (set.reps ?? 0) - (before.reps ?? 0);
    return {
      kind: reps > 0 ? "more" : reps < 0 ? "fewer" : "same",
      count: Math.abs(reps),
      seconds: set.measure === "seconds",
    };
  });
}

/** "+3 more", "−1 fewer", "= same", "new weight", "lighter": the delta's words. */
export function deltaText(delta: Exclude<SetDelta, null>) {
  switch (delta.kind) {
    case "heavier":
      return t("overview.heavier");
    case "lighter":
      return t("overview.lighter");
    case "same":
      return t("overview.same");
    case "more":
      return delta.seconds
        ? t("overview.longer", { n: delta.count })
        : t("overview.more", { count: delta.count });
    case "fewer":
      return delta.seconds
        ? t("overview.shorter", { n: delta.count })
        : t("overview.fewer", { count: delta.count });
  }
}

/** "BW + 33 kg", "BW − 12 kg", "BW": a signed load in kg on the bodyweight scale. */
export function addedLoadLabel(
  kg: number,
  unit: WeightUnit = getWeightUnit(),
  kgDecimals?: number,
) {
  const value = formatWeightValue(Math.abs(kg), unit, kgDecimals);
  if (Number(value.replace(",", ".")) === 0) return t("label.bw");
  return t(kg > 0 ? "label.bwPlus" : "label.bwMinus", { kg: value, unit });
}

/** " in 11 weeks", " in 5 days", or nothing for the same day. */
function periodText(from: string, to: string) {
  const span = spanText(from, to);
  return span ? t("overview.period", { span }) : "";
}
function spanText(from: string, to: string) {
  const days = daysBetween(from, to);
  if (days >= 14) return countLabel(Math.round(days / 7), "week");
  return days > 0 ? countLabel(days, "day") : "";
}

const unbroken = (text: string) => text.replace(/ /g, "\u00a0");

/**
 * One sentence on the trend from the first session to the latest: "Up 7.5 kg
 * in 11 weeks", "From BW × 8 to BW + 10 kg × 7 in 6 weeks", "Same weight, up 2
 * reps in 3 weeks", "Up 3 reps in 6 weeks", or "First session".
 */
export function trendVerdict(overview: Overview) {
  const { kind, sessions } = overview;
  const first = sessions[0];
  const latest = sessions.at(-1);
  if (!first || !latest || sessions.length < 2)
    return t("overview.verdictFirst");
  const period = periodText(first.date, latest.date);
  const amount = (n: number, seconds: boolean) =>
    seconds ? t("label.hold", { n }) : t("records.reps", { count: n });
  const byCount = (a: WorkoutSet, b: WorkoutSet, sameLoad: boolean) => {
    const change = (b.reps ?? 0) - (a.reps ?? 0);
    const seconds = b.measure === "seconds";
    if (!change) {
      const span = spanText(first.date, latest.date);
      return span
        ? t("overview.verdictSame", { span })
        : t("overview.verdictSameDay");
    }
    const key = sameLoad
      ? change > 0
        ? "overview.verdictSameUp"
        : "overview.verdictSameDown"
      : change > 0
        ? "overview.verdictUp"
        : "overview.verdictDown";
    return t(key, { change: amount(Math.abs(change), seconds), period });
  };
  if (kind === "reps" || kind === "timed")
    return byCount(first.best, latest.best, false);
  const load = signedLoad(latest.top) - signedLoad(first.top);
  if (Math.abs(load) <= EPSILON) return byCount(first.top, latest.top, true);
  if (kind === "bodyweight")
    return t("overview.verdictFrom", {
      // Each set stays on one line: the sentence wraps between them.
      from: unbroken(labelSet(first.top, false)),
      to: unbroken(labelSet(latest.top, false)),
      period,
    });
  return t(load > 0 ? "overview.verdictUp" : "overview.verdictDown", {
    change: formatWeight(Math.abs(load)),
    period,
  });
}

/** One point of the chart, in the unit it is drawn in. */
export type ChartPoint = {
  workoutId: string;
  date: string;
  value: number;
  /** The top set's reps (seconds), drawn as a bar under the line: Top set only. */
  bar: number | null;
  session: SessionSummary;
};

/**
 * The chart's points for a metric, oldest first. Loads are in `unit`: the top
 * set's weight (added weight, below zero for assistance, for bodyweight), the
 * estimated 1RM as shown, and volume. Sessions without a value are left out.
 */
export function chartSeries(
  sessions: readonly SessionSummary[],
  metric: Metric,
  unit: WeightUnit = getWeightUnit(),
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const session of sessions) {
    let value: number | null = null;
    let bar: number | null = null;
    if (metric === "top") {
      value = weightTotal(signedLoad(session.top), unit);
      bar = session.top.reps ?? 0;
    } else if (metric === "e1rm")
      value = session.strength
        ? weightTotal(session.strength.shown, unit)
        : null;
    else if (metric === "volume") value = weightTotal(session.volume, unit);
    else if (metric === "total") value = session.total;
    else value = session.best.reps ?? 0;
    if (value !== null)
      points.push({
        workoutId: session.workoutId,
        date: session.date,
        value,
        bar,
        session,
      });
  }
  return points;
}

/** The index of the best point: the highest value, then the most reps, then the latest. */
export function bestPointIndex(points: readonly ChartPoint[]) {
  let best = -1;
  points.forEach((point, index) => {
    if (best < 0) return void (best = index);
    const top = points[best];
    const by = point.value - top.value;
    if (
      by > EPSILON ||
      (Math.abs(by) <= EPSILON && (point.bar ?? 0) >= (top.bar ?? 0))
    )
      best = index;
  });
  return best;
}

/**
 * Round gridline values for a chart from `min` to `max`: steps of 1, 2, 2.5 or
 * 5 times a power of ten (no 2.5 for whole numbers), about four intervals.
 */
export function niceTicks(min: number, max: number, whole = false) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factors = whole && power < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = factors.map((f) => f * power).find((s) => s >= raw - EPSILON)!;
  if (whole) step = Math.max(1, Math.round(step));
  const ticks: number[] = [];
  for (
    let v = Math.ceil(min / step - EPSILON) * step;
    v <= max + EPSILON;
    v += step
  )
    ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** Whether the chart's load values sit on the bodyweight scale ("BW", "+5"). */
const onBodyScale = (kind: OverviewKind, metric: Metric) =>
  kind === "bodyweight" && (metric === "top" || metric === "e1rm");

/** Volume in thousands once the largest value passes 1000: "1.2 t", "3.4 k lb". */
export const volumeInThousands = (points: readonly ChartPoint[]) =>
  points.some((point) => point.value >= 1000);

/**
 * A gridline's label: "80" for a weight, "BW", "+5", "−5" on the bodyweight
 * scale, "1.2 t" for volume in thousands, otherwise the number.
 */
export function axisLabel(
  value: number,
  kind: OverviewKind,
  metric: Metric,
  options: { unit?: WeightUnit; thousands?: boolean } = {},
) {
  const unit = options.unit ?? getWeightUnit();
  const number = (n: number) => formatDecimal(Number(n.toFixed(1)));
  if (onBodyScale(kind, metric)) {
    if (Math.abs(value) < 0.05) return t("label.bw");
    return (value > 0 ? "+" : "−") + number(Math.abs(value));
  }
  if (metric === "volume" && options.thousands)
    return `${formatFixed(value / 1000, 1)} ${unit === "lb" ? "k lb" : "t"}`;
  return number(value);
}

/** A set as the caption reads it: "87.5 kg × 5", "BW + 10 kg × 6", "60 sec". */
const setText = (set: WorkoutSet) => labelSet(set, false);

/** The selected point in words, after its date: what it is and where it came from. */
export function pointCaption(
  point: ChartPoint,
  kind: OverviewKind,
  metric: Metric,
  unit: WeightUnit = getWeightUnit(),
) {
  const { session } = point;
  const seconds = session.top.measure === "seconds";
  const sets = () =>
    t("overview.captionSets", {
      sets: countLabel(session.main.length, "set"),
      counts: session.main.map((set) => set.reps ?? 0).join(", "),
    });
  if (metric === "e1rm" && session.strength) {
    const { set, shown, whole, bodyKg } = session.strength;
    const value =
      bodyKg === null
        ? formatWeight(shown, unit, 1)
        : addedLoadLabel(shown, unit, 1);
    const text = t("overview.captionE1rm", { set: setText(set), value });
    return bodyKg === null
      ? text
      : `${text} ${t("overview.captionWhole", { value: formatWeight(whole, unit, 1) })}`;
  }
  if (metric === "volume") {
    const kg = session.volume;
    const amount = weightTotal(kg, unit);
    const value =
      amount >= 1000
        ? `${formatFixed(amount / 1000, 1)} ${unit === "lb" ? "k lb" : "t"}`
        : `${Math.round(amount)} ${unit}`;
    return t("overview.captionVolume", {
      value,
      sets: countLabel(session.main.length, "set"),
    });
  }
  if (metric === "total")
    return `${session.counts.join(" + ")} = ${
      seconds
        ? t("label.hold", { n: session.total })
        : t("records.reps", { count: session.total })
    }`;
  const set = metric === "best" || kind === "reps" ? session.best : session.top;
  return `${setText(set)} · ${sets()}`;
}

/** The three numbers under the chart. */
export type OverviewStats = {
  /** Sessions in the last 30 days, today included. */
  last30: number;
  /** Standing working sets in the last 4 weeks, divided by 4. */
  setsPerWeek: number;
  total: number;
};

/** Sessions in the last 30 days, sets per week over the last 4 weeks and all sessions. */
export function overviewStats(
  sessions: readonly ExerciseSession[],
  today: string,
): OverviewStats {
  const since30 = shiftDate(today, -30);
  const since28 = shiftDate(today, -28);
  const sets = sessions
    .filter((session) => session.date > since28 && session.date <= today)
    .reduce((sum, session) => sum + mainWorkingSets(session.sets).length, 0);
  return {
    last30: sessions.filter((s) => s.date > since30 && s.date <= today).length,
    setsPerWeek: sets / 4,
    total: sessions.length,
  };
}

/**
 * The next target for the latest session's top set, by the rule the workout
 * uses (workoutTargets in targets.ts): as if a workout started now repeated
 * the latest session's sets. `last` is the set it builds on, for its words.
 */
export function nextTarget(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  exerciseId: string,
  topSetId: string,
  unit: WeightUnit = getWeightUnit(),
): { target: SetTarget; last: WorkoutSet } | null {
  const latest = exerciseSessions(records, exerciseId)[0];
  const index = latest?.sets.findIndex((set) => set.id === topSetId) ?? -1;
  if (!latest || index < 0) return null;
  const sets = latest.sets.map((set, i) => ({
    ...set,
    id: `next-${i}`,
    done: false,
  }));
  const payload: Workout = {
    name: "next",
    date: latest.date,
    duration: null,
    startedAt: null,
    status: "draft",
    exercises: [{ id: "next", exerciseId, name: exerciseId, sets }],
  };
  return (
    workoutTargets(records, { id: "next-workout", payload }, unit).get(
      sets[index].id,
    ) ?? null
  );
}

/** A set as a target reads: last time's set with the target's numbers ("87.5 kg × 6"). */
export const targetText = (target: SetTarget, last: WorkoutSet) =>
  labelSet({ ...last, weight: target.weight, reps: target.reps }, false);

/** One row of the Overview's Records card. */
export type OverviewRecord = {
  key: string;
  title: string;
  value: string;
  /** Small text under the value, such as the whole load. */
  sub?: string;
  date: string;
  /** The headline record carries the Record pill. */
  pill?: boolean;
};

/**
 * The Overview's headline records. Weighted and bodyweight with added weight:
 * heaviest lift, most reps (at any load) and the estimated 1RM (for bodyweight
 * on the whole load, shown as added weight). Plain bodyweight: most reps in a
 * set and in a session. Holds: the longest set and the most time in a session.
 */
export function overviewRecords(
  overview: Overview,
  sessionsNewestFirst: readonly ExerciseSession[],
  unit: WeightUnit = getWeightUnit(),
): OverviewRecord[] {
  const rows: OverviewRecord[] = [];
  const { kind, sessions } = overview;
  const mostIn = (pick: (s: SessionSummary) => number) =>
    sessions.reduce<SessionSummary | null>(
      (best, s) => (!best || pick(s) > pick(best) ? s : best),
      null,
    );
  if (kind === "reps" || kind === "timed") {
    const set = mostIn((s) => s.best.reps ?? 0);
    const session = mostIn((s) => s.total);
    const seconds = kind === "timed";
    if (set)
      rows.push({
        key: "set",
        title: t(seconds ? "overview.longestSet" : "overview.mostRepsSet"),
        value: setText(set.best),
        date: set.date,
        pill: true,
      });
    if (session)
      rows.push({
        key: "session",
        title: t(
          seconds ? "overview.mostTimeSession" : "overview.mostRepsSession",
        ),
        value: seconds
          ? t("label.hold", { n: session.total })
          : t("records.reps", { count: session.total }),
        date: session.date,
      });
    return rows;
  }
  const records = recordsOf([...sessionsNewestFirst].reverse());
  if (records.heaviest)
    rows.push({
      key: "heaviest",
      title: t("overview.heaviest"),
      value: setText(records.heaviest.set),
      date: records.heaviest.date,
      pill: true,
    });
  if (records.mostReps)
    rows.push({
      key: "reps",
      title: t("overview.mostReps"),
      value: setText(records.mostReps.set),
      date: records.mostReps.date,
    });
  const strongest = mostIn((s) => s.strength?.whole ?? -Infinity);
  const strength = strongest?.strength;
  if (strongest && strength)
    rows.push({
      key: "e1rm",
      title: t("overview.e1rm"),
      value:
        strength.bodyKg === null
          ? formatWeight(strength.shown, unit, 1)
          : addedLoadLabel(strength.shown, unit, 0),
      sub:
        strength.bodyKg === null
          ? undefined
          : t("overview.wholeLoad", {
              value: formatWeight(strength.whole, unit, 1),
            }),
      date: strongest.date,
    });
  return rows;
}

/** The bodyweight the best estimated 1RM was worked out with, for the note under the records. */
export function strengthBodyweight(overview: Overview) {
  let best: Strength | null = null;
  for (const s of overview.sessions)
    if (s.strength && (!best || s.strength.whole > best.whole))
      best = s.strength;
  return best?.bodyKg ?? null;
}
