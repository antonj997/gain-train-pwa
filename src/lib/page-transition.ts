/**
 * Which way a page slides when the route changes. Pure, so it is tested; the
 * view transition and its fallback live in src/lib/view-transition.ts.
 *
 * - "right": a tab to the right of the current one. The new page enters from
 *   the right; the old one drifts left and fades.
 * - "left": the mirror image, for a tab to the left.
 * - "push": into a sub-page (Settings, Admin). The new page enters from the right.
 * - "pop": back out of one. The old page slides away to the right.
 */
export type NavDirection = "left" | "right" | "push" | "pop";

/** The bottom navigation's routes, left to right. */
export const TAB_PATHS = ["/", "/history", "/progress", "/library"] as const;

/** Sub-pages, by how many levels they sit below the tabs. */
const SUB_PAGES: Record<string, number> = {
  "/settings": 1,
  "/settings/admin": 2,
};

/** "/history/" and "/history" are the same route. */
function normalise(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
}

/** The tab a route belongs to (0 = Train … 3 = Library), or -1 for none. */
export function tabIndex(pathname: string): number {
  const path = normalise(pathname);
  return TAB_PATHS.findIndex((tab) =>
    tab === "/" ? path === "/" : path === tab || path.startsWith(tab + "/"),
  );
}

/** 0 for a tab, 1 for Settings, 2 for Admin; null for any other route (the workout, sign-in, not found). */
export function routeDepth(pathname: string): number | null {
  const path = normalise(pathname);
  if (tabIndex(path) >= 0) return 0;
  return SUB_PAGES[path] ?? null;
}

/** How to animate a move from one route to another, or null for none. */
export function pageTransition(from: string, to: string): NavDirection | null {
  const a = normalise(from);
  const b = normalise(to);
  if (a === b) return null;
  const fromDepth = routeDepth(a);
  const toDepth = routeDepth(b);
  if (fromDepth === null || toDepth === null) return null;
  if (toDepth > fromDepth) return "push";
  if (toDepth < fromDepth) return "pop";
  if (fromDepth > 0) return null;
  const fromTab = tabIndex(a);
  const toTab = tabIndex(b);
  if (fromTab === toTab) return null;
  return toTab > fromTab ? "right" : "left";
}

/**
 * The in-app route a link points to, without the app's base path, or null
 * when the link leaves the app (another origin, or outside the base).
 */
export function appRoute(
  href: string,
  origin: string,
  base: string,
): { pathname: string; to: string } | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  if (
    prefix &&
    url.pathname !== prefix &&
    !url.pathname.startsWith(prefix + "/")
  )
    return null;
  const pathname = url.pathname.slice(prefix.length) || "/";
  return { pathname, to: pathname + url.search + url.hash };
}
