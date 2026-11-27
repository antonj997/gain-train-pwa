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
  // Kalender (P2: C1, the compact calendar, the plan card and the date tile).
  // Framsteg (P3).
  {
    check: "type",
    page: "Framsteg",
    match: "summary.session-summary",
    owner: "P3",
    why: "\"Om statistiken\" is 14/900",
  },
];
