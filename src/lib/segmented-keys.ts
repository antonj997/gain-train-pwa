export type KeyOption = { disabled?: boolean };

/**
 * The option a radio-group key moves to: arrows step to the next enabled option
 * and wrap, Home and End jump to the first and last. Returns null when the key
 * is not a navigation key or no option is enabled.
 */
export function nextOptionIndex(
  options: readonly KeyOption[],
  from: number,
  key: string,
): number | null {
  const enabled = (index: number) => !options[index]?.disabled;
  const step =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (step !== 0) {
    const size = options.length;
    for (let moved = 1; moved <= size; moved++) {
      const index = (((from + step * moved) % size) + size) % size;
      if (enabled(index)) return index;
    }
    return null;
  }
  const indexes = options.map((_, index) => index).filter(enabled);
  if (key === "Home") return indexes[0] ?? null;
  if (key === "End") return indexes[indexes.length - 1] ?? null;
  return null;
}
