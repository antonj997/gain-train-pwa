import {
  MESSAGE_MS,
  UNDO_MS,
  activeSlot,
  addMessage,
  removeMessage,
  type MessageAction,
  type MessageSlotEntry,
  type MessageTone,
  type PageMessage,
  type UndoAction,
  type UndoEntry,
} from "./messages";
import { motionMs } from "./slow-motion";
import { errorMessage } from "./errors";

/**
 * The app's messages: banners under the page header (`notify`) and undo
 * placeholders in the space a removed item left (`offerUndo`). One store for
 * the whole app, so a message raised before a navigation shows on the page
 * that follows. The views subscribe with useSyncExternalStore.
 */

export type MessageState = {
  messages: readonly PageMessage[];
  undos: readonly UndoEntry[];
  slots: readonly MessageSlotEntry[];
  /** The slot that shows the banners, or null with none mounted. */
  active: number | null;
};

let state: MessageState = { messages: [], undos: [], slots: [], active: null };
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let nextId = 1;
let nextSeq = 1;

function set(next: Partial<MessageState>) {
  const merged = { ...state, ...next };
  state = { ...merged, active: activeSlot(merged.slots) };
  for (const listener of listeners) listener();
}

export const getMessageState = () => state;
export function subscribeMessages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearTimer(name: string) {
  const timer = timers.get(name);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(name);
}

export type NotifyOptions = {
  key?: string;
  tone?: MessageTone;
  action?: MessageAction;
  /** Errors stay by default; anything else hides after `ms`. */
  sticky?: boolean;
  ms?: number;
  undo?: UndoAction;
};

/** Shows a banner under the page header, pushing the content down. */
export function notify(text: string, options: NotifyOptions = {}) {
  const tone = options.tone ?? "info";
  const message: PageMessage = {
    id: nextId++,
    key: options.key,
    text,
    tone,
    action: options.action,
    undo: options.undo,
    sticky: options.sticky ?? tone === "error",
    ms: options.ms ?? (options.undo ? UNDO_MS : MESSAGE_MS),
  };
  const replaced =
    message.key === undefined
      ? undefined
      : state.messages.find((m) => m.key === message.key);
  if (replaced) clearTimer(`m${replaced.id}`);
  const messages = addMessage(state.messages, message);
  for (const gone of state.messages)
    if (!messages.includes(gone)) clearTimer(`m${gone.id}`);
  set({ messages });
  return message.id;
}
notify.success = (text: string, options?: NotifyOptions) =>
  notify(text, { ...options, tone: "success" });
notify.error = (text: string, options?: NotifyOptions) =>
  notify(text, { ...options, tone: "error" });

/** Hides a banner by id, or every banner with that key (a problem resolved). */
export function dismissMessage(idOrKey: number | string) {
  for (const m of state.messages)
    if (m.id === idOrKey || m.key === idOrKey) clearTimer(`m${m.id}`);
  const messages = removeMessage(state.messages, idOrKey);
  if (messages !== state.messages) set({ messages });
}

/**
 * A slot drew the banner: its time on screen starts now, so one raised just
 * before a navigation still gets its full time on the next page.
 */
export function markMessageShown(id: number) {
  const message = state.messages.find((m) => m.id === id);
  if (!message || message.sticky || timers.has(`m${id}`)) return;
  timers.set(
    `m${id}`,
    setTimeout(() => dismissMessage(id), motionMs(message.ms)),
  );
}

/** Runs a banner's Undo once, and hides the banner. */
export function undoMessage(id: number) {
  const message = state.messages.find((m) => m.id === id);
  dismissMessage(id);
  if (message?.undo) runUndoAction(message.undo);
}

function runUndoAction(undo: UndoAction) {
  void Promise.resolve()
    .then(undo.run)
    .catch((cause) => notify.error(errorMessage(cause, undo.failed)));
}

/**
 * Leaves a dashed placeholder with Undo where a removed item was, in the
 * list named `scope`, for about five seconds.
 */
export function offerUndo(input: {
  scope: string;
  index: number;
  text: string;
  undo: () => Promise<unknown>;
  failed: string;
}) {
  const ms = motionMs(UNDO_MS);
  const entry: UndoEntry = {
    id: nextId++,
    scope: input.scope,
    index: Math.max(0, input.index),
    text: input.text,
    undo: { run: input.undo, failed: input.failed },
    expiresAt: Date.now() + ms,
  };
  timers.set(
    `u${entry.id}`,
    setTimeout(() => dismissUndo(entry.id), ms),
  );
  set({ undos: [...state.undos, entry] });
  return entry.id;
}

export function dismissUndo(id: number) {
  clearTimer(`u${id}`);
  const undos = state.undos.filter((u) => u.id !== id);
  if (undos.length !== state.undos.length) set({ undos });
}

/** Undo pressed: the placeholder goes and the item comes back. */
export function runUndo(id: number) {
  const entry = state.undos.find((u) => u.id === id);
  dismissUndo(id);
  if (entry) runUndoAction(entry.undo);
}

/** A place for the banners mounted; the topmost one shows them. */
export function registerMessageSlot(priority: number) {
  const slot = { id: nextId++, priority, seq: nextSeq++ };
  set({ slots: [...state.slots, slot] });
  return slot.id;
}

export function unregisterMessageSlot(id: number) {
  set({ slots: state.slots.filter((slot) => slot.id !== id) });
}

/** Clears everything; for tests. */
export function resetMessages() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  set({ messages: [], undos: [], slots: [] });
}
