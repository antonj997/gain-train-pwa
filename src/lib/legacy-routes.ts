/**
 * Old in-app URLs and where they live now. Pure, so it is tested; Layout
 * swaps the location with a replace before the page renders.
 *
 * - `/progress?tab=goals` → `/progress/goals` (Goals became a subscreen).
 * - `/library/plan` and `/library?tab=plan` → `/library?tab=plans` (v6: the
 *   plans are Library's Scheman tab; `/library/plan/<id>`, a plan's status
 *   page, stays).
 * - `/library?tab=discover`, `/library/shared`, `/library?view=shared` or
 *   `?tab=shared` → `/library?view=discover` (v6: Upptäck is the "Mina |
 *   Upptäck" segment inside Rutiner).
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
  if (path === "/library/shared")
    return go("/library", ["tab", "view"], { view: "discover" });
  if (path === "/library/plan")
    return go("/library", ["tab", "view"], { tab: "plans" });
  if (path === "/library") {
    if (tab === "plan")
      return go("/library", ["tab", "view"], { tab: "plans" });
    if (
      tab === "discover" ||
      tab === "shared" ||
      (view === "shared" && tab !== "exercises")
    )
      return go("/library", ["tab", "view"], { view: "discover" });
    if (tab === "routines") return go("/library", ["tab"]);
    return null;
  }
  return null;
}
