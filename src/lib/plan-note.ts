import type { Workout } from "../data/model";
import { formatWeight } from "./units";
import { t } from "../i18n";

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
