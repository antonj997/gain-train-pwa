// Library → Upptäck's focus chips (Library concept, step 13): Push, Pull,
// Ben, Helkropp and Hemma, worked out from the main categories and the
// equipment of what was shared. Pure, so it is tested
// (tests/discover.test.ts).

export const FOCUSES = ["push", "pull", "legs", "full", "home"] as const;
export type Focus = (typeof FOCUSES)[number];

/** What a focus needs to know about an exercise. */
export type FocusItem = {
  category?: string;
  equipment?: string;
  load?: string;
};

const PUSH = new Set(["Chest", "Shoulders"]);
const PULL = new Set(["Back"]);
const LEGS = new Set(["Legs", "Glutes"]);
/** Muscle categories that lean neither way: they count, but decide nothing. */
const NEUTRAL = new Set(["Arms", "Core"]);
/** What a home workout can use: no machine, cable, barbell or Smith. */
const HOME_EQUIPMENT = new Set([
  "bodyweight",
  "band",
  "dumbbell",
  "kettlebell",
]);

/** An exercise that needs nothing a gym has. Without equipment, a bodyweight or no-load one. */
const atHome = (item: FocusItem) =>
  item.equipment
    ? HOME_EQUIPMENT.has(item.equipment)
    : item.load === "bodyweight" || item.load === "none";

/** The focuses one exercise belongs to, for the shared exercises. */
export function exerciseFocuses(item: FocusItem): Set<Focus> {
  const focuses = new Set<Focus>();
  const category = item.category ?? "";
  if (PUSH.has(category)) focuses.add("push");
  if (PULL.has(category)) focuses.add("pull");
  if (LEGS.has(category)) focuses.add("legs");
  if (category === "Full body") focuses.add("full");
  if (atHome(item)) focuses.add("home");
  return focuses;
}

/**
 * The focuses of a routine, by its exercises' main categories:
 * - Ben: at least 60 % of its muscle exercises are legs or glutes;
 * - Push: at least half are chest or shoulders, with no back and under 20 %
 *   legs (Pull the same with back and no chest or shoulders); arms and core
 *   count but lean neither way;
 * - Helkropp: at least half are full-body lifts, or it has at least 20 %
 *   legs and 30 % upper body (push and pull);
 * - Hemma: every exercise needs nothing but bodyweight, bands, dumbbells or
 *   kettlebells.
 * Cardio and Other are not muscle exercises.
 */
export function routineFocuses(items: readonly FocusItem[]): Set<Focus> {
  const focuses = new Set<Focus>();
  if (!items.length) return focuses;
  let push = 0;
  let pull = 0;
  let legs = 0;
  let full = 0;
  let neutral = 0;
  for (const { category = "" } of items) {
    if (PUSH.has(category)) push += 1;
    else if (PULL.has(category)) pull += 1;
    else if (LEGS.has(category)) legs += 1;
    else if (category === "Full body") full += 1;
    else if (NEUTRAL.has(category)) neutral += 1;
  }
  const muscle = push + pull + legs + full + neutral;
  if (muscle) {
    const share = (n: number) => n / muscle;
    if (share(legs) >= 0.6) focuses.add("legs");
    if (share(push) >= 0.5 && !pull && share(legs) < 0.2) focuses.add("push");
    if (share(pull) >= 0.5 && !push && share(legs) < 0.2) focuses.add("pull");
    if (share(full) >= 0.5 || (share(legs) >= 0.2 && share(push + pull) >= 0.3))
      focuses.add("full");
  }
  if (items.every(atHome)) focuses.add("home");
  return focuses;
}

/** Text a search matches, without case: "bench" finds "Bench Press". */
export const matchesSearch = (
  needle: string,
  ...texts: (string | null | undefined)[]
) => {
  const query = needle.trim().toLocaleLowerCase();
  return (
    !query ||
    texts.some((text) => !!text && text.toLocaleLowerCase().includes(query))
  );
};
