// The rules behind the muscle drawings (src/components/muscles/): which zones
// the small exercise icon is split into, which side of the body it shows, and
// which colour a shape of the detailed map takes. Ported from the approved UX
// demo ("Övningsikoner och muskelkartor"), so the drawings match it.
import {
  MUSCLES,
  type ExerciseMuscles,
  type Muscle,
  type MuscleLevel,
} from "@/data/muscles";
import { heatStep, type MuscleSets } from "@/data/muscle-map";

export type FigureView = "front" | "back";

/**
 * The small icon's zones and the muscles each one holds (the demo's `SEG`).
 * Zones are parts of the body, not muscle shapes: the torso in pecs and core
 * (front) or traps, mid back and lower back (back), the arm in shoulder, upper
 * arm and forearm, the leg in glutes (from behind), thigh and calf.
 */
export const ICON_ZONES = {
  shoulders: ["frontDelts", "sideDelts", "rearDelts"],
  upperArm: ["biceps", "brachialis", "triceps"],
  forearms: ["forearms"],
  chest: ["chest", "upperChest"],
  core: ["abs", "obliques"],
  traps: ["traps"],
  midBack: ["upperBack", "lats"],
  lowerBack: ["lowerBack"],
  glutes: ["glutes", "abductors"],
  thighs: ["quads", "hamstrings", "adductors"],
  calves: ["calves", "soleus", "tibialis"],
} as const satisfies Record<string, readonly Muscle[]>;
export type IconZone = keyof typeof ICON_ZONES;

/** Which side a muscle is seen from: 1 the front, -1 the back (the demo's `VIEW_PREF`). */
const VIEW_SIDE: Partial<Record<Muscle, 1 | -1>> = {
  chest: 1,
  upperChest: 1,
  abs: 1,
  obliques: 1,
  quads: 1,
  adductors: 1,
  frontDelts: 1,
  sideDelts: 1,
  biceps: 1,
  brachialis: 1,
  tibialis: 1,
  traps: -1,
  upperBack: -1,
  lats: -1,
  lowerBack: -1,
  glutes: -1,
  abductors: -1,
  hamstrings: -1,
  triceps: -1,
  rearDelts: -1,
  calves: -1,
  soleus: -1,
};

/**
 * Muscles that only show from one side (the demo's `ONLY`): the chest and core
 * from the front, the back and the glutes from behind.
 */
const ONLY_SIDE: Partial<Record<Muscle, 1 | -1>> = {
  chest: 1,
  upperChest: 1,
  abs: 1,
  obliques: 1,
  traps: -1,
  upperBack: -1,
  lats: -1,
  lowerBack: -1,
  glutes: -1,
  abductors: -1,
};

const trained = (muscles: ExerciseMuscles) =>
  (Object.entries(muscles) as [Muscle, MuscleLevel | undefined][]).filter(
    (entry): entry is [Muscle, MuscleLevel] => entry[1] !== undefined,
  );

/**
 * The side the small icon shows (the demo's `miniView`, with a main muscle
 * ranked 1 and a helping muscle 0.5): the side where the main muscles sit; a
 * tie goes to the side that shows more of what is trained (chest and core only
 * show from the front, the back and glutes only from behind), then the front.
 */
export function figureView(muscles: ExerciseMuscles): FigureView {
  const entries = trained(muscles);
  const top = Math.max(0, ...entries.map(([, level]) => level));
  const main = entries
    .filter(([, level]) => level === top)
    .reduce((sum, [muscle]) => sum + (VIEW_SIDE[muscle] ?? 0), 0);
  const shown = entries.reduce(
    (sum, [muscle, level]) => sum + level * (ONLY_SIDE[muscle] ?? 0),
    0,
  );
  return (main || shown) < 0 ? "back" : "front";
}

/** How much an exercise trains a zone: its most trained muscle's level, or 0. */
export function zoneLevel(
  muscles: ExerciseMuscles,
  zone: IconZone,
): 0 | MuscleLevel {
  let level: 0 | MuscleLevel = 0;
  for (const muscle of ICON_ZONES[zone])
    if ((muscles[muscle] ?? 0) > level) level = muscles[muscle]!;
  return level;
}

/**
 * The colour of a detailed-map shape that covers several muscles (the demo's
 * `pick`): the fill of its highest-ranked muscle that has one (rank 1 when not
 * given; the first wins a tie), or undefined when none has a fill.
 */
export function pickFill(
  muscles: readonly Muscle[],
  fills: Partial<Record<Muscle, string>>,
  rank?: Partial<Record<Muscle, number>>,
): string | undefined {
  let best: string | undefined;
  let bestRank = -1;
  for (const muscle of muscles) {
    const fill = fills[muscle];
    const r = rank?.[muscle] ?? 1;
    if (fill && r > bestRank) {
      bestRank = r;
      best = fill;
    }
  }
  return best;
}

/** A detailed map's colours: a fill per muscle and the rank that wins a shared shape. */
export type MapFills = {
  fills: Partial<Record<Muscle, string>>;
  rank: Partial<Record<Muscle, number>>;
};

/**
 * An exercise's map: main muscles red (rank 2), helping ones light pink
 * (rank 1), so a shape covering both shows the main muscle.
 */
export function exerciseMapFills(muscles: ExerciseMuscles): MapFills {
  const fills: MapFills["fills"] = {};
  const rank: MapFills["rank"] = {};
  for (const muscle of MUSCLES) {
    const level = muscles[muscle];
    if (!level) continue;
    fills[muscle] = level === 1 ? "var(--gt-map-main)" : "var(--gt-map-help)";
    rank[muscle] = level === 1 ? 2 : 1;
  }
  return { fills, rank };
}

/**
 * A week's map: each muscle in the heat step of its hard sets (heatStep),
 * ranked by its sets so a shared shape shows the most trained muscle.
 */
export function weekMapFills(sets: MuscleSets): MapFills {
  const fills: MapFills["fills"] = {};
  const rank: MapFills["rank"] = {};
  for (const muscle of MUSCLES) {
    const value = sets[muscle] ?? 0;
    const step = heatStep(value);
    if (!step) continue;
    fills[muscle] = `var(--gt-heat-${step})`;
    rank[muscle] = value;
  }
  return { fills, rank };
}
