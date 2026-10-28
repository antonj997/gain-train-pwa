# Workout screen and Quiet visual system — design

Date: 28 October 2026 · Status: approved in conversation, awaiting written-spec review

This is part 1 of 3. Part 2 is this spec's implementation plan. Part 3 (later, own spec) applies the layout pass to Home, History, Progress, Settings, Routines and Exercises.

Interactive mockups (private to the owner): https://claude.ai/artifact/48tzxrLaPfHW448b1ypgUK — "A · Tap what you want to change" is the chosen card; "1 · Quiet" is the chosen style.

## Goal and decisions

Gain Train should feel calm and uncluttered: a workout tracker that is not "messy and loaded with features". Every existing feature stays, but rarely used ones must not be forced on the user. The exercise card is the main pain point.

Decisions made with the owner:

- Visual direction: open to a new look; chosen style **Quiet** (light grey ground, white cards, one blue accent), with light and dark themes.
- Used often: warm-up / cool-down sets. Occasional: bodyweight / assisted / extra weight, timed sets, set reordering.
- Card interaction: **direction A — tap what you want to change** (set badge, column headings, ⋯ menu each open a sheet).
- New: **per-set load types** within one exercise (different sets, different loads) and **drop sets**.
- Abandon moves from the top bar into the Finish sheet (changes an earlier rule; owner approved).

Unchanged: records, sync, drafts, autosave, validation rules not mentioned here, immediate set deletion without confirmation, no set/exercise Undo, checked sets locked until unchecked, one running workout.

## 1. Workout screen layout and flow

**Top bar** (only fixed element):

- Left: back. Middle: workout name (tap → Workout details sheet: name, date, duration) and one secondary line: live elapsed time for a running workout · "N of M sets" · save status ("Saved", "Saving…", "Needs attention"). A past workout (startedAt null) shows its date as a tappable chip in that line instead of the timer.
- Right: **Finish** (primary). When editing a completed workout: **Save**, enabled only when something changed; back with unsaved changes asks to discard (existing behaviour).

**Body:** exercise cards, then a dashed **+ Add exercise** button. With no exercises, one large "Add your first exercise" button.

**Removed:** the sticky footer ("x of y sets done · Finish"), the "Workout details" disclosure and the always-visible "Go to active set" link.

**Next set chip:** a small floating "Next set ↓" chip appears only when the next unchecked set is outside the visible area; tapping it scrolls that row to the centre and focuses its first input.

**Rest timer:** a floating bar at the bottom while resting: remaining time, "+30 s", "Skip"; after it ends, "Rest done" with Dismiss. Never shown when rest is off in Settings. Rest starts when a set is checked (drops have no ✓ of their own, see §2.5).

**Finish sheet:** summary ("5 sets will be saved · 1 unchecked set left out", "Complete at least one set" when none), the "Save as a routine" switch (not for workouts started from a routine), then **Save workout** (primary), **Keep logging**, **Abandon workout** (danger; keeps the existing undo toast). Editing a completed workout uses Save directly, with the existing confirmation copy.

**Banners:** save errors, "changed in another tab or device" (Load latest / Keep mine) and sync notices use one banner component under the top bar.

The bottom navigation stays hidden on the workout screen.

## 2. Exercise card

### 2.1 Card

- Header: exercise name, a muted "Last: 19 Oct" when previous results exist, and a ⋯ button.
- Column headings: **Set · Previous · {load} · {count} · Done**. The load and count headings are accent-coloured buttons with a small chevron; both open the Load and count sheet.
- Rows (one line each, 44 px targets): **badge · previous · load value · count value · ✓**.
- **+ Add set** under the rows copies the last non-drop set's load, count, section and values (unchecked).

### 2.2 Rows

