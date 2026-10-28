# App pages in the Quiet style — design (part 3)

Date: 28 October 2026 · Status: design approved in conversation (navigation and new ideas chosen by the owner)

Mockups (private to the owner): https://claude.ai/artifact/XLe4uHJfVj4iNbZ9EJ8Ly9

Part 1 (`2026-10-28-workout-screen-design.md`) set the Quiet tokens, sheets and components. This pass applies them to every other screen, restructures navigation, and adds four small features. The owner asked for speed: no separate plan document; work runs in three batches; only pure helpers get tests.

## Navigation

- Bottom tabs: **Train** (`/`), **History**, **Progress**, **Library** (`/library`). Lucide icons Dumbbell, History, TrendingUp, Library.
- Library has two sections, Routines and Exercises, chosen with the shared `Segmented` control and kept in the URL (`/library?tab=exercises`). `/routines` and `/my-exercises` redirect to the matching section.
- Settings stays at `/settings`. It opens from a gear `icon-btn` on Train's top bar, and Settings has a back button. The links to routines and exercises leave Settings.
- The global header goes. Each page has its own top bar: a muted eyebrow line (13 px) over a 28 px bold title. The sync, sign-in and conflict notices the header raised render as `.banner` under the page title.
- The bottom nav stays hidden on the workout screen.

## Train (Home)

1. A top bar with today's date as the eyebrow, "Ready to train?" and the gear.
2. Resume card(s) for running drafts, with the animated border from the fixes pass, the elapsed time, "N of M sets" and the next set.
3. **Start workout**: primary when nothing is running, secondary ("Start a new workout") when a workout is running. Under it, a quiet "Log a past workout" button.
4. **This week** card:
   - Mon–Sun day dots, one per day. Done-coloured on days with a completed workout; today gets an accent ring.
   - A chip: "N of G workouts" when a weekly goal is set, else "N workouts".
   - A muted line: "S sets · T" (time trained), plus "W weeks in a row on goal" when the streak is 2 or more. The streak counts consecutive finished weeks that met the goal, ending last week; the current week joins it once it reaches the goal.
5. **Start a routine**: up to three routines, most recently used first. Each row has the name, "N exercises · first exercises" and a round play button that starts it. The heading links "All routines" → Library.
6. **Last workout** card: name, date, sets and duration, with a **Repeat** button that starts a new workout from it (existing repeat flow).
7. Empty states keep their current copy, restyled.

## Rotating headline

Train's title picks one line at random from a list of about 25 each time the screen mounts. It never repeats the previous pick, which is kept in sessionStorage. The mix:
- plain ("Ready when you are");
- dry ("The weights aren't going to lift themselves", "Legs again? Legs again.");
- encouraging, without slogans ("One more good session");
- random ("Somewhere a pigeon is doing push-ups").

Rules: under 40 characters so it fits on two lines at 28 px; no emoji, no exclamation marks, nothing about body image or food. The lines live in `src/lib/headlines.ts`.

## Weekly goal (new setting)

- `weeklyGoal: number | null` in the training preferences, beside the rest timer (`readTrainingPreferences` and its storage). The value is 1–14 workouts; `null` means off.
- Weeks start on Monday (existing `weekStart`).
- It is set in Settings → Training → Weekly goal, as a sheet with a number stepper or segmented 1–7, plus Off.

## History

- Top bar: eyebrow "N workouts in <month>", title "History".
- The calendar card from the fixes pass, simple view by default.
- Workouts grouped by week. The group title reads "This week" or "D–D Mon", then "· N workouts · S sets". Rows are in a `.list`: name; muted "date · duration · sets · first two exercises"; a chevron. A row opens the existing details sheet. The selected day's workouts are highlighted.
- A **"New best"** badge (warm tokens) on a row whose workout set a best estimate for any exercise compared with all earlier completed workouts. Drops never count.

## Progress

- A period `Segmented`: 4 weeks / 3 months / Year. It drives the summary and the lists.
- Four tiles in a 2×2 grid:
  - Workouts / week (finished weeks only, from the fixes pass).
  - Working sets.
  - Volume.
  - Time trained.

  Each shows its change against the previous period of the same length (existing `metricChange` style: ↑ done colour, → muted).
