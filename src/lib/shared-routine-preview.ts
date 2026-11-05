import type { RecordDoc, WorkoutSet } from "../data/model";
import { ownExercises } from "../data/exercises";
import { isDrop } from "../data/drops";
import { t, type MessageKey } from "../i18n";
import { categoryLabel } from "./catalogue-labels";
import { countLabel } from "./labels";
import { workoutCategories } from "./workout-name";
import {
  matchingCustom,
  parseSharedPayload,
  parseSharedSet,
  type SharedRoutineRow,
} from "./shared-routines";

type Records = Record<string, RecordDoc>;

/** Any valid id: the preview's sets are never saved. */
const PREVIEW_ID = "00000000-0000-4000-8000-000000000000";

const SECTIONS = [
  ["warmup", "set.optWarmup"],
  ["working", "set.optWorking"],
  ["winddown", "set.optCooldown"],
] as const satisfies readonly (readonly [WorkoutSet["section"], MessageKey])[];

/** "Weight · reps", "Bodyweight · seconds", "Cardio": what a set counts. */
export function setKindLabel(set: WorkoutSet) {
  if (set.measure === "cardio") return t("sharedPreview.cardio");
  const load =
    set.load === "bodyweight"
      ? set.extraWeight
        ? t("sharedPreview.bodyweightPlus")
        : t("sharedPreview.bodyweight")
      : set.load === "assisted"
        ? t("sharedPreview.assisted")
        : t("sharedPreview.weight");
  const count =
    set.measure === "seconds"
      ? t("sharedPreview.seconds")
      : set.holdSec !== undefined
        ? t("sharedPreview.repsHold")
        : t("sharedPreview.reps");
  return `${load} · ${count}`;
}

/**
 * The sets of a shared exercise by structure alone, as there are no values:
 * a headline ("3 sets · 1 warm-up · 1 drop") and a line per set type, warm-up
 * first ("Working · 2 sets · Weight · reps · 1 drop"). A drop counts with
 * the set it continues.
 */
export function sharedSetsSummary(sets: readonly WorkoutSet[]) {
  const real = sets.filter((s) => !isDrop(s));
  if (!real.length) return { headline: t("routine.noSets"), lines: [] };
  const count = (section: WorkoutSet["section"]) =>
    real.filter((s) => s.section === section).length;
  const drops = sets.length - real.length;
  const headline = [
    countLabel(real.length, "set"),
    count("warmup") && t("routine.warmups", { count: count("warmup") }),
    count("winddown") && t("routine.cooldowns", { count: count("winddown") }),
    drops && countLabel(drops, "drop"),
  ]
    .filter(Boolean)
    .join(" · ");
  type Group = { sets: number; drops: number };
  const groups = new Map<string, Group>();
  let current: Group | null = null;
  for (const set of sets) {
    if (isDrop(set) && current) {
      current.drops += 1;
      continue;
    }
    const key = `${set.section}\u0000${setKindLabel(set)}`;
    current = groups.get(key) ?? { sets: 0, drops: 0 };
    current.sets += 1;
    groups.set(key, current);
  }
  const lines = SECTIONS.flatMap(([section, label]) =>
    [...groups.entries()]
      .filter(([key]) => key.startsWith(`${section}\u0000`))
      .map(([key, group]) =>
        [
          t(label),
          countLabel(group.sets, "set"),
          key.slice(section.length + 1),
          group.drops && countLabel(group.drops, "drop"),
        ]
          .filter(Boolean)
          .join(" · "),
      ),
  );
  return { headline, lines };
}

export type SharedPreviewExercise = {
  key: string;
  name: string;
  /** The sharer's own exercise, which adding would create for the user. */
  isNew: boolean;
  headline: string;
  lines: string[];
};

/**
 * What the preview of a shared routine shows: its exercises in order with
 * their sets by structure, whether each custom one is new to the user, the
 * main categories it trains (as a workout's name would pick them) and the
 * set count.
 */
export function sharedRoutinePreview(row: SharedRoutineRow, records: Records) {
  const own = ownExercises(records);
  const parsed = parseSharedPayload(row.payload);
  const custom = new Map<string, string>();
  let sets = 0;
  const exercises = parsed.map((ex, index): SharedPreviewExercise => {
    const planned = ex.sets.flatMap((s) => parseSharedSet(s, PREVIEW_ID) ?? []);
    sets += planned.length;
    if (ex.custom) custom.set(`shared:${index}`, ex.custom.category);
    return {
      key: `${index}`,
      name: ex.name,
      isNew: !!ex.custom && !matchingCustom(ex.custom, own),
      ...sharedSetsSummary(planned),
    };
  });
  const categories = workoutCategories(
    parsed.map((ex, index) => ({
      id: PREVIEW_ID,
      exerciseId: ex.builtin ?? `shared:${index}`,
      name: ex.name,
      sets: ex.sets.flatMap((s) => parseSharedSet(s, PREVIEW_ID) ?? []),
    })),
    custom,
  ).map(categoryLabel);
  return { exercises, categories, sets };
}