- **Badge:** working sets are numbered 1, 2, 3… counting only working non-drop sets; warm-up shows **W** (amber), cool-down **C** (soft blue), drops **↓** (no number). Tapping opens the Set sheet. Accessible name: "Set 2, working set. Change type, load or delete".
- **Previous:** the matching previous result (existing matching; drops matched to drops, see §2.5), e.g. "97.5 × 5", or "–". Hidden below 360 px viewport width (the Set sheet still shows it).
- **Load value:** a number field; plain bodyweight shows the text "BW" instead of a field.
- **Count value:** the existing number field (reps or seconds).
- **✓:** checking tints the row with the done colour and makes its values read-only. An input attempt on a checked row shows "Uncheck this set to edit its values." and highlights its ✓ (existing behaviour). Drop rows have no ✓ (§2.5).
- Existing input behaviour stays: numeric/decimal keyboards, select-all on focus and repeated tap, unfinished-text recovery, invalid-value messages.

### 2.3 Per-set load and exception markers

- Each set stores its own load (existing fields `load`, `extraWeight`). Load keys: Weight, BW, BW + kg, Assisted.
- The **exercise default load** is the most common load key among the exercise's sets (ties: the earliest set's). The load heading shows the default's label: `kg`, `BW`, `+kg` or `Assist`.
- Sets whose load differs from the default show a marker inside their own field: **BW** (text), **+10** (BW + kg, "+" in accent), **−25** (assisted, "−" in accent), **40** with a small "kg" suffix (weight in a non-weight exercise). Sets matching the default show plain values. No marker appears when all sets share a load.
- Count (reps/seconds) stays per exercise. The count heading shows `Reps`, `Sec`, or `Reps/sec` when checked sets differ.
- Screen-reader labels name the load: "added kilograms", "assistance kilograms", "kilograms".

### 2.4 Sheets

All sheets: bottom sheets built on the shared Sheet component (§4), closable by tapping outside, Escape, or the handle (an accessible "Close" button). Changes apply immediately.

**Set sheet** (tap a badge):

- Title: "Set 2" / "Warm-up set" / "Cool-down set" / "Drop", with "Last time 97.5 × 5" on the right of the title line.
- Set type segmented control: Warm-up / Working / Cool-down (hidden for drops; a drop shows "Done straight after the set above, at a lower weight. No rest in between."). Changing a set that has drops to Warm-up or Cool-down turns its drops into ordinary sets of that type.
- "Load for this set": Weight / BW / BW + kg / Assist, with "Same as the exercise" or "Differs from the exercise". When the exercise counts seconds, only BW and BW + kg are enabled (existing rule: timed sets use bodyweight).
- One button row: **Add drop** (working sets and drops; "Add another drop" on a drop) and **Delete set** ("Delete drop" for a drop; "Delete set and 1 drop" / "and N drops" when it has drops). Deletion is immediate, without confirmation.
- No Done button. Backdrop dims lightly (about 8%) so the card stays readable.
- **Edited set stays visible:** the edited row gets an accent outline and tint. On open, the list scrolls so the row's centre sits midway between the top bar's bottom edge and the sheet's top edge (smooth unless reduced motion). While open, the list gets bottom padding equal to the sheet's height so the last row can be centred.
- **Height:** the sheet is only as tall as its content (no fixed height); if content exceeds 70% of the viewport it scrolls internally.

**Load and count sheet** (tap a column heading, or ⋯ → Load and count):

- Load: Weight / Bodyweight / Assisted, plus an "Add extra weight" switch shown for Bodyweight. Count: Reps / Seconds. Note: "Applies to the sets you haven't checked yet."
- Applies to every unchecked set (overwriting per-set exceptions), never to checked sets (existing `changeSetLoad` / `changeSetMeasure` semantics). Choosing Seconds sets unchecked sets to Bodyweight; while Seconds is selected, Weight and Assisted are disabled with "Timed sets use bodyweight".
- Done button; normal backdrop (about 38%).

**⋯ sheet:** Load and count (with a hint such as "kg · reps") · Reorder sets · Move up · Move down (each disabled at the ends) · Remove exercise (danger; confirms only when the exercise has entered values or completed sets, existing rule).

**Reorder sets sheet:** the exercise's sets listed with drag handles and keyboard up/down moves (existing `SortableSetList` controller; commit on drop, cancel leaves order unchanged, Escape cancels a move first). A set and its drops move as one group; drops are shown nested and are not individually draggable.

### 2.5 Drop sets