- **Recent bests**: up to 4 cards (exercise name as a badge, best set label, date), newest first, from bests set within the period.
- **Exercises**: rows sorted by sessions in the period. Each has the name, "Best <label> · N sessions" and a 64×28 sparkline of the session best estimate (last 8 sessions, inline SVG, accent stroke, `aria-hidden`). A row opens the existing exercise detail.

## Library

- **Routines:**
  - Each routine is a card: name; "N exercises · S sets · last done <date>" (or "never done"); the exercise names; **Start** (primary) and **Edit** buttons; a ⋯ `icon-btn` holding the existing secondary actions (delete, and duplicate if it exists today).
  - A dashed "New routine" button at the end. The editor stays a sheet (existing).
- **Exercises:**
  - A search field, then filter chips: All / Yours / Recently used.
  - Groups: "Recently used" (up to 5) then "A–Z".
  - Rows: name with a "Yours" chip for custom exercises; muted "load type · last <date> · best <label>".
  - A row opens the existing edit sheet for custom exercises. Built-in rows are not interactive in this pass (no new detail screen).
  - A dashed "New exercise" button.

## Settings

- Top bar: back button + "Settings".
- An account row: avatar initial, name, and sync status ("Signed in · synced just now", or a sign-in prompt).
- Grouped `.list` sections:
  - **Training:** Bodyweight, Weekly goal, Rest timer, Theme. Each row shows its current value and a chevron and opens a sheet or the existing control.
  - **Your data:** Export a backup, Restore a backup, Storage on this device (status chip).
  - **Account:** Sign out, Delete account (danger).
- The existing conflict and quarantine notices stay as cards above the groups.

## Training plan (optional, for specialised users)

Off unless the user sets it up. Nothing on any screen changes for someone who never opens it.

- **Entry point:** a quiet last row in Library → Routines, "Plan your weeks · optional", opening `/library/plan`.
- **Weekly plan:** Mon–Sun rows. Each row opens a sheet listing the routines plus "Rest" and "Not planned".
- **Dated plan:** an "Upcoming" month calendar (the History calendar component) covering today to today + 3 months. Tapping a day sets a routine, Rest or "Use weekly plan". A dated choice overrides the weekly plan for that date. Past dates are read-only.
- A "Clear plan" danger action at the bottom.
- **Data:** `TrainingPlan = { weekly: (routineId | "rest" | null)[7], dated: Record<isoDate, routineId | "rest"> }`.
  - Stored in local preferences per account, like the weekly goal. It does not sync in this pass.
  - Dated entries older than today are dropped on save.
  - A routine deleted later shows as "Deleted routine" and is ignored.
- **When a plan exists:**
  - Train shows a "Today: <routine>" row with Start at the top of "Start a routine", or "Rest day" in muted text.
  - The This week day dots show planned days with an outline (done days stay filled).
- **Helpers:** pure functions `plannedFor(plan, date)` and `prunePlan(plan, today)`, unit-tested.

## Visual rules

Tokens and classes from part 1 only (`tokens.css`, `components.css`). Group titles are 13 px semibold `ink-2`. List rows are at least 56 px with hairline separators; cards have an 18 px radius. Targets are at least 44 px. No new dependencies. Light and dark themes.

## Testing

Unit tests only for new pure helpers:
- the week strip and streak;
- new-best detection;
- sparkline points;
- library filtering and grouping;
- weekly goal parsing.

Then one full typecheck / lint / test / build and a Playwright smoke at 360 and 390 px in light and dark.

## Batches

1. Navigation, Layout, Train, weekly goal, Settings.
2. History rows and badges, Progress overview.
3. Library (routines and exercises), redirects.
4. Training plan, then docs (PRODUCT.md, DESIGN.md, CHANGELOG.md).

## Out of scope

Record schema and sync changes (the weekly goal lives in local preferences only), a built-in exercise detail screen, and charts beyond the existing exercise detail.
