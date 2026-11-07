import { useMemo, useSyncExternalStore } from "react";
import { getMessageState, subscribeMessages } from "@/lib/message-store";
import { interleave } from "@/lib/messages";

/** The app's banners, undo placeholders and slots (src/lib/message-store.ts). */
export function useMessageState() {
  return useSyncExternalStore(
    subscribeMessages,
    getMessageState,
    getMessageState,
  );
}

/** The undo placeholders for one list, by its scope. */
export function useUndoEntries(scope: string) {
  const { undos } = useMessageState();
  return useMemo(() => undos.filter((u) => u.scope === scope), [undos, scope]);
}

/** A list with the placeholders of its removed items where they were. */
export function useWithUndo<T>(scope: string, items: readonly T[]) {
  const entries = useUndoEntries(scope);
  return useMemo(() => interleave(items, entries), [items, entries]);
}

/** The phone asks for less motion. */
export const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