- Data: a set with `drop: true` continues the set above at a lower weight with no rest. Drops have section "working".
- Valid only directly after a working set or another drop in the same exercise; never first; never after a warm-up or cool-down. Validation message: "A drop must follow a working set."
- **Add drop** inserts a drop after the set's existing drops, unchecked, reps blank, same load as the set it follows. Prefilled weight: Weight and BW + kg — 80% of the previous value rounded to the nearest 2.5 kg (BW + kg at 0 kg becomes plain BW); Assisted and plain BW — left blank.
- Add set after a drop creates an ordinary working set.
- Add drop is offered only while the set is unchecked (uncheck it first to add one).
- **Completion belongs to the set:** drop rows have no ✓. Checking a set also marks its drops done and locks their values; unchecking it unchecks them. A set can only be checked when each of its drops has valid values (the usual field messages show; an empty drop can be filled in or deleted). Saved drops therefore always share their set's `done` value.
- Finishing: an unchecked set is left out together with its drops; drops are never saved without their set.
- Counting: "N of M sets" and the Finish summary count a set and its drops as one set.
- Rest timer: no special case — checking the set (after its drops) starts rest as usual.
- Matching and analytics: working-set ordinals ignore drops; a drop is matched to the same-position drop of the matching previous set; drops never count as an exercise's best working set.
- Display: History details show drops as "↳ 80 kg × 4" under their set.
- Routines: planned drops are allowed; starting or repeating a workout preserves `drop`.
- Compatibility: an older cached app version shows drops as ordinary sets and keeps the `drop` field when saving (unknown-field preservation). No SCHEMA_VERSION bump.

### 2.6 What goes away

Always-visible Load and Measure selects; per-row "Working set" selects; per-row "−" remove buttons; per-row "No previous log" line; the "Edit sets" switch, compact mode and the inline Up/Down/Remove strip with its outside-tap dismissal.

## 3. Quiet visual system

**Colours** (CSS custom properties in `src/styles/tokens.css`; all text pairs WCAG AA):

| Token | Light | Dark |
|---|---|---|
| ground | #F4F5F7 | #0F1115 |
| surface (cards, sheets) | #FFFFFF | #181B21 |
| surface-2 (inputs, tracks) | #F0F2F5 | #22262E |
| line / line-strong | #E6E8EC / #DDE1E7 | #2A2F38 / #343A45 |
| ink / ink-2 / ink-3 | #14161A / #5B6270 / #8A93A3 | #F2F4F7 / #A3ACBA / #7D8696 |
| accent / on-accent / accent-soft | #2F5BEA / #FFFFFF / #EEF3FF | #7C9BFF / #0F1115 / #1C2540 |
| done / done-soft | #1E7A4C / #EEF7F2 | #3CC985 / #13261D |
| warm-up fg / bg | #8A5300 / #FFF1DB | #FFC266 / #3A2A12 |
| cool-down fg / bg | #1F4F9E / #E4EEFF | #8CB8FF / #142640 |
| danger fg / bg | #B42318 / #FDECEC | #FF8A80 / #3A1715 |

The existing variables (`--blue`, `--ink`, `--soft`, `--line`, `--surface`, `--background`, …) are redefined in terms of these tokens so every screen adopts the palette in part 1. The meta theme-color and manifest colours follow the new ground colours.

