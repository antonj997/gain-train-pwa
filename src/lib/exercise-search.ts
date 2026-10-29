/** What search needs to know about an exercise. Custom exercises have no equipment or aliases. */
export type Searchable = {
  name: string;
  category: string;
  equipment?: string;
  aliases?: readonly string[];
};

/** Lower case, no accents (ä → a), punctuation as single spaces. */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Another exercise with the same name, ignoring case, accents and punctuation
 * ("Bench press" and "Bench-Press"); `selfId` is the one being edited.
 */
export function sameNamedExercise<T extends { id: string; name: string }>(
  name: string,
  exercises: readonly T[],
  selfId?: string,
): T | undefined {
  const key = normalize(name);
  if (!key) return undefined;
  return exercises.find((e) => e.id !== selfId && normalize(e.name) === key);
}

const words = (text: string) => normalize(text).split(" ").filter(Boolean);

// Lower is better. Name matches come first, then aliases, then the rest.
const EXACT_NAME = 0;
const PREFIX_NAME = 1;
const ALIAS = 2;
const NAME = 3;
const NAME_OR_ALIAS = 4;
const OTHER = 5;

/**
 * How well an exercise matches the query, or null when some typed word matches
 * none of its name, aliases, category or equipment.
 */
export function matchRank(item: Searchable, query: string): number | null {
  const typed = normalize(query);
  if (!typed) return OTHER;
  const name = normalize(item.name);
  const aliases = (item.aliases ?? []).map(normalize);
  const other = normalize(`${item.category} ${item.equipment ?? ""}`);
  const typedWords = words(query);
  const fields = [name, ...aliases, other];
  // Each word may match a different field, but every word needs a match.
  if (!typedWords.every((word) => fields.some((f) => f.includes(word))))
    return null;
  if (name === typed) return EXACT_NAME;
  if (name.startsWith(typed)) return PREFIX_NAME;
  if (aliases.some((alias) => alias === typed || alias.startsWith(typed)))
    return ALIAS;
  if (typedWords.every((word) => name.includes(word))) return NAME;
  if (
    typedWords.every((word) => [name, ...aliases].some((f) => f.includes(word)))
  )
    return NAME_OR_ALIAS;
  return OTHER;
}

/**
 * The items that match the query, best first. Items of equal rank keep their
 * order. An empty query keeps every item in its order.
 */
export function searchExercises<T extends Searchable>(
  items: readonly T[],
  query: string,
): T[] {
  if (!normalize(query)) return [...items];
  return items
    .map((item, index) => ({ item, index, rank: matchRank(item, query) }))
    .filter(
      (hit): hit is { item: T; index: number; rank: number } =>
        hit.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((hit) => hit.item);
}

export type ExerciseFacets = { category?: string; equipment?: string };

/** Keeps the items in the chosen category and with the chosen equipment. */
export function matchesFacets(item: Searchable, facets: ExerciseFacets) {
  return (
    (!facets.category || item.category === facets.category) &&
    (!facets.equipment || item.equipment === facets.equipment)
  );
}
