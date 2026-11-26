// Library's parts (v6 §E1): three tabs chosen with `?tab=` (Rutiner,
// Övningar, Scheman) and, inside Rutiner, the "Mina | Upptäck" segment
// chosen with `?view=`. Pure, so it is tested
// (tests/today-and-redirects.test.ts).
import type { MessageKey } from "../i18n";

export type LibraryTab = "routines" | "exercises" | "plans";
export type RoutinesView = "mine" | "discover";

export const LIBRARY_TABS = [
  { value: "routines", label: "library.routines" },
  { value: "exercises", label: "library.exercises" },
  { value: "plans", label: "library.plans" },
] as const satisfies readonly { value: LibraryTab; label: MessageKey }[];

export const ROUTINE_VIEWS = [
  { value: "mine", label: "library.mine" },
  { value: "discover", label: "library.discover" },
] as const satisfies readonly { value: RoutinesView; label: MessageKey }[];

/** The tab `?tab=` names; Rutiner for anything else. */
export const libraryTabOf = (value: string | null): LibraryTab =>
  value === "exercises" || value === "plans" ? value : "routines";

/** Rutiner's part `?view=` names; Mina for anything else. */
export const routinesViewOf = (value: string | null): RoutinesView =>
  value === "discover" ? "discover" : "mine";
