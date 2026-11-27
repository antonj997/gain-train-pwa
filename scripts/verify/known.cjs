// Common-check failures on pages another phase owns, recorded so they show
// as KNOWN instead of failing every run (v6 plan, Task 0.11: "P0 records them
// as known in the PR and does not hide them"). Each entry:
//   { check: "target" | "type" | "overflow" | "console",
//     page?: "Träna" | "Kalender" | … (also matches "after p1 · Träna"),
//     width?: 360,
//     match: "a substring of the offender line", owner: "P2", why: "…" }
// An entry matches offenders on every engine, width and theme unless it says
// otherwise. The owner removes its entries when it fixes them; a FAIL then
// shows any offender that is left.
module.exports = [
  // Plan status (P3: the muscle card, planStatus.muscle*), seen after P2's
  // checks end on the plan status page.
  {
    check: "type",
    page: "/library/plan/00000000-0000-4000-8000-000000000001",
    match: "muscle-value",
    owner: "P3",
    why: "the plan's muscle card values are 15/900 and 12/500 (F3 replaces the card)",
  },
  // Framsteg (P3).
  {
    check: "type",
    page: "Framsteg",
    match: "summary.session-summary",
    owner: "P3",
    why: "\"Om statistiken\" is 14/900",
  },
];
