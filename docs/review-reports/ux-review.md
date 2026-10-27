# Gain Train UX review

Independent UX assessment, 8 October 2026. Review only; no product code, account or deployment changes.

## Method and limits

Walked the local current app at `http://127.0.0.1:8082` in Chrome. Verified actual DOM viewport **390 × 844 CSS pixels**, in dark and light appearance. Chrome's existing zoom required a 683 × 1477 physical viewport override; the DOM dimensions were measured, not inferred. Also inspected the restored desktop layout at approximately **1463 × 694**. Appearance restored to dark and viewport override reset.

Walked empty Home, starting a workout, naming it, multi-select exercise picking, set entry, exercise options and set types, incomplete and complete finish dialogs, saving as a routine, history detail/overview, progress/details/search, routine reuse, leaving/resuming a draft, abandon confirmation, the past-workout form, routine creation form, sign-in form, and expanded account/backup settings. Only UX-prefixed disposable local records were created. Chrome unsigned-in storage was shared with the functional reviewer, whose QA records consequently appeared in summaries and suggestions. Accounts were not accessed or changed.

Source review covered the relevant pages, SetRow, ExercisePicker, model, suggested exercise selection, layout and CSS. Cloud sync, actual sign-in, account deletion, backup import/export, offline error injection, physical touch, iOS/Android keyboard behavior and installed PWA behavior were not exercised. A click on Undo after abandoning my test draft produced unexpected navigation; its outcome remains unverified and is **not** reported as a product defect. No mechanical detector findings were used in this independent assessment. Questions skipped: this is a delegated review-only assessment.

## Overall judgment

This is a coherent, calm phone workout logger. The strongest work is operational: large numbers, clear separation of exercises, repeated previous-set guidance, visible local save state, and a finish action that stays within reach. The weakness is recovery and discoverability during the exact moment someone is tired, using one thumb, and trying to get back under the bar. A few uncommon but consequential actions receive the same treatment as routine logging.

## Strengths to preserve

- Starting is possible without account setup, and “Saved on this phone” distinguishes local storage from sync. This is useful reassurance without an onboarding barrier.
- Weight and rep fields measure about **48 px high**, use **19 px numerals**, and the Done control is about **44 × 48 px**. Previous performance sits directly below the matching row. These are good choices for logging between sets.
- The fixed completion bar shows `n of m sets done`; a completed set gets a clear green state. The incomplete finish dialog explicitly says unchecked sets will be left out and offers Keep logging.
- Exercise selection supports choosing several exercises in one pass, search, recent items and categories; the Add button states the selection count.
- History detail presents a straightforward exercise/set record with Repeat and Edit actions. Light and dark appearances preserve hierarchy and readability; no horizontal overflow was observed at the tested 390 px width.
- Abandon is now easy to find near the top, uses a confirmation with Keep workout first, and explains immediate recovery. The single-chevron set-type select rendered correctly in dark appearance. The new top toast sat within the 16 px side margins.

## Highest-priority issues

### P1 — A stray tap can erase an entire exercise or completed set without recovery

**Type:** usability/error recovery, source confirmed; removal controls inspected live.

Every set has a permanent minus button next to Done. The button measures about **32 × 44 px** on the phone, is close to a frequently used completion control, and immediately removes the row. Exercise Remove similarly deletes all of its sets immediately. Both changes autosave; neither offers Undo or a confirmation. This is materially less forgiving than whole-workout, routine or custom-exercise deletion.

**Improve:** provide a named Undo receipt for set and exercise removal, including completed data. Consider moving set removal into an explicit row-edit mode or menu so the everyday Done action is safer. Increase the hit area or spacing if keeping it beside Done. Avoid a confirmation on every set deletion if Undo can restore reliably.

**Refs:** `src/components/SetRow.tsx:75`, `src/pages/ActiveWorkout.tsx:135`, `src/pages/ActiveWorkout.tsx:374`, `src/index.css:504`.

### P1 — First-time bodyweight logging has a silent obstacle

**Type:** observed usability friction, backed by source.

Added Push Up with no prior history, entered 15 reps, and saw an empty kg input plus a disabled Done control. There was no explanation beside the row. The route to resolving it is `… → Load type → Bodyweight`, but the initially visible “Weight (kg)” text is not actionable. Warm-up/Cool-down classification is also hidden inside the same exercise menu, where users are more likely to expect reorder/remove.

