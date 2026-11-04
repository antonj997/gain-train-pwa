import type { Level, Workout } from "../data/model";
import { formatWeight } from "./units";
import { formatDecimal, t } from "../i18n";

/**
 * The muted line a workout card shows for the plan it was started in: "Plan
 * week 3: 85 kg" for a progressed lift, "Deload week: 75 kg" or "Deload week"
 * in a deload week, and nothing otherwise.
 */
export function planNote(
  plan: Workout["plan"],
  exerciseId: string,
): string | undefined {
  if (!plan) return undefined;
  const kg = plan.loads?.[exerciseId];
  if (kg !== undefined)
    return plan.deload
      ? t("planNote.deloadLoad", { weight: formatWeight(kg) })
      : t("planNote.week", { week: plan.week, weight: formatWeight(kg) });
  return plan.deload ? t("planNote.deload") : undefined;
}

/** Kilograms as the plan editor shows them: "82.5", "82,5". Entry is in kg, like goals. */
export const kgText = (kg: number) => formatDecimal(Math.round(kg * 100) / 100);

const levelKey = {
  beginner: "prog.levelBeginner",
  intermediate: "prog.levelIntermediate",
  experienced: "prog.levelExperienced",
} as const;
/** "Beginner", "Nybörjare". */
export const levelLabel = (level: Level) => t(levelKey[level]);

/** "10 % lighter, half the sets": a plan's deload rule in words. */
export function deloadText(deload: { loadPct: number; setsPct: number }) {
  return t("plan.deloadRule", {
    load: deload.loadPct
      ? t("plan.deloadLighter", { pct: deload.loadPct })
      : t("plan.deloadSameLoad"),
    sets:
      deload.setsPct === 50
        ? t("plan.deloadHalfSets")
        : deload.setsPct === 100
          ? t("plan.deloadAllSets")
          : t("plan.deloadSetsPct", { pct: deload.setsPct }),
  });
}
