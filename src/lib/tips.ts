import { local, writeStored, type KeyValueStorage } from "./storage";

/**
 * One-time tips (coach marks): a small bubble pointing at something that does
 * more than it shows, once per device. Pure, so it is tested; the store and
 * the bubble are src/lib/tip-store.ts and src/components/Tips.tsx.
 */

/** Every tip, in the order they are offered when several are visible at once. */
export const TIP_IDS = [
  "weekStrip",
  "swipeRoutine",
  "libraryExercise",
  "calendarDay",
  "setBadge",
  "swipeSet",
  "unitHeader",
  "repsHeader",
] as const;
export type TipId = (typeof TIP_IDS)[number];

export const isTipId = (value: unknown): value is TipId =>
  typeof value === "string" && (TIP_IDS as readonly string[]).includes(value);

/** The device-only key for the tips already seen. Never synced. */
export const TIPS_KEY = "gt-tips-seen";

/** The stored list as a set of known tips; anything else is ignored. */
export function parseSeen(raw: string | null | undefined): Set<TipId> {
  if (typeof raw !== "string" || !raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter(isTipId) : []);
  } catch {
    return new Set();
  }
}

/** The seen tips as stored, in TIP_IDS order. */
export const serializeSeen = (seen: ReadonlySet<TipId>) =>
  JSON.stringify(TIP_IDS.filter((id) => seen.has(id)));

export function readSeen(storage: KeyValueStorage = local): Set<TipId> {
  try {
    return parseSeen(storage.getItem(TIPS_KEY));
  } catch {
    return new Set();
  }
}

/** Saves the seen tips; an empty set removes the key. False when storage refused. */
export function writeSeen(
  seen: ReadonlySet<TipId>,
  storage: KeyValueStorage = local,
) {
  return writeStored(TIPS_KEY, seen.size ? serializeSeen(seen) : null, storage);
}

/** What keeps every tip away for now. */
export type TipBlockers = {
  /** A text field has focus (a tip must never cover it). */
  focusedInput?: boolean;
  /** A swipe, a reorder or a calendar drag is under way. */
  dragging?: boolean;
  /** A sheet or dialog is open over the page. */
  dialogOpen?: boolean;
  /** The first-launch language prompt is showing. */
  languagePrompt?: boolean;
};

export const tipsBlocked = (b: TipBlockers) =>
  !!(b.focusedInput || b.dragging || b.dialogOpen || b.languagePrompt);

/**
 * The tip to show now, one at a time: none while blocked or during the pause
 * after the last one; the one showing keeps its place while it is still on
 * screen; otherwise the first unseen tip, in TIP_IDS order, whose element is
 * visible.
 */
export function nextTip(input: {
  /** Tips whose element is on screen now. */
  visible: readonly TipId[];
  seen: ReadonlySet<TipId>;
  current: TipId | null;
  blockers: TipBlockers;
  now: number;
  /** No new tip before this time (a pause after the last one went). */
  quietUntil?: number;
}): TipId | null {
  if (tipsBlocked(input.blockers)) return null;
  const { current, seen, visible } = input;
  if (current && !seen.has(current) && visible.includes(current))
    return current;
  if (input.quietUntil !== undefined && input.now < input.quietUntil)
    return null;
  return TIP_IDS.find((id) => visible.includes(id) && !seen.has(id)) ?? null;
}

/** Marks a tip seen; returns the same set when it already was. */
export function withSeen(seen: ReadonlySet<TipId>, id: TipId): Set<TipId> {
  if (seen.has(id)) return seen as Set<TipId>;
  return new Set([...seen, id]);
}

/**
 * Where the bubble goes for a target box in a viewport `height` px tall:
 * under it when there is room for the bubble, else over it; the arrow points
 * at the target's centre, kept clear of the bubble's rounded corners.
 */
export function tipPlacement(input: {
  target: { top: number; bottom: number; left: number; width: number };
  bubble: { width: number; height: number };
  viewport: { width: number; height: number };
  /** Room kept at the bottom (the tab bar) and the sides. */
  bottomInset?: number;
  gutter?: number;
  gap?: number;
}) {
  const gutter = input.gutter ?? 12;
  const gap = input.gap ?? 10;
  const { target, bubble, viewport } = input;
  const floor = viewport.height - (input.bottomInset ?? 0);
  const below = target.bottom + gap + bubble.height <= floor;
  const top = below ? target.bottom + gap : target.top - gap - bubble.height;
  const centre = target.left + target.width / 2;
  const maxLeft = Math.max(gutter, viewport.width - gutter - bubble.width);
  const left = Math.min(maxLeft, Math.max(gutter, centre - bubble.width / 2));
  const arrow = Math.min(bubble.width - 22, Math.max(22, centre - left));
  return { side: below ? ("below" as const) : ("above" as const), top, left, arrow };
}
