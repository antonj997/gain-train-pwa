/**
 * The warm-up ladder (v6 B6): from the first working set's weight, the empty
 * bar for 10, then 40 % for 8, 60 % for 5 and 80 % for 2, each rounded to
 * the exercise's step and never below the bar, with the plates per side.
 * Other equipment has no bar: three rows at 40, 60 and 80 %. Pure, so it is
 * tested (tests/warmup.test.ts); the sheet is WarmupSheet.tsx.
 */
import type { WorkoutSet } from "../data/model";

/** The plates the app counts with, heaviest first (kg). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
/** The bars the sheet offers (kg); 20 is the default. */
export const BARS = [20, 15, 10] as const;
export const DEFAULT_BAR = 20;

export type WarmupRow = {
  kg: number;
  reps: number;
  /** Plates per side, heaviest first; [] for the empty bar; null without a bar. */
  plates: number[] | null;
  emptyBar: boolean;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The plates per side that make `kg` on a `barKg` bar, greedily from the
 * heaviest; null when they cannot make it exactly (or it is under the bar).
 */
export function platesPerSide(
  kg: number,
  barKg: number,
  plates: readonly number[] = PLATES,
): number[] | null {
  let side = round3((kg - barKg) / 2);
  if (side < 0) return null;
  const sorted = [...plates].sort((a, b) => b - a);
  const out: number[] = [];
  for (const plate of sorted)
    while (side >= plate - 1e-9) {
      out.push(plate);
      side = round3(side - plate);
    }
  return side > 1e-9 ? null : out;
}

const STEPS = [
  { share: 0.4, reps: 8 },
  { share: 0.6, reps: 5 },
  { share: 0.8, reps: 2 },
];

/** The ladder for a first working set of `workKg`, rounded to `step`. */
export function warmupLadder(
  workKg: number,
  step: number,
  barKg: number,
  barbell: boolean,
  plates: readonly number[] = PLATES,
): WarmupRow[] {
  if (!(workKg > 0)) return [];
  const size = step > 0 ? step : 2.5;
  const rows: WarmupRow[] = barbell
    ? [{ kg: barKg, reps: 10, plates: [], emptyBar: true }]
    : [];
  for (const { share, reps } of STEPS) {
    let kg = round3(Math.round((workKg * share) / size) * size);
    if (barbell) kg = Math.max(kg, barKg);
    // Lighter than the work set, and heavier than the row before.
    if (kg >= workKg || kg <= (rows.at(-1)?.kg ?? 0)) continue;
    rows.push({
      kg,
      reps,
      plates: barbell ? platesPerSide(kg, barKg, plates) : null,
      emptyBar: false,
    });
  }
  return rows;
}

/**
 * The exercise's sets with the ladder put in as warm-up sets just before the
 * first working set (after any warm-ups it already has).
 */
export function warmupSets(
  sets: WorkoutSet[],
  ladder: readonly WarmupRow[],
): WorkoutSet[] {
  const at = sets.findIndex((s) => s.section === "working");
  const index = at < 0 ? sets.length : at;
  const added: WorkoutSet[] = ladder.map((row) => ({
    id: crypto.randomUUID(),
    weight: row.kg,
    reps: row.reps,
    load: "weight",
    section: "warmup",
    done: false,
  }));
  return [...sets.slice(0, index), ...added, ...sets.slice(index)];
}

/** "25 + 5": plates per side as the sheet writes them. */
export const platesText = (
  plates: readonly number[],
  format: (n: number) => string,
) => plates.map(format).join(" + ");