**Improve:** default suitable built-in movements to bodyweight, and make the visible load label a direct labeled control. Offer a clear reason when Done is unavailable, such as “Enter reps and weight” or “Choose bodyweight if no added weight.” Make the set-type label itself editable, or show a compact explicitly labeled Edit sets mode. State when changing load type resets completed checks.

**Refs:** `src/data/model.ts:87`, `src/data/model.ts:95`, `src/components/SetRow.tsx:70`, `src/components/SetRow.tsx:85`, `src/pages/ActiveWorkout.tsx:318`. Screenshot: `ux-pushup-disabled-dark-390.jpg`.

### P1 — Same-day “last” workout and suggestions can select the older session

**Type:** observed functional defect affecting UX; reported separately to functional reviewer.

Completed UX Review Push after the QA workout on the same date. Home still called the earlier QA session “Last workout.” Starting the UX routine then suggested the earlier QA Bench Press values and classifications (50 × 9 and a warm-up), rather than the later UX session (50 × 8 and a working set). All relevant sorts compare only calendar date, leaving same-day insertion order to decide “last.”

**Improve:** establish a real within-day session order, using an appropriate session/completion timestamp and a deterministic fallback for past workouts. Apply it consistently to Home, History, previous-set lookup and routine suggestions. Suggestions should not silently substitute older classifications.

**Refs:** `src/pages/Home.tsx:23`, `src/pages/ActiveWorkout.tsx:104`, `src/data/start.ts:17`, `src/pages/History.tsx:41`.

### P2 — Editing history mixes immediate autosave with an apparent save decision

**Type:** source-confirmed behavior/copy mismatch; completed editor behavior not destructively exercised.

Typing, checking/unchecking, removing or reordering in a completed workout passes through immediate save. The heading says “Changes saved on this phone,” but the footer says Save changes and opens a dialog titled “Finish [name]?” whose action is Save workout. A user may reasonably assume changes are still provisional until that button is used. Returning from the editor can therefore save changes they expected to discard.

**Improve:** choose one consistent contract. If edits autosave, make the exit action Done/Back to history, explicitly state autosave, and provide Undo for consequential changes. If edits require confirmation, hold them locally until Save changes and offer Discard changes. Use an edit-specific dialog and copy.

**Refs:** `src/pages/ActiveWorkout.tsx:77`, `src/pages/ActiveWorkout.tsx:92`, `src/pages/ActiveWorkout.tsx:212`, `src/pages/ActiveWorkout.tsx:457`, `src/pages/ActiveWorkout.tsx:468`.

### P2 — History frequency has a misleading everyday meaning

**Type:** observed analytics wording/trust issue; calculation is deliberate in source.

Two workouts in the Last 30 days produced **2.0 Workouts / week** because only weeks with at least one workout count. The expanded help explains this, but the headline naturally reads as frequency over the selected period. Someone who trained once in a month would see 1.0/week. This overstates consistency unless the user opens the help and interprets the unusual denominator.

**Improve:** calculate the rate over the selected period, or label the existing value “Workouts / active week” and make the active-week denominator visible beside it. The choice should reflect the actual question the metric is meant to answer.

**Refs:** `src/pages/History.tsx:67`, `src/pages/History.tsx:152`, `src/data/summary.ts:116`. Screenshot: `ux-history-dark-390.jpg`.

## Other concrete friction

