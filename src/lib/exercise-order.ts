/**
 * The items in the order of `ids`. Items not named keep their order after
 * the named ones, so an exercise added meanwhile is never lost.
 */
export function reorderByIds<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids.flatMap((id) => {
    const item = byId.get(id);
    byId.delete(id);
    return item ? [item] : [];
  });
  return [...ordered, ...byId.values()];
}

/** True when the two orders differ. */
export const orderChanged = (a: readonly string[], b: readonly string[]) =>
  a.length !== b.length || a.some((id, index) => id !== b[index]);
