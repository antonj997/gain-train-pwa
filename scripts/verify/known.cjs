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
  // Träna (P2: A2, the week strip, the Today card and the routine badges).
  {
    check: "target",
    page: "Träna",
    match: "a.week-card-link",
    owner: "P2",
    why: "the week card's head link is 24 px tall (A2 makes every day and link 44 px)",
  },
  {
    check: "target",
    page: "Träna",
    match: "week-move",
    owner: "P2",
    why: "the week strip's day cells are 40 px (A2: at least 44 × 44)",
  },
  {
    check: "type",
    page: "Träna",
    match: "span.routine-badge-count",
    owner: "P2",
    why: "the routine badge's count is 11/700; A2 removes the number",
  },
  // Kalender (P2: C1, the compact calendar, the plan card and the date tile).
  {
    check: "target",
    page: "Kalender",
    match: "button.heatmap-day",
    owner: "P2",
    why: "the compact year grid's 12 px day squares are buttons (C1)",
  },
  {
    check: "type",
    page: "Kalender",
    match: "div.heatmap-weekdays",
    owner: "P2",
    why: "the compact grid's weekday letters are 10/600 (C1)",
  },
  {
    check: "type",
    page: "Kalender",
    match: "span.date-tile-",
    owner: "P2",
    why: "the date tile is 10/800 over 18/800; H1 makes it 12/700 over 17/700 (Task 2.2)",
  },
  {
    check: "type",
    page: "Kalender",
    match: "h2.plan-card-name",
    owner: "P2",
    why: "the plan card's name is 20/800 (F2's top card)",
  },
  // Bibliotek → Scheman's plan editor (P2: F1), opened by P4's check of
  // "Gör det till ett schema".
  {
    check: "target",
    page: "Bibliotek",
    width: 360,
    match: "plan-cell",
    owner: "P2",
    why: "the plan template's day buttons are 43 px wide at 360 px (F1: seven 44 px day buttons, Task 2.9)",
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
