/**
 * The rest dock at the foot of a live workout (mockup v5, B1): resting, rest
 * done (green for 4 s), Finish workout once every set is checked, or nothing.
 * Pure, so it is tested; the dock is components/workout/RestDock.tsx and the
 * timer hooks/useRestTimer.ts.
 */
import { t } from "../i18n";

export type DockPhase = "hidden" | "rest" | "done" | "finish";

/**
 * A rest of `seconds` started at `now` (v6 §D7: the exercise's effective
 * rest): when it ends and how long it is. 0 (the timer off for that
 * exercise) starts nothing.
 */
export function restStart(
  now: number,
  seconds: number,
): { end: number; total: number } | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  return { end: now + total * 1000, total };
}

/**
 * The dock's line about the next set (v6 B1): "Nästa: Knäböj · set 2 · Mål
 * 100 × 6 (5–7)"; the target and its range only when there are any.
 */
export function nextLine(
  name: string,
  /** A working set's number, or the set's own name ("uppvärmningsset 1"). */
  setNumber: number | string,
  target: string | null | undefined,
  range: { min: number; max: number } | null | undefined,
): string {
  const set =
    typeof setNumber === "number"
      ? t("badge.setName", { n: setNumber })
      : setNumber;
  const head = t("rest.nextLine", { name, set });
  if (!target) return head;
  const goal = range
    ? `${target} (${range.min === range.max ? range.min : `${range.min}–${range.max}`})`
    : target;
  return `${head} · ${t("rest.nextTarget", { target: goal })}`;
}

/** How long "Rest done" stays before the dock leaves. */
export const REST_DONE_MS = 4000;
/** A tap on the time adds this many seconds. */
export const REST_EXTEND_SECONDS = 15;
/** The last seconds pulse. */
export const PULSE_SECONDS = 3;
/** A swipe down this far (px), or this fast (px/ms), skips the rest. */
export const DOCK_SKIP_PX = 40;
export const DOCK_SKIP_SPEED = 0.5;

export function dockPhase(input: {
  /** A running workout; editing a finished one has no dock. */
  live: boolean;
  /** Every set is checked (and there is at least one). */
  allChecked: boolean;
  /** When the rest ends (ms), or null with no rest running. */
  restEnd: number | null;
  /** When the last rest ran out (ms), or null. */
  doneAt: number | null;
  now: number;
  /** How long "Rest done" shows, stretched by slow motion. */
  doneMs?: number;
}): DockPhase {
  if (!input.live) return "hidden";
  if (input.allChecked) return "finish";
  if (input.restEnd !== null && input.restEnd > input.now) return "rest";
  if (
    input.doneAt !== null &&
    input.now >= input.doneAt &&
    input.now - input.doneAt < (input.doneMs ?? REST_DONE_MS)
  )
    return "done";
  return "hidden";
}

/** The seconds left, rounded up, as the dock shows them. */
export const restSecondsLeft = (end: number, now: number) =>
  Math.max(0, Math.ceil((end - now) / 1000));

/** The share of the rest still to go, 0–1: the dock's background fill. */
export function restFill(end: number, total: number, now: number) {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, (end - now) / (total * 1000)));
}

/** Whether a second shown pulses: the last three. */
export const pulses = (seconds: number) =>
  seconds >= 1 && seconds <= PULSE_SECONDS;

/**
 * The length of a running rest, for its fill: what it was started with (and
 * extended to) when known, else the rest time, never less than what is left
 * (a rest resumed after a reload).
 */
export function restTotal(
  known: number | null,
  end: number,
  now: number,
  restSeconds: number,
) {
  const left = restSecondsLeft(end, now);
  return Math.max(known ?? restSeconds, left);
}

/** Whether a drag down on the dock, let go, skips the rest. */
export const skipsRest = (dy: number, velocity: number) =>
  dy > DOCK_SKIP_PX || (dy > 0 && velocity > DOCK_SKIP_SPEED);

/** "1:05". */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
