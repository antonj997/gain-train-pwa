// Library → Övningar's groups (v6 §E1): "Mina övningar" first, then "A–Ö"
// by the name each exercise shows (the Swedish names in Swedish, sorted with
// the language's collation: a–z, then å, ä, ö), narrowed by the category
// chip row. A search is one group, best match first. Pure, so it is tested
// (tests/library.test.ts).
import { currentLocale, t } from "../i18n";
import { matchesChip, type CategoryChip } from "./category-filter";
import { equipmentOf } from "./custom-exercise";
import { exerciseDisplayName, exerciseSubtitle } from "./exercise-name";
import {
  filterExercises,
  type ExerciseGroup,
  type LibraryExercise,
} from "./library";

/** Compares names in a language's alphabet ("sv": … z, å, ä, ö). */
export const swedishOrder =
  (locale: string = currentLocale()) =>
  (a: string, b: string) =>
    a.localeCompare(b, locale, { sensitivity: "base", numeric: true });

/** Sorts rows by the name they show, in the current language's order. */
export function byShownName<T extends { id: string; name: string }>(
  items: readonly T[],
  locale: string = currentLocale(),
): T[] {
  const compare = swedishOrder(locale);
  return items
    .map((item) => ({ item, shown: exerciseDisplayName(item.id, item.name) }))
    .sort(
      (a, b) => compare(a.shown, b.shown) || a.item.id.localeCompare(b.item.id),
    )
    .map(({ item }) => item);
}

/**
 * The Övningar list's groups: your own exercises ("Mina övningar"), then the
 * catalogue ("A–Ö"), each by its shown name, and with `hidden` the hidden
 * exercises last ("Dolda"). A chip narrows every group; a search gives one
 * group, best match first. Empty groups are left out.
 */
export function libraryListGroups(
  items: readonly LibraryExercise[],
  {
    query,
    chip,
    hidden = false,
  }: { query: string; chip: CategoryChip; hidden?: boolean },
): ExerciseGroup[] {
  const inChip = (item: LibraryExercise) => matchesChip(item, chip);
  if (query.trim()) {
    const found = filterExercises(items, query, "all").filter(inChip);
    return found.length
      ? [{ title: t("exercises.groupResults"), items: found }]
      : [];
  }
  const shown = items.filter((item) => !item.hidden && inChip(item));
  const groups: ExerciseGroup[] = [
    {
      title: t("exercises.groupMine"),
      items: byShownName(shown.filter((item) => item.custom)),
    },
    {
      title: t("exercises.groupAz"),
      items: byShownName(shown.filter((item) => !item.custom)),
    },
  ];
  if (hidden)
    groups.push({
      title: t("exercises.filterHidden"),
      items: byShownName(items.filter((item) => item.hidden && inChip(item))),
    });
  return groups.filter((group) => group.items.length);
}

/** How many exercises are hidden under the chip (for "Visa dolda (n)"). */
export const hiddenCount = (
  items: readonly LibraryExercise[],
  chip: CategoryChip,
) => items.filter((item) => item.hidden && matchesChip(item, chip)).length;

/**
 * A row's subtitle (v6 §D2): "skivstång · Bench Press" for a built-in, "kabel
 * · Bål · egen" for your own (its equipment, the dumbbell by default).
 */
export const libraryRowSubtitle = (e: LibraryExercise & { icon?: string }) =>
  exerciseSubtitle({
    id: e.id,
    equipment: e.custom ? equipmentOf(e) : e.equipment,
    category: e.category,
    custom: e.custom,
    englishName: e.name,
  });
