/**
 * How fast a lift can reasonably go up over a training phase, and the week by
 * week weights a plan holds. Pure: no records, no dates, no language.
 *
 * The rates follow common strength-training guidance:
 * - Beginners progress linearly, adding weight most sessions: about 2.5 kg a
 *   week on upper-body barbell lifts and 5 kg on lower-body ones, slowing as
 *   the weeks pass (Rippetoe, "Starting Strength", 3rd ed., ch. 8; Rippetoe &
 *   Baker, "Practical Programming for Strength Training", 3rd ed., novice
 *   chapter). We take the weekly, not per-session, figure on purpose: two or
 *   three sessions of a lift a week is not guaranteed.
 * - Intermediates progress weekly or per block: about 0.5–1 % of the load a
 *   week, 2–4 % a month (Practical Programming, intermediate chapter; NSCA,
 *   "Essentials of Strength Training and Conditioning", 4th ed., ch. 17 on
 *   progression and the 2-for-2 rule; ACSM position stand "Progression Models
 *   in Resistance Training for Healthy Adults", Med Sci Sports Exerc 2009,
 *   which suggests 2–10 % load increases when the reps are met, smaller for
 *   trained lifters). We use the middle, 0.75 % a week.
 * - Experienced lifters gain slowly, about 0.25–0.5 % a week (Practical
 *   Programming, advanced chapter; Israetel, Hoffmann & Smith, "Scientific
 *   Principles of Strength Training", 2015). We use 0.375 % a week.
 * - Dumbbells, kettlebells and added weight on bodyweight lifts move in
 *   smaller absolute steps (each hand or the belt carries less), so their
 *   beginner rates are about 40 % of the barbell ones.
 * - High-rep work (more than 12 reps) goes up three quarters as fast: a step
 *   costs more reps there.
 * - A deload week adds nothing and lifts lighter (Practical Programming;
 *   Bell et al., "Deloading practices in strength and physique sports",
 *   Sports Medicine – Open 2023: most coaches cut volume about half and load
 *   about 10 %, every 4–6 weeks).
 * - No week ever adds more than 5 kg, or more than 5 % of the load (7.5 % for
 *   beginners).
 */
import type { Level } from "../data/model";

export type { Level };

/** How the load is carried, which sets its steps and its beginner rate. */
export type LoadClass =
  "barbell" | "dumbbell" | "kettlebell" | "machine" | "bodyweight";

/** The catalogue's equipment as a load class; unknown or missing counts as a barbell. */
export function loadClass(equipment: string | undefined | null): LoadClass {
  switch (equipment) {
    case "dumbbell":
      return "dumbbell";
    case "kettlebell":
      return "kettlebell";
    case "machine":
    case "cable":
    case "band":
      return "machine";
    case "bodyweight":
      return "bodyweight";
    default:
      return "barbell";
  }
}

/**
 * The smallest load step for the equipment at this weight: barbell 2.5 kg
 * (1.25 kg plates a side), dumbbell 2 kg (1 kg under 10 kg), kettlebell 4 kg,
 * machine or cable 2.5 kg (5 kg from 100 kg, where stacks and plates step
 * that way), and 1.25 kg on a belt for added bodyweight.
 */
export function loadIncrement(equipment: string | undefined | null, kg = 0) {
  switch (loadClass(equipment)) {
    case "dumbbell":
      return kg < 10 ? 1 : 2;
    case "kettlebell":
      return 4;
    case "machine":
      return kg >= 100 ? 5 : 2.5;
    case "bodyweight":
      return 1.25;
    default:
      return 2.5;
  }
}

/** `kg` rounded to the nearest step, never below zero. */
export function roundToStep(kg: number, step: number) {
  if (!(step > 0)) return kg;
  return Math.max(0, Math.round(kg / step) * step);
}

/** Lower-body lifts progress faster for beginners: legs and glutes, also as a secondary category. */
export function isLowerBody(exercise: {
  category?: string;
  categories?: readonly string[];
}) {
  const lower = (c: string | undefined) => c === "Legs" || c === "Glutes";
  return lower(exercise.category) || !!exercise.categories?.some(lower);
}

