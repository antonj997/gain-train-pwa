import {
  nextTip,
  readSeen,
  withSeen,
  writeSeen,
  type TipBlockers,
  type TipId,
} from "./tips";
import { opensKeyboard } from "./touch";

/**
 * The tips' live state: the elements each tip points at, what blocks tips
 * now, which tip shows and which were seen on this device. The choice of tip
 * is `nextTip` (src/lib/tips.ts); the bubble is src/components/Tips.tsx.
 */

export type TipState = {
  current: TipId | null;
  /** The element the current tip points at. */
  target: HTMLElement | null;
};

let seen = readSeen();
let state: TipState = { current: null, target: null };
const targets = new Map<TipId, Set<HTMLElement>>();
const blockers = new Map<string, boolean>();
const listeners = new Set<() => void>();
let quietUntil = 0;
let timer: ReturnType<typeof setInterval> | null = null;
/** Room the tab bar takes at the bottom: a target under it is not visible. */
const BOTTOM_INSET = 88;
/** A pause before the first tip on a screen, and between tips. */
const PAUSE_MS = 900;
const TICK_MS = 300;

function emit(next: TipState) {
  if (next.current === state.current && next.target === state.target) return;
  state = next;
  for (const listener of listeners) listener();
}

export const getTipState = () => state;
export function subscribeTips(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the box is on screen, inside the viewport and above the tab bar. */
function onScreen(el: HTMLElement) {
  if (!el.isConnected || !el.getClientRects().length) return false;
  const box = el.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return false;
  return box.top >= 0 && box.bottom <= window.innerHeight - BOTTOM_INSET;
}

function firstVisible(id: TipId) {
  for (const el of targets.get(id) ?? []) if (onScreen(el)) return el;
  return null;
}

function currentBlockers(): TipBlockers {
  const active = document.activeElement;
  return {
    focusedInput: opensKeyboard(active) || !!(active as HTMLElement | null)?.isContentEditable,
    dragging: blockers.get("drag") === true,
    dialogOpen: !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'),
    languagePrompt: blockers.get("language") === true,
  };
}

/** Picks the tip to show; runs every TICK_MS while any tip has a target. */
export function evaluateTips(now = Date.now()) {
  if (typeof document === "undefined") return;
  const visible: TipId[] = [];
  for (const id of targets.keys()) if (firstVisible(id)) visible.push(id);
  const id = nextTip({
    visible,
    seen,
    current: state.current,
    blockers: currentBlockers(),
    now,
    quietUntil,
  });
  emit({ current: id, target: id ? firstVisible(id) : null });
}

function ensureTicking() {
  if (timer || typeof window === "undefined") return;
  quietUntil = Math.max(quietUntil, Date.now() + PAUSE_MS);
  timer = setInterval(() => evaluateTips(), TICK_MS);
}

function stopTicking() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** An element a tip points at; returns the function that forgets it. */
export function registerTipTarget(id: TipId, el: HTMLElement) {
  if (seen.has(id)) return () => {};
  let set = targets.get(id);
  if (!set) targets.set(id, (set = new Set()));
  set.add(el);
  ensureTicking();
  return () => {
    const list = targets.get(id);
    list?.delete(el);
    if (list && !list.size) {
      targets.delete(id);
      // It was showing and its screen went: it counts as seen.
      if (state.current === id) markSeen(id);
    }
    if (!targets.size) stopTicking();
    if (state.target === el) evaluateTips();
  };
}

function markSeen(id: TipId) {
  seen = withSeen(seen, id);
  writeSeen(seen);
  targets.delete(id);
  if (state.current === id) {
    quietUntil = Date.now() + PAUSE_MS;
    emit({ current: null, target: null });
  }
  if (!targets.size) stopTicking();
}

/** The element was used (tapped, swiped, held): its tip goes for good. */
export function tipUsed(id: TipId) {
  if (!seen.has(id)) markSeen(id);
}

/** Ok on the bubble. */
export const dismissTip = tipUsed;

/** Something keeps tips away for now: a drag ("drag") or the language prompt ("language"). */
export function setTipBlocker(name: "drag" | "language", on: boolean) {
  blockers.set(name, on);
  if (on && state.current) emit({ current: null, target: null });
}

/** Settings › Show tips again: every tip shows once more on this device. */
export function resetTips() {
  seen = new Set();
  writeSeen(seen);
  quietUntil = Date.now() + PAUSE_MS;
}

/** Whether a tip was already seen here (a tip's target skips registering). */
export const tipSeen = (id: TipId) => seen.has(id);
