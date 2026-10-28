// A drop (`drop: true`) continues the set above it at a lower weight. These
// rules keep drops attached to a working set. Type-only imports from ./model:
// model.ts imports normalizeDrops from here, and a runtime import would be a cycle.
import type { WorkoutSet } from "./model";
import { hasExtraWeight } from "../lib/set-load";

export type SetTone = "working" | "warmup" | "winddown" | "drop";
export type SetBadgeInfo = {
  text: string;
  tone: SetTone;
  label: string;
  title: string;
};

export const isDrop = (set: WorkoutSet) => set.drop === true;

/**
 * A set and its drops. `start` is the set's index, found by walking back over
 * drops from `index`; `end` is exclusive, just after its last drop.
 */
export function dropGroup(sets: WorkoutSet[], index: number) {
  let start = index;
  while (start > 0 && isDrop(sets[start])) start--;
  let end = start + 1;
  while (end < sets.length && isDrop(sets[end])) end++;
  return { start, end };
}

/**
 * Older app versions show drops as ordinary sets, so they can leave a drop
 * first, after a warm-up or cool-down, or checked on its own. Such a drop
 * becomes an ordinary set instead of making the record invalid.
 */
export function normalizeDrops(sets: WorkoutSet[]): WorkoutSet[] {
  let parent: WorkoutSet | undefined;
  let changed = false;
  const result: WorkoutSet[] = [];
  for (const set of sets) {
    let next = set;
    if (isDrop(set)) {
      const placed =
        parent?.section === "working" &&
        set.section === "working" &&
        set.done === parent.done;
      if (!placed) {
        next = { ...set };
        delete next.drop;
        changed = true;
      }
    }
    if (!isDrop(next)) parent = next;
    result.push(next);
  }
  return changed ? result : sets;
}

// A drop starts at 80% of the weight above it, to the nearest 2.5 kg.
const dropWeight = (weight: number | null) =>
  weight === null ? null : Math.round((weight * 0.8) / 2.5) * 2.5;

/**
 * Adds a blank drop after the set's existing drops. It continues the last row
 * of the group: same load, and 80% of that row's weight.
 */
export function addDrop(sets: WorkoutSet[], setId: string): WorkoutSet[] {
  const index = sets.findIndex((set) => set.id === setId);
  const target = sets[index];
  if (!target || target.done || target.section !== "working") return sets;
  const { end } = dropGroup(sets, index);
  const above = sets[end - 1];
  const extra = hasExtraWeight(above);
  const weight =
    above.load === "weight" || extra ? dropWeight(above.weight) : null;
  // Added weight that rounds down to 0 kg is plain bodyweight.
  const plain = extra && weight === 0;
  const added: WorkoutSet = {
    id: crypto.randomUUID(),
    reps: null,
    weight: plain ? null : weight,
    load: above.load,
    ...(above.measure ? { measure: above.measure } : {}),
    ...(above.extraWeight !== undefined && !plain
      ? { extraWeight: above.extraWeight }
      : {}),
    section: "working",
    done: false,
    drop: true,
  };
  return [...sets.slice(0, end), added, ...sets.slice(end)];
}

/** A set goes with its drops; a drop goes alone. */
export function removeSetOrDrop(sets: WorkoutSet[], setId: string) {
  const index = sets.findIndex((set) => set.id === setId);
  if (index < 0) return sets;
  const end = isDrop(sets[index]) ? index + 1 : dropGroup(sets, index).end;
  return [...sets.slice(0, index), ...sets.slice(end)];
}

/**
 * Moves a set, and the drops after it, to another section. A section other
 * than working has no drops, so they become ordinary sets of that section.
 */
export function changeSection(
  sets: WorkoutSet[],
  setId: string,
  section: WorkoutSet["section"],
) {
  const index = sets.findIndex((set) => set.id === setId);
  const target = sets[index];
  if (!target || target.done || target.section === section) return sets;
  const { end } = dropGroup(sets, index);
  return sets.map((set, i) => {
    if (i < index || i >= end) return set;
    const result = { ...set, section };
    if (section !== "working") delete result.drop;
    return result;
  });
}

/** Working sets are numbered among working sets that are not drops. */
export function setBadge(sets: WorkoutSet[], index: number): SetBadgeInfo {
  const set = sets[index];
  const ordinal = (through: number) =>
    sets
      .slice(0, through + 1)
      .filter((s) => s.section === "working" && !isDrop(s)).length;
  if (isDrop(set))
    return {
      text: "↓",
      tone: "drop",
      label: `Drop after set ${ordinal(dropGroup(sets, index).start)}. Change load or delete`,
      title: "Drop",
    };
  if (set.section === "warmup")
    return {
      text: "W",
      tone: "warmup",
      label: "Warm-up set. Change type, load or delete",
      title: "Warm-up set",
    };
  if (set.section === "winddown")
    return {
      text: "C",
      tone: "winddown",
      label: "Cool-down set. Change type, load or delete",
      title: "Cool-down set",
    };
  const n = ordinal(index);
  return {
    text: String(n),
    tone: "working",
    label: `Set ${n}, working set. Change type, load or delete`,
    title: `Set ${n}`,
  };
}
