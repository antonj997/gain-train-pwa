/**
 * Messages that never cover anything (they replace toasts). Pure, so it is
 * tested; the store is src/lib/message-store.ts and the views are
 * src/components/messages/.
 *
 * - A status line: saves and sync show where the screen already says so (the
 *   workout's top bar "Saved"); nothing here.
 * - In the space something left, with Undo: only for what takes time to make
 *   (routines, custom exercises, plans and workouts). An `UndoEntry` holds the
 *   slot's list (`scope`) and the position the item had.
 * - Under the page header, pushing content down: a `PageMessage` in the slot
 *   under the page header, the workout's top bar or an open sheet's title.
 */

export type MessageTone = "info" | "success" | "error";

export type MessageAction = { label: string; run: () => void };

export type PageMessage = {
  id: number;
  /** A message with the same key replaces the one showing. */
  key?: string;
  text: string;
  tone: MessageTone;
  action?: MessageAction;
  /** Stays until dismissed or resolved (errors, an update to install). */
  sticky: boolean;
  /** Time on screen once shown, when not sticky. */
  ms: number;
  /** Offers Undo in a dashed placeholder (an item whose own slot is off screen). */
  undo?: UndoAction;
};

export type UndoAction = {
  run: () => Promise<unknown>;
  /** Said when undoing fails. */
  failed: string;
};

/** The list on Train (the resume card's place) where an abandoned workout leaves its Undo. */
export const RESUME_SCOPE = "resume";

/** Time on screen for a banner under the header, and for an undo placeholder. */
export const MESSAGE_MS = 4000;
export const UNDO_MS = 5000;
/** At most this many banners at once; the oldest that is not an error goes first. */
export const MAX_MESSAGES = 3;

/** Adds a message: same key replaces in place, else it goes last, within the cap. */
export function addMessage(
  list: readonly PageMessage[],
  message: PageMessage,
  max = MAX_MESSAGES,
): PageMessage[] {
  const at =
    message.key === undefined
      ? -1
      : list.findIndex((m) => m.key === message.key);
  const next =
    at >= 0 ? list.map((m, i) => (i === at ? message : m)) : [...list, message];
  while (next.length > max) {
    const drop = next.findIndex((m) => m.tone !== "error");
    next.splice(drop >= 0 ? drop : 0, 1);
  }
  return next;
}

/** Removes a message by id, or every message with that key. */
export function removeMessage(
  list: readonly PageMessage[],
  idOrKey: number | string,
): PageMessage[] {
  const next = list.filter((m) =>
    typeof idOrKey === "number" ? m.id !== idOrKey : m.key !== idOrKey,
  );
  return next.length === list.length ? (list as PageMessage[]) : next;
}

/** The role a banner is announced with: errors interrupt, the rest wait. */
export const messageRole = (tone: MessageTone) =>
  tone === "error" ? "alert" : "status";

/** A place that can show the banners: the one shown is the topmost. */
export type MessageSlotEntry = {
  id: number;
  /** 0 a fallback, 1 a page or the workout's bar, 2 an open sheet. */
  priority: number;
  /** Mount order: later wins at the same priority. */
  seq: number;
};

/** The slot that shows the banners: highest priority, then the newest. */
export function activeSlot(slots: readonly MessageSlotEntry[]) {
  let best: MessageSlotEntry | null = null;
  for (const slot of slots)
    if (
      !best ||
      slot.priority > best.priority ||
      (slot.priority === best.priority && slot.seq > best.seq)
    )
      best = slot;
  return best?.id ?? null;
}

/** A removed item's placeholder, shown in its list where the item was. */
export type UndoEntry = {
  id: number;
  /** The list it was in, such as "routines:library" or "history:2026-11-02". */
  scope: string;
  /** Its position in that list when it was removed. */
  index: number;
  text: string;
  undo: UndoAction;
  /** When the placeholder collapses (ms since epoch). */
  expiresAt: number;
};

export type Interleaved<T> =
  { kind: "item"; item: T; index: number } | { kind: "undo"; entry: UndoEntry };

/**
 * A list with its placeholders put back where the removed items were: an
 * entry at index i comes before the item now at i (older entries first), and
 * one past the end comes last.
 */
export function interleave<T>(
  items: readonly T[],
  entries: readonly UndoEntry[],
): Interleaved<T>[] {
  const sorted = [...entries].sort((a, b) => a.index - b.index || a.id - b.id);
  const out: Interleaved<T>[] = [];
  let e = 0;
  items.forEach((item, index) => {
    while (e < sorted.length && sorted[e].index <= index)
      out.push({ kind: "undo", entry: sorted[e++] });
    out.push({ kind: "item", item, index });
  });
  while (e < sorted.length) out.push({ kind: "undo", entry: sorted[e++] });
  return out;
}

/** How much of an undo placeholder's time is left, 0–1. */
export function undoRemaining(
  entry: { expiresAt: number },
  ms: number,
  now: number,
) {
  if (!(ms > 0)) return 0;
  return Math.max(0, Math.min(1, (entry.expiresAt - now) / ms));
}