/** Beginner kg a week by load class: upper body, lower body. */
const BEGINNER_KG: Record<LoadClass, [number, number]> = {
  barbell: [2.5, 5],
  machine: [2.5, 5],
  dumbbell: [1, 2],
  kettlebell: [1, 2],
  bodyweight: [1, 2],
};
/** Intermediate and experienced: a share of the current load a week. */
export const PCT_PER_WEEK: Record<Exclude<Level, "beginner">, number> = {
  intermediate: 0.75,
  experienced: 0.375,
};
/** A beginner's rate falls linearly to half over this many progression weeks. */
const BEGINNER_TAPER_WEEKS = 12;
/** The sane maximum for one week: kilograms, and a share of the load. */
export const MAX_STEP_KG = 5;
export const MAX_STEP_PCT = { beginner: 7.5, other: 5 };
/** High-rep work is slower. */
const HIGH_REPS = 12;
const HIGH_REP_FACTOR = 0.75;
/** A target this far past the reasonable gain (and at least one step past it) warns. */
const WARN_SLACK = 1.2;

export type ProgressionInput = {
  exercise: { category?: string; categories?: readonly string[] };
  startKg: number;
  reps: number;
  /** Weeks in the phase. Week 1 lifts startKg. */
  weeks: number;
  /** Week numbers (1-based) that are deload weeks. */
  deloadWeeks: readonly number[];
  level: Level;
  equipment?: string | null;
  /** The user's target, to check against the reasonable rate. */
  targetKg?: number;
  /**
   * The cycle's deload weeks, to continue the pattern past the phase when
   * working out how long a target takes. Defaults to repeating the phase.
   */
  cycle?: readonly boolean[];
};

export type ProgressionSuggestion = {
  lower: boolean;
  loadClass: LoadClass;
  increment: number;
  /** The reasonable gain per training (non-deload) week, averaged over the phase. */
  kgPerWeek: number;
  /** The same as a share of the start load, in percent. */
  pctPerWeek: number;
  /** Where the reasonable rate gets by the phase's last week, on the increment. */
  suggestedTargetKg: number;
  /** The target checked: the user's, or the suggested one. */
  targetKg: number;
  /** True when the target needs clearly more than the reasonable gain. */
  tooFast: boolean;
  /** Weeks the reasonable rate takes to reach the target; null past two years. */
  weeksNeeded: number | null;
};

/** One week's reasonable gain at this load, the `step`th progression week (0-based). */
function reasonableStep(
  kg: number,
  step: number,
  {
    level,
    lower,
    cls,
    reps,
  }: {
    level: Level;
    lower: boolean;
    cls: LoadClass;
    reps: number;
  },
) {
  let gain: number;
  if (level === "beginner") {
    const taper = Math.max(0.5, 1 - step / (2 * BEGINNER_TAPER_WEEKS));
    gain = BEGINNER_KG[cls][lower ? 1 : 0] * taper;
  } else gain = (kg * PCT_PER_WEEK[level]) / 100;
  if (reps > HIGH_REPS) gain *= HIGH_REP_FACTOR;
  const maxPct =
    level === "beginner" ? MAX_STEP_PCT.beginner : MAX_STEP_PCT.other;
  return Math.min(gain, MAX_STEP_KG, (kg * maxPct) / 100);
}

/** True when week `week` (1-based) is a deload week, continuing the pattern past the phase. */
function deloadAt(input: ProgressionInput) {
  const inPhase = new Set(input.deloadWeeks);
  return (week: number) => {
    if (week <= input.weeks) return inPhase.has(week);
    if (input.cycle?.length)
      return !!input.cycle[(week - 1) % input.cycle.length];
    return inPhase.has(((week - 1) % input.weeks) + 1);
  };
}

/** Never-ending weeks at the reasonable rate: the load reached after each week. */
function* reasonableLoads(input: ProgressionInput) {
  const lower = isLowerBody(input.exercise);
  const cls = loadClass(input.equipment);
  const isDeload = deloadAt(input);
  const params = { level: input.level, lower, cls, reps: input.reps };
  let kg = input.startKg;
  let step = 0;
  yield { week: 1, kg };
  for (let week = 2; ; week++) {
    if (!isDeload(week)) kg += reasonableStep(kg, step++, params);
    yield { week, kg };
  }
}

/**
 * The reasonable progression for one lift over a phase, and whether the
 * user's target is faster than that. See the rates at the top of this file.
 */
