import { inCategory } from "./exercise-search";

/**
 * The category chip row shared by Library → Övningar and the picker (v6
 * §B11, E1): Alla, the seven body groups, then Mina. P6 inserts "Sport"
 * before "mine".
 */
export const CATEGORY_CHIPS = [
  "all",
  "Legs",
  "Glutes",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Core",
  "mine",
] as const;
export type CategoryChip = (typeof CATEGORY_CHIPS)[number];

/** What a chip needs to know about an exercise row. */
export type ChipEntry = {
  category: string;
  /** Other categories it also trains. */
  categories?: readonly string[];
  /** Your own exercise. */
  custom?: boolean;
};

/**
 * Whether the row shows under the chip: Alla shows every row, Mina your own
 * exercises, and a category the rows that train it, as their main category
 * or another.
 */
export function matchesChip(entry: ChipEntry, chip: CategoryChip): boolean {
  if (chip === "all") return true;
  if (chip === "mine") return entry.custom === true;
  return inCategory(entry, chip);
}
