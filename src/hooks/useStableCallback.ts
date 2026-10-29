import { useCallback, useRef } from "react";

/**
 * A function that keeps one identity for the component's lifetime and always
 * calls the latest `fn`. Memoised children can take it without re-rendering
 * on every parent render, and it never runs a stale closure.
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: Args) => latest.current(...args), []);
}
