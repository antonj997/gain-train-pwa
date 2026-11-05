import { localizedDate } from "./dates";
import { catalogue } from "../data/catalogue";
import { exerciseStats, progressFor } from "../data/analytics";
import { favouriteIds, ownExercises } from "../data/exercises";
import { labelSet, type RecordDoc } from "../data/model";
import { completedWorkouts } from "../data/selectors";
import {
  matchesFacets,
  searchExercises,
  type ExerciseFacets,
} from "./exercise-search";
import { currentLocale, t } from "../i18n";
import { categoryLabel, categoryText } from "./catalogue-labels";

/** One row of the Library's exercise list: a built-in or the user's own. */
export type LibraryExercise = {
  id: string;
  name: string;
  category: string;
  /** Other categories it also trains. */
  categories?: readonly string[];
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
  /** Set while the user's custom exercise is published to the shared library. */
  sharedId?: string;
  /** Shared rows only: the sharer's display name, when they set one. */
  sharedBy?: string;
  /** Date of the newest finished workout that includes it. */
  lastDate: string | null;
  /** Label of the best set, such as "100 kg × 5". */
  best: string | null;
};

export type ExerciseFilter = "all" | "mine" | "recent" | "hidden";

/**
 * Every exercise the Library lists: the catalogue and the user's own, with
 * whether each is hidden or a favourite, when it was last trained and its
 * best set.
 */
export function libraryExercises(
  records: Record<string, RecordDoc>,
  hidden: ReadonlySet<string>,
): LibraryExercise[] {
  const favourites = favouriteIds(records);
  const lastDates = new Map<string, string>();
  for (const r of completedWorkouts(records))
    for (const ex of r.payload.exercises)
      if (!lastDates.has(ex.exerciseId))
        lastDates.set(ex.exerciseId, r.payload.date);
  const bests = new Map(
    progressFor(Object.values(records)).map((item) => [
      item.id,
      labelSet(exerciseStats(item).best.set, false),
    ]),
  );
  const extra = (id: string) => ({
    hidden: hidden.has(id),
    lastDate: lastDates.get(id) ?? null,
    best: bests.get(id) ?? null,
  });
  return [
    ...catalogue.map((e) => ({
      ...e,
      note: "",
      custom: false,
      favourite: favourites.has(e.id),
      ...extra(e.id),
    })),
    ...ownExercises(records).map((e) => ({
      ...e,
      custom: true,
      ...extra(e.id),
    })),
  ];
}

/** A titled part of an exercise list. */
export type ExerciseGroup<T = LibraryExercise> = {
  title: string;
  items: T[];
};

/** What grouping needs to know about an exercise: the Library's or the picker's. */
export type Groupable = {
  name: string;
  category: string;
  categories?: readonly string[];
  favourite: boolean;
};

const RECENT_LIMIT = 5;

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, currentLocale(), { sensitivity: "base" });
const byRecent = (a: LibraryExercise, b: LibraryExercise) =>
  b.lastDate!.localeCompare(a.lastDate!) || byName(a, b);
const nonEmpty = <T>(groups: ExerciseGroup<T>[]) =>
  groups.filter((group) => group.items.length);

/**
 * A list narrowed to one category: favourites whose main category it is,
 * then the other exercises with it as their main category (titled with the
 * category, such as "Legs"), then those that only also train it ("Also
 * trains Legs"). Each part A–Z.
 */
export function categoryGroups<T extends Groupable>(
  items: readonly T[],
  category: string,
): ExerciseGroup<T>[] {
  const main = items.filter((item) => item.category === category);
  const label = categoryLabel(category);
  return nonEmpty([
    {
      title: t("exercises.groupFavourites"),
      items: main.filter((item) => item.favourite).sort(byName),
    },
    {
      title: label,
      items: main.filter((item) => !item.favourite).sort(byName),
    },
    {
      title: t("exercises.groupAlso", { category: label }),
      items: items.filter((item) => item.category !== category).sort(byName),
    },
  ]);
}

/**
 * A list with no category chosen: favourites first, then `recent` (in its
 * order, leaving out favourites) as "Recently used", then the rest A–Z.
 */
export function favouriteGroups<T extends Groupable>(
  items: readonly T[],
  recent: readonly T[] = [],
): ExerciseGroup<T>[] {
  const favourites = items.filter((item) => item.favourite).sort(byName);
  const used = recent.filter((item) => !item.favourite);
  const shown = new Set([...favourites, ...used]);
  return nonEmpty([
    { title: t("exercises.groupFavourites"), items: favourites },
    { title: t("exercises.filterRecent"), items: used },
    {
      title: t("exercises.groupAz"),
      items: items.filter((item) => !shown.has(item)).sort(byName),
    },
  ]);
}

/**
 * Exercises matching the search text (see exercise-search.ts), best match first
 * and favourites first among equal matches, narrowed by the chosen filter and
 * by category and equipment. Hidden exercises show only under the Hidden filter.
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
            (filter === "mine" && item.custom) ||
            (filter === "recent" && item.lastDate !== null)),
      )
      .sort(byName),
    query,
    (item) => item.favourite,
  );
}

/**
 * The groups the list shows. With no category chosen: favourites, then
 * "Recently used" with the five other exercises trained last, newest first,
 * and "A–Z" with the rest. With a category: see categoryGroups. The Recently
 * used filter shows every exercise that has been trained, newest first, in
 * one group.
 */
export function groupExercises(
  items: readonly LibraryExercise[],
  filter: ExerciseFilter = "all",
  /** Searching keeps the best match first, in one group. */
  searching = false,
  /** The chosen category filter, if any. */
  category = "",
): ExerciseGroup[] {
  if (searching)
    return items.length
      ? [{ title: t("exercises.groupResults"), items: [...items] }]
      : [];
  if (filter === "hidden")
    return items.length
      ? [{ title: t("exercises.filterHidden"), items: [...items].sort(byName) }]
      : [];
  const used = items.filter((item) => item.lastDate !== null).sort(byRecent);
  if (filter === "recent")
    return used.length
      ? [{ title: t("exercises.filterRecent"), items: used }]
      : [];
  if (category) return categoryGroups(items, category);
  return favouriteGroups(
    items,
    used.filter((item) => !item.favourite).slice(0, RECENT_LIMIT),
  );
}

/** "today" or a short date such as "Mon 26 Oct". */
export function lastUsedLabel(date: string, now: string) {
  return date === now
    ? t("common.today")
    : localizedDate(date, { weekday: "short", day: "numeric", month: "short" });
}

/** The muted line under an exercise: categories, last date and best set. */
export function exerciseSub(item: LibraryExercise, now: string) {
  return [
    categoryText(item.category, item.categories),
    item.lastDate
      ? t("exercises.lastUsed", { when: lastUsedLabel(item.lastDate, now) })
      : t("exercises.neverLogged"),
    item.best && t("exercises.bestSet", { set: item.best }),
  ]
    .filter(Boolean)
    .join(" · ");
}
