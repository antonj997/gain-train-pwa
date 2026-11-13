// The workout screen's target per set (mockup v5, B1): the short text under
// Previous ("Target 87.5 × 5") and the one-tap fill from a target or from
// last time's result. Pure, so it is tested (tests/set-target.test.ts).
import { labelSet, type WorkoutSet } from "../data/model";
import type { SetTarget } from "../data/targets";
import { loadKeyOf } from "./load-keys";
import { hasWeightField } from "./set-load";
import { changeSetNumber } from "./set-input";
import { formatWeightValue } from "./units";
import { t } from "../i18n";

/** What a set can be filled from: a result, or a target in its last set's words. */
export type FillSource = Pick<
  WorkoutSet,
  "weight" | "reps" | "load" | "extraWeight" | "measure"
>;

const countKind = (set: Pick<WorkoutSet, "measure">) =>
  set.measure === "seconds"
    ? "seconds"
    : set.measure === "cardio"
      ? "cardio"
      : "reps";

/**
 * A result or target as the narrow Previous column shows it, short because
 * the column headings name the load and the count: "87.5 × 5" for a weight,
 * "+10 × 8" for added weight, "−20 × 8" for assistance, "+10 · 65 s" for a
 * plank with added weight, "65 s" for a plain hold, "BW × 9", "12 reps".
 */
export function shortSetText(
  values: Pick<WorkoutSet, "weight" | "reps">,
  source: FillSource,
) {
  const count = countKind(source);
  const reps = values.reps ?? 0;
  const kg =
    values.weight === null || values.weight === undefined
      ? null
      : formatWeightValue(values.weight);
  const key = loadKeyOf(source as WorkoutSet);
  const load =
    kg === null
      ? null
      : key === "bwplus"
        ? `+${kg}`
        : key === "assisted"
          ? `\u2212${kg}`
          : key === "weight"
            ? kg
            : null;
  if (count === "seconds") {
    const hold = t("label.hold", { n: reps });
    return load === null ? hold : `${load} · ${hold}`;
  }
  if (count === "cardio")
    return labelSet({ ...(source as WorkoutSet), ...values }, false);
  if (load !== null) return `${load} × ${reps}`;
  if (key === "none") return t("label.noneReps", { n: reps });
  return t("label.bwReps", { n: reps });
}

/** The target as the Previous column shows it (shortSetText). */
export const targetValueText = (target: SetTarget, source: FillSource) =>
  shortSetText(target, source);

/** "Target 87.5 × 5", "Mål 87,5 × 5". */
export const targetRowText = (target: SetTarget, source: FillSource) =>
  t("target.label", { value: targetValueText(target, source) });

/** The target as a set to fill from: last time's set with the target's numbers. */
export const targetSource = (
  target: SetTarget,
  last: FillSource,
): FillSource => ({ ...last, weight: target.weight, reps: target.reps });

/**
 * An unchecked set filled from `source` in one go: the weight when both have
 * the same kind of load (a weight, added weight or assistance), and the reps
 * (or seconds) when both count the same way. Anything else stays as it is;
 * a checked or cardio set is returned unchanged.
 */
export function fillFrom(set: WorkoutSet, source: FillSource): WorkoutSet {
  if (set.done || countKind(set) === "cardio") return set;
  let next = set;
  if (
    hasWeightField(set) &&
    source.weight !== null &&
    source.weight !== undefined &&
    loadKeyOf(source as WorkoutSet) === loadKeyOf(set)
  )
    next = changeSetNumber(next, "weight", source.weight);
  if (
    source.reps !== null &&
    source.reps !== undefined &&
    source.reps > 0 &&
    countKind(source) === countKind(set)
  )
    next = changeSetNumber(next, "reps", source.reps);
  return next;
}