export function suggestProgression(
  input: ProgressionInput,
): ProgressionSuggestion {
  const lower = isLowerBody(input.exercise);
  const cls = loadClass(input.equipment);
  const increment = loadIncrement(input.equipment, input.startKg);
  const weeks = Math.max(1, Math.floor(input.weeks));
  let endKg = input.startKg;
  for (const { week, kg } of reasonableLoads({ ...input, weeks })) {
    endKg = kg;
    if (week >= weeks) break;
  }
  const gain = endKg - input.startKg;
  const trainingWeeks = Math.max(
    1,
    Array.from({ length: weeks - 1 }, (_, i) => i + 2).filter(
      (w) => !input.deloadWeeks.includes(w),
    ).length,
  );
  const suggestedTargetKg = Math.max(
    input.startKg,
    roundToStep(endKg, increment),
  );
  const targetKg = input.targetKg ?? suggestedTargetKg;
  const needed = targetKg - input.startKg;
  const perStep = needed / trainingWeeks;
  const maxPct =
    input.level === "beginner" ? MAX_STEP_PCT.beginner : MAX_STEP_PCT.other;
  const tooFast =
    needed > 0 &&
    (needed >
      Math.max(
        gain * WARN_SLACK,
        suggestedTargetKg - input.startKg + increment,
      ) +
        1e-9 ||
      perStep > Math.min(MAX_STEP_KG, (input.startKg * maxPct) / 100) + 1e-9);
  let weeksNeeded: number | null = 1;
  if (needed > 0) {
    weeksNeeded = null;
    for (const { week, kg } of reasonableLoads({ ...input, weeks })) {
      if (kg >= targetKg - 1e-9) {
        weeksNeeded = week;
        break;
      }
      if (week >= 104) break;
    }
  }
  return {
    lower,
    loadClass: cls,
    increment,
    kgPerWeek: gain / trainingWeeks,
    pctPerWeek:
      input.startKg > 0 ? (gain / trainingWeeks / input.startKg) * 100 : 0,
    suggestedTargetKg,
    targetKg,
    tooFast,
    weeksNeeded,
  };
}

export type PlannedWeek = {
  week: number;
  kg: number;
  deload: boolean;
  /** True when the user typed this week's weight. */
  edited: boolean;
};

/**
 * The working weight for each week of the phase: week 1 lifts startKg, each
 * training week after it adds an equal share of the way to targetKg (rounded
 * to the increment; the last one is the target), and a deload week holds the
 * week before, lifted `deloadLoadPct` lighter. A typed weight replaces its
 * week without moving the others.
 */
export function plannedWeeks({
  startKg,
  targetKg,
  weeks,
  deloadWeeks,
  increment,
  deloadLoadPct = 10,
  overrides,
}: {
  startKg: number;
  targetKg: number;
  weeks: number;
  deloadWeeks: readonly number[];
  increment: number;
  deloadLoadPct?: number;
  overrides?: Readonly<Record<string, number>>;
}): PlannedWeek[] {
  const total = Math.max(1, Math.floor(weeks));
  const deload = new Set(deloadWeeks);
  const training = Array.from({ length: total }, (_, i) => i + 1).filter(
    (w) => !deload.has(w),
  );
  // Steps after the first training week; the first lifts the start.
  const steps = Math.max(0, training.length - 1);
  const rising = targetKg >= startKg;
  const limit = (kg: number) =>
    rising ? Math.min(kg, targetKg) : Math.max(kg, targetKg);
  const result: PlannedWeek[] = [];
  let done = -1;
  let held = startKg;
  for (let week = 1; week <= total; week++) {
    let kg: number;
    const isDeload = deload.has(week);
    if (isDeload) {
      kg = roundToStep(held * (1 - deloadLoadPct / 100), increment);
    } else {
      done++;
      kg =
        steps === 0 || done === 0
          ? startKg
          : done >= steps
            ? targetKg
            : limit(
                roundToStep(
                  startKg + ((targetKg - startKg) * done) / steps,
                  increment,
                ),
              );
      held = kg;
    }
    const typed = overrides?.[String(week)];
    const edited = typeof typed === "number" && Number.isFinite(typed);
    result.push({ week, kg: edited ? typed : kg, deload: isDeload, edited });
  }
  return result;
}

/** A target from a percentage increase over the start, on the increment. */
export const targetFromPct = (
  startKg: number,
  pct: number,
  increment: number,
) => Math.max(increment, roundToStep(startKg * (1 + pct / 100), increment));

/** The target as a percentage over the start, to one decimal. */
export const pctFromTarget = (startKg: number, targetKg: number) =>
  startKg > 0 ? Math.round(((targetKg - startKg) / startKg) * 1000) / 10 : 0;