**Type:** the system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`); no web font download. Sizes 12 / 13 / 15 / 17 / 20 / 28 px; weights 400 / 600 / 700; tabular figures for every number.

**Spacing and shape:** 4-point scale (4, 8, 12, 16, 24, 32). Radii: 10 (inputs, badges, small buttons), 12 (buttons), 18 (cards), 22 (sheet top). Cards are flat with a hairline border; only sheets, the rest bar and the next-set chip have shadows. No gradients. Motion 150–200 ms ease-out, disabled under reduced motion. Minimum target 44 px.

**Shared components:** Button (primary, secondary, quiet, danger; 40 / 48 px), IconButton (44 px), Card, SetBadge, NumberField (the existing set input, restyled), Segmented (radio group semantics), Switch, Banner, Sheet.

**Sheets everywhere:** the shared dialog presentation becomes a bottom sheet on phones (and a centred panel, max 480 px wide, at 640 px and wider). This applies to every existing dialog: confirmations, Finish, the exercise picker (full-height sheet), History details, the History date picker, the routine and exercise editors and account deletion.

## 4. Architecture

**Data (`src/data`):**

- `setSchema` gains `drop: z.boolean().optional()`; `validate` enforces §2.5 placement. `newSet`, `repeatExercises` and `suggestedExercises` preserve `drop`; Add set after a drop clears it.
- `setProfileOrdinal` / `previousSetFor` skip drops for working ordinals and match drops by parent ordinal and drop index.
- `analytics.progressFor` excludes drops from the best working set.
- Toggling a set's completion updates its drops; `validate` requires a drop's `done` to equal its set's; `finishWorkout` drops unchecked sets with their drops; set counts treat a set and its drops as one (§2.5).
- A helper computes the exercise default load and each set's marker (§2.3).
- No server or migration change; `drop` is an extra JSON field the server already accepts.

**Shared UI (`src/components/ui`):** `Sheet` (on the existing Radix dialog), `Segmented`, `Switch`; button, card and banner styles. `ConfirmDialog` renders through `Sheet`.

**Workout UI (`src/components/workout`):** `SetLine` (one row; `mode: "log" | "plan"`, replacing `SetRow` and its compact mode), `SetBadge`, `SetSheet`, `LoadCountSheet`, `ExerciseMenuSheet`, `ReorderSetsSheet` (wraps `SortableSetList`), `FinishSheet`, `WorkoutDetailsSheet`, `RestBar`, `NextSetChip`, and a `useKeepAboveSheet` hook (pure centring arithmetic plus the scroll call).

**Rewritten:** `ExerciseCard`, the `ActiveWorkout` top bar and body, `RoutinePlan` (plan-mode `SetLine` with the same sheets).

**Removed after replacement:** `useCloseOptionsOutside`, the `exercise-options` edit mode, compact `SetRow` code paths and their CSS.

**Styles:** `styles/tokens.css` (new), `styles/components.css` (new), `styles/workout.css` (replaces `set-editing.css` and the workout rules in `usability.css`). Superseded rules are deleted, not overridden.

**Unchanged:** `DataContext`, sync, `useWorkoutAutosave`, drafts and storage.

**Docs:** PRODUCT.md and DESIGN.md are updated to describe the new card, sheets, drop sets, per-set load, the Quiet system and the moved Abandon action.

## 5. Testing and rollout

**Automated (node test runner):**

- Drop rules: placement validation, numbering, previous-result matching, Add set after a drop, reorder groups, checking/unchecking a set with drops (including blocked check with an empty drop), finishing with an unchecked set and its drops left out, set counts, History labels, routine and repeat preservation, analytics exclusion.
- Per-set load: default computation, markers, heading sheet affects only unchecked sets, Set sheet affects one set, seconds restriction.
- `useKeepAboveSheet` centring arithmetic.
- Component renders: `SetLine` states (done/locked, drop, each marker), each sheet's contents.
- Records with and without `drop` validate, save, back up and restore unchanged.

**Browser (existing Playwright harness), at 360 and 390 px, light and dark:** logging and checking; Set sheet marking and centring with the sheet no taller than its content; type, load, drop add/delete; immediate set deletion; reorder; Finish sheet save / keep logging / abandon + undo; checking a set with drops (no ✓ on drops) and the rest bar; next-set chip only when off screen; details sheet; past-workout date chip; editing a completed workout; routine planning; every converted dialog as a sheet.

**Accessibility:** axe audit of the workout screen and each sheet; keyboard-only pass (Tab order; Escape closes a sheet and returns focus to its trigger); contrast check of all token pairs in both themes.

**Rollout:** one pull request for part 1 with before/after screenshots; deploys on merge.

## Out of scope

Layout redesign of Home, History, Progress, Settings, Routines and Exercises (part 3; they only receive the palette and sheets here). Per-set reps/seconds switching. Load changes within one set other than drops. Any database or sync change.