- **P2, accessibility — Picker selection state is visual only.** Category chips and exercise-choice buttons do not expose `aria-pressed`, `aria-selected` or a checkbox state. After selecting Bench Press and Dip, the accessibility tree still described ordinary buttons and the individual names did not indicate selection. The Add 2 exercises label provides a count but cannot tell a screen reader which ones are selected. Expose state on each toggle and announce selection-count changes. Refs: `src/components/ExercisePicker.tsx:166`, `src/components/ExercisePicker.tsx:178`.
- **P2, efficiency — A new routine cannot specify the intended set plan.** The Create routine form (titled Edit routine) allows only name, exercises and order. Each new exercise gets one blank set; no set count, load type or section can be defined here. A first-time three-set routine requires rebuilding the sets when starting, whereas saving a completed workout as a routine carries the complete structure. Allow minimal planned-set configuration, or describe routines honestly as exercise lists. Refs: `src/pages/Routines.tsx:115`, `src/pages/Routines.tsx:136`, `src/pages/Routines.tsx:211`.
- **P2, recovery — Routine/custom-exercise dialog work is disposable without notice.** Closing a routine dialog immediately clears the temporary edit object. There is no dirty-state warning or restore draft after name/exercise changes. Unlike workout editing, this flow is not autosaved. Clarify that distinction and preserve a draft or confirm only when meaningful unsaved work exists. Source inference: `src/pages/Routines.tsx:107`, `src/pages/MyExercises.tsx:130`.
- **P2, trust — Signed-out Account says changes are waiting to sync.** Expanded Account showed six changes waiting to sync, plus the generic statement that sync runs when connected while the app is open, even though this was an unsigned-in phone log. The label implies pending automatic transmission. Use “Saved only on this phone” while signed out, explain the copy-to-account step before sign-in, and reserve pending-sync counts for an authenticated account. Refs: `src/pages/Settings.tsx:139`, `src/pages/Settings.tsx:156`, `src/pages/Settings.tsx:201`, `src/components/Layout.tsx:100`.
- **P2, account recovery — No forgot-password path is offered.** The live sign-in form contains email/password, Sign in and account creation, with no way to recover an existing account. Add a recovery action and a clear return path. No credentials entered; missing affordance verified live and in source. Ref: `src/pages/Auth.tsx:59`.
- **P3, feedback — Progress search returns an unexplained blank body.** Searching `zz-no-result` left only the title and populated input; there was no no-results message or clear-search action. Give a small contextual empty state. Ref: `src/pages/Progress.tsx:39`.
- **P3, wording/fit — Plank and Side Plank can only be logged as weight/reps.** The catalogue includes these timed holds, but the set model has no seconds/time field. A user must invent what “reps” means. Either support a duration metric for these movements or narrow the catalogue and product wording to supported logging. Source inference: `src/data/catalogue.ts:80`, `src/data/model.ts:2`.

## Design opportunities, not defects

- At 390 × 844, the first set starts roughly halfway down the screen. Global header, sync strip, workout title/save status, standalone Abandon and details disclosure consume considerable space. Keep Abandon near the top as requested, but placing it in a compact heading action row would retain discoverability while bringing the actual lifting controls higher. This is a tradeoff, not a reason to hide recovery again.
- Progress is primarily a list of last performances; the trend and change live behind a generic Details disclosure. A small visible change label (“+1 rep vs last session,” or “Same load, same reps”) would make the destination's purpose clearer without expanding every chart.
- “Last session” is represented by a best set, but that selection is not explained in the main card. “Best working set · last session” would be more precise if that matches the underlying rules.
- Home can accumulate anonymous zero-exercise drafts, all titled Workout and without a date. Add a date/completed-set count to resume cards and offer a compact way to manage stale drafts. Multiple anonymous drafts obscure the choice of what to resume.
- The current interface is visually consistent, readable and restrained. A stylistic redesign is lower priority than reducing ambiguity in set entry and strengthening recovery.

## Practical next-change scope

First address recoverable set/exercise removal, direct load/type controls with validation feedback, and same-day ordering. Then reconcile completed-workout autosave wording, the frequency denominator label, picker accessibility states and account recovery. Keep the large numeric inputs, fixed footer, previous-set context and account-optional first-use flow.

## Evidence assets

Screenshots are saved under `C:/Users/anton/.codex/visualizations/2026/10/08/01a11c59-797a-7410-99ef-59d2aadc1707/`:

- `ux-home-dark-390.jpg`, `ux-home-light-390.jpg`
- `ux-picker-dark-390.jpg`
- `ux-workout-dark-390.jpg`, `ux-workout-options-dark-390.jpg`, `ux-workout-light-390.jpg`
- `ux-pushup-disabled-dark-390.jpg`, `ux-workout-desktop-dark.jpg`
- `ux-finish-incomplete-dark-390.jpg`
- `ux-history-detail-dark-390.jpg`, `ux-history-dark-390.jpg`, `ux-history-light-390.jpg`
- `ux-progress-dark-390.jpg`, `ux-progress-details-dark-390.jpg`, `ux-progress-light-390.jpg`
