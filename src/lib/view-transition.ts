import type { NavDirection } from "@/lib/page-transition";
import { motionMs } from "@/lib/slow-motion";

/**
 * Page slides. A navigation from a tab, the Settings gear or a Back button runs
 * inside `document.startViewTransition` where the browser has it (Safari 18,
 * Chrome): <html data-nav-dir> picks the ::view-transition keyframes in
 * styles/pages.css, and the bottom bar has its own view-transition-name so it
 * stays still. Anything else (no API, back/forward, a navigation from code)
 * gets the fallback: the new page's <main> slides in with the Web Animations
 * API. Both read the motion tokens, so reduced motion becomes a short fade.
 */

type Pending = { done: () => void };
type Transition = ReturnType<Document["startViewTransition"]>;

/** The navigation a running view transition is waiting for. */
let pending: Pending | null = null;
let current: Transition | null = null;

/** Never keep the old page frozen on screen for longer than this. */
const MAX_WAIT_MS = 800;

export function canViewTransition() {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

const quiet = (promise: Promise<unknown> | undefined) => {
  promise?.catch(() => {});
};

/**
 * Runs `navigate` inside a view transition that slides the page in
 * `direction`. Without the API, or if the browser refuses, it navigates at
 * once (and the location change then runs the fallback).
 */
export function navigateWithTransition(
  direction: NavDirection,
  navigate: () => void,
) {
  if (!canViewTransition()) {
    navigate();
    return;
  }
  // A tap during a running slide: let the waiting one capture what is there.
  pending?.done();
  const root = document.documentElement;
  root.dataset.navDir = direction;
  let navigated = false;
  let transition: Transition;
  try {
    transition = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          let settled = false;
          const self: Pending = {
            done: () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              if (pending === self) pending = null;
              resolve();
            },
          };
          const timer = setTimeout(self.done, MAX_WAIT_MS);
          pending = self;
          navigated = true;
          try {
            navigate();
          } catch (error) {
            self.done();
            throw error;
          }
        }),
    );
  } catch {
    // Some WebKit builds throw on a transition they cannot run.
    if (root.dataset.navDir === direction) delete root.dataset.navDir;
    if (!navigated) navigate();
    return;
  }
  current = transition;
  const clear = () => {
    if (current !== transition) return;
    current = null;
    delete root.dataset.navDir;
  };
  transition.finished.then(clear, clear);
  quiet(transition.ready);
  quiet(transition.updateCallbackDone);
}

/**
 * Called when a new route has rendered. If a view transition is waiting for
 * it, lets it capture the new page once the page has loaded (not its
 * "Opening…" placeholder) and returns true. Returns false when no transition
 * was waiting, so the caller plays the fallback instead.
 */
export function settlePageTransition(main: HTMLElement | null) {
  const waiting = pending;
  if (!waiting) return false;
  const loading = () => main?.querySelector("[data-page-loading]");
  if (!main || !loading() || typeof MutationObserver === "undefined") {
    waiting.done();
    return true;
  }
  const observer = new MutationObserver(() => {
    if (loading()) return;
    observer.disconnect();
    waiting.done();
  });
  observer.observe(main, { childList: true, subtree: true });
  // The waiting transition's own timer ends it at the latest.
  setTimeout(() => observer.disconnect(), MAX_WAIT_MS);
  return true;
}

const ms = (value: string, fallback: number) => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return /ms\s*$/.test(value) ? n : /s\s*$/.test(value) ? n * 1000 : n;
};
const px = (value: string, fallback: number) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Where the fallback's new page starts, as a sign: + from the right, − from the left. */
const ENTRY_SIDE: Record<NavDirection, 1 | -1> = {
  right: 1,
  push: 1,
  left: -1,
  pop: -1,
};

/** The fallback: slides the freshly rendered page in, on transform and opacity only. */
export function animatePageEntry(main: HTMLElement, direction: NavDirection) {
  if (typeof main.animate !== "function") return;
  try {
    const css = getComputedStyle(document.documentElement);
    const duration = ms(css.getPropertyValue("--gt-page-duration"), 260);
    const easing = css.getPropertyValue("--gt-ease-out").trim() || "ease-out";
    // A pop has no old page left to slide away, so the page under it drifts in.
    const shift =
      direction === "pop"
        ? px(css.getPropertyValue("--gt-page-exit-shift"), 12)
        : px(css.getPropertyValue("--gt-page-shift"), 32);
    if (duration <= 0) return;
    main.animate(
      [
        {
          opacity: 0,
          transform: `translate3d(${ENTRY_SIDE[direction] * shift}px, 0, 0)`,
        },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration, easing },
    );
  } catch {
    // An animation is never worth an error.
  }
}

let enteringTimer: ReturnType<typeof setTimeout> | undefined;

/** Marks <main> for the cards' short stagger (styles/pages.css) while a page arrives. */
export function markPageEntering(main: HTMLElement) {
  // The page remounts on every route, so its cards start the stagger afresh.
  clearTimeout(enteringTimer);
  main.setAttribute("data-entering", "");
  enteringTimer = setTimeout(
    () => main.removeAttribute("data-entering"),
    motionMs(MAX_WAIT_MS + 400),
  );
}
