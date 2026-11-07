/**
 * Old in-app URLs and where they live now. Pure, so it is tested; Layout
 * swaps the location with a replace before the page renders.
 *
 * - `/progress?tab=goals` → `/progress/goals` (Goals became a subscreen).
 * - `/library?tab=plan` → `/library/plan` (Plan became a subscreen).
 * - `/library?view=shared` or `?tab=shared` → `/library/shared`.
 * - `/routines` → `/library`, `/my-exercises` → `/library?tab=exercises`.
 * - `?tab=stats` and `?tab=routines` name the default and are dropped.
 *
 * Any other query parameter (such as `edit=`) is kept.
 */
export function legacyRedirect(
  pathname: string,
  search: string,
): string | null {
  const path =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const view = params.get("view");
  const go = (to: string, drop: string[], add?: Record<string, string>) => {
    const rest = new URLSearchParams(params);
    for (const key of drop) rest.delete(key);
    for (const [key, value] of Object.entries(add ?? {})) rest.set(key, value);
    const query = rest.toString();
    return to + (query ? "?" + query : "");
  };
  if (path === "/routines") return go("/library", []);
  if (path === "/my-exercises")
    return go("/library", ["tab"], { tab: "exercises" });
  if (path === "/progress") {
    if (tab === "goals") return go("/progress/goals", ["tab"]);
    if (tab !== null) return go("/progress", ["tab"]);
    return null;
  }
  if (path === "/library") {
    if (tab === "plan") return go("/library/plan", ["tab", "view"]);
    if (tab === "shared" || (view === "shared" && tab !== "exercises"))
      return go("/library/shared", ["tab", "view"]);
    if (tab === "routines") return go("/library", ["tab"]);
    return null;
  }
  return null;
}
