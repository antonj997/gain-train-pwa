import { localizedDate } from "./dates";
import {
  matchesFacets,
  searchExercises,
  type ExerciseFacets,
} from "./exercise-search";

/** One row of the Library's exercise list: a built-in or the user's own. */
export type LibraryExercise = {
  id: string;
  name: string;
  category: string;
  /** Built-in exercises only. */
  equipment?: string;
  aliases?: readonly string[];
  /** Hidden from the picker and the lists; the Hidden filter shows it. */
  hidden?: boolean;
  /** Created by the user, so it can be edited. */
  custom: boolean;
  favourite: boolean;
  /** The note on a custom exercise; empty for built-in ones. */
  note: string;
  /** Date of the newest finished workout that includes it. */
  lastDate: string | null;
  /** Label of the best set, such as "100 kg × 5". */
  best: string | null;
};

export type ExerciseFilter = "all" | "yours" | "recent" | "hidden";

export type ExerciseGroup = {
  title: string;
  items: LibraryExercise[];
};

export const RECENT_LIMIT = 5;

const byName = (a: LibraryExercise, b: LibraryExercise) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
const byRecent = (a: LibraryExercise, b: LibraryExercise) =>
  b.lastDate!.localeCompare(a.lastDate!) || byName(a, b);

/**
 * Exercises matching the search text (see exercise-search.ts), best match first,
 * narrowed by the chosen filter and by category and equipment. Hidden exercises
 * show only under the Hidden filter.
 */
export function filterExercises(
  items: readonly LibraryExercise[],
  query: string,
  filter: ExerciseFilter,
  facets: ExerciseFacets = {},
) {
  return searchExercises(
    items
      .filter(
        (item) =>
          (filter === "hidden" ? !!item.hidden : !item.hidden) &&
          matchesFacets(item, facets) &&
          (filter === "all" ||
            filter === "hidden" ||
            (filter === "yours" && item.custom) ||
            (filter === "recent" && item.lastDate !== null)),
      )
      .sort(byName),
    query,
  );
}

/**
 * The groups the list shows. "Recently used" holds the five exercises trained
 * last, newest first, and "A–Z" the rest by name. The Recently used filter
 * shows every exercise that has been trained, newest first, in one group.
 */
export function groupExercises(
  items: readonly LibraryExercise[],
  filter: ExerciseFilter = "all",
  /** Searching keeps the best match first, in one group. */
  searching = false,
): ExerciseGroup[] {
  if (searching)
    return items.length ? [{ title: "Results", items: [...items] }] : [];
  if (filter === "hidden")
    return items.length
      ? [{ title: "Hidden", items: [...items].sort(byName) }]
      : [];
  const used = items.filter((item) => item.lastDate !== null).sort(byRecent);
  if (filter === "recent")
    return used.length ? [{ title: "Recently used", items: used }] : [];
  const recent = used.slice(0, RECENT_LIMIT);
  const shown = new Set(recent);
  const rest = items.filter((item) => !shown.has(item)).sort(byName);
  return [
    { title: "Recently used", items: recent },
    { title: "A–Z", items: rest },
  ].filter((group) => group.items.length);
}

/** "today" or a short date such as "Mon 26 Oct". */
export function lastUsedLabel(date: string, now: string) {
  return date === now
    ? "today"
    : localizedDate(date, { weekday: "short", day: "numeric", month: "short" });
}

/** The muted line under an exercise: category, last date and best set. */
export function exerciseSub(item: LibraryExercise, now: string) {
  return [
    item.category,
    item.lastDate
      ? `last ${lastUsedLabel(item.lastDate, now)}`
      : "never logged",
    item.best && `best ${item.best}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
