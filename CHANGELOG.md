# Changelog

## 5 November 2026 — PRs are heaviest weight or best set volume; an arrow for a better set

- **A PR is now one of two records per exercise**, over every earlier finished workout: the heaviest weight (the heaviest-lift rule: drops count, warm-ups do not) or the best set volume (weight × reps of one working set). The first session never counts, and neither does a lift with nothing of its kind earlier to beat. Best est. 1RM, most reps and best session volume are no longer PRs; they stay in the exercise page's Records tab.
- **One PR chip per exercise per workout**, on the record set; when the two records fall on different sets it goes on the heaviest set. A line under the exercise's name lists the records, “Record: Heaviest weight · Best set volume” (“Rekord: Tyngsta vikt · Bästa setvolym”). The owner's Leg Extension with two PR chips and a session-volume line now has one chip.
- **A small up arrow** (muted green, 14px, “Better than last time” / “Bättre än förra gången” for screen readers) marks a checked working set that beat the set in the same position last time, as Previous matches it: more load at ≥ the same reps, the same load with more reps (or seconds), or more weight × reps with the load not lower. Assisted: less assistance is more load. Reps + hold: the hold must not be shorter, and a longer hold at the same load and reps counts. No arrow on warm-ups, drops, cardio or a set with nothing to compare. In History details, the exercise page's History and the workout screen's checked rows, after Previous (fits at 360px).
- **Consistent everywhere:** the Records tile counts exercises with a PR; History's “New best” badge and Progress's Recent bests (which now name the records) use the same rule.
- **Close (×) in a full sheet** no longer gets focus, and Safari's ring, when the sheet opens: the sheet takes focus and Tab reaches Close. Its keyboard ring is inset, and the header sits above the grab handle, which used to cover the button's top edge.
- Code: `prEvents` / `workoutPrs` replace `workoutRecordHits` in `src/data/exercise-records.ts`; `newBestWorkoutIds` and `recentBests` take PR events and `bestEvents` is gone; `improvedSince` / `improvedSetIds` in `src/data/set-improvement.ts`. Tested in `tests/exercise-records.test.ts`, `tests/set-improvement.test.ts` and `tests/progress-helpers.test.ts`.

## 5 November 2026 — reps with a hold, favourites first, category groups, roomier search, reorder exercises

- **Reps + hold** (optional, off by default): the count heading's menu (Reps ⌄) offers Reps / Reps + hold / Hold (seconds). Reps + hold (“Reps + håll”) keeps the measure reps and adds a compact hold field next to reps: seconds per rep, whole seconds 0–600, “s” inside, the number pad, 16px. A new set copies the hold of the set above. A checked row reads “60 × 6 · 2 s” (“KV × 6 · 2 s” for bodyweight); Previous, History and the exercise page show “60 kg × 6 · 2 s”; a routine summary reads “3 × 6 · 2 s · 60 kg”. Records, best sets and estimated maxes ignore the hold and stay weight × reps.
- The choice is remembered per exercise in the synced library record (`repHold`, exercise ids, next to `cardioFields`) and used next time and in routines, whose planned sets carry the hold too. Plain Reps hides the field but keeps the values in unchecked sets; a set checked while the field is hidden is logged without its hold, so History matches what the row showed. Shared routines and backups carry `holdSec`.
- The count column widens to 84px for reps and hold; at 360px in lb with a “+” or “−” marker Previous still keeps about 44px and wraps. The heading reads “Reps · hold” on one line.
- **Favourites first, with a static star.** Library → Exercises and the exercise picker list favourites first: with no category, a Favourites group ahead of Recently used and A–Z; while searching, favourites rank first among equally good matches. A favourite has a small filled warm star after its name, a mark rather than a button (“Favourite” for screen readers). The Library row's star toggle is gone; Favourite / Unfavourite stays in the row's ⋯ menu and on the exercise page.
- **Category groups: main first, then “Also trains”.** With a category filter (say Legs, “Ben”) the list has three parts: favourites whose main category it is, then the other exercises with that main category under the category's name, then “Also trains Legs” (“Tränar även Ben”) for those where it is only a secondary category (Snatch, Thruster, Trap Bar Deadlift), each A–Z. Same in the picker.
- **Search gets the room.** In the picker and Library → Exercises, focusing the search or typing folds the chip rows away (a quick height and opacity ease, none under reduced motion) and shows a “Filter” chip with a count of the active filters that brings them back; filters keep applying. In the picker the title goes too (still read by screen readers), the list is the only scroller and starts at the top for each new query, the footer is slimmer and hides the Add button until something is chosen, and “New exercise” becomes the list's last row, “Create “E”…”. At 390×480 (a keyboard open) five results show.
- **⋯ menu:** Swap exercise, Reorder sets, **Reorder exercises** (“Ändra ordning på övningar”) and Remove exercise. Load and count is gone (the Set sheet changes a set's load, the headings the unit and the count), and so are Move up / Move down: Reorder exercises opens a sheet listing the exercises with their set counts, each with the set sorter's drag handle and ↑ / ↓ buttons, the opening exercise marked; Done saves the order with an Undo toast. Reorder sets has a Done button too. Works in the active workout and the routine editor.
- No schema bump: `holdSec` and `repHold` are new optional fields older apps keep. Migration `supabase/migrations/20261105120000_rep_hold.sql` (not applied) adds the server's bounds: `holdSec` whole seconds 0–600, `repHold` up to 2000 ids of 1–200 characters. The app works without it.
- Code: `src/lib/rep-hold.ts`, `src/hooks/useRepHold.ts`, `labelSet(set, withHold)`, `categoryGroups` / `favouriteGroups` in `src/lib/library.ts`, `searchExercises(items, query, favourite)`, `src/components/SearchFilters.tsx`, `src/components/ui/FavouriteStar.tsx`, `src/lib/exercise-order.ts`, `src/components/workout/ReorderExercisesSheet.tsx`; `SortableSetList` sorts any items with an id. `LoadCountSheet` and `applyExerciseLoad` are removed. Tested in `tests/rep-hold.test.ts`, `tests/library.test.ts` and `tests/exercise-order.test.ts`.

## 5 November 2026 — cardio: choose the fields, type time like a timer

- **Time is typed like a timer** on the number pad: digits fill from the right and the colons come by themselves (“4” 0:04, “400” or “0400” 4:00, “4500” 45:00, “13000” 1:30:00), up to six digits as h:mm:ss, Backspace removes the last digit and leaving the field rolls 60 s or min over (“90” → 1:30). Pasting “4:00” or “04:00” works. Before, a bare number meant minutes, so the owner's “0400” became 400 minutes, 6:40:00. A hold's seconds stay plain seconds.
- **Fields… per cardio exercise** (⋯ → Fields…, “Fält…”): switches for Time (always on), Distance with km / m / mi, Pace (min/km, worked out, not saved), Level, Incline %, Calories and Heart rate (bpm). Each machine has its own defaults (treadmill time, distance, incline; bike and cross trainer time, distance, level; rower and ski erg time and distance in metres; stair climber time, level, calories; others time, distance, calories). The choice is saved per exercise in the synced library record and used next time and in routines. Turning a field off hides its column but keeps what was typed; History, the exercise page and Progress list every value.
- **Roomier rows:** only the chosen fields show, up to four on one line (two lines of two under 380px) and more in lines of three, so a value like 12500 m or 1:30:00 is never cut off; time is the widest; every field is 16px and at least 44px; the focus ring is drawn inside the field, so a neighbour never clips it.
- New optional set fields `inclinePct` (0–100) and `heartRate` (0–300 bpm); distance stays in metres (`distanceM`). The exercise page's cardio Overview adds pace, calories and average heart rate over 30 days where logged; History details and the exercise page's History show the values in the exercise's unit. Shared routines and backups carry the new values.
- The “U” badge after checking a cardio set: checking never changes a set's type (only the Set sheet's Warm-up / Working / Cool-down does, and not for a checked set). It could not be reproduced in Chromium or WebKit; regression tests and the smoke check that a checked cardio set stays “1”.
- No schema bump: older apps keep the new set and library fields when they save. Migration `supabase/migrations/20261105090000_cardio_fields_incline_heart_rate.sql` (not applied) adds the server's bounds for `inclinePct`, `heartRate` and the library's `cardioFields`; the app works without it.
- Code: `src/lib/cardio.ts` (`timerEntry`, `digitsToSeconds`, `parseDuration`, `defaultCardioFields`, `cardioFieldsOf`, `withMetric`, distance units, `paceSeconds`, `cardioGridColumns`), `src/hooks/useCardioFields.ts`, `src/components/workout/CardioFieldsSheet.tsx`, `SetNumberInput`'s `entry="timer"`. Tested in `tests/cardio-fields.test.ts`, `tests/cardio-records.test.ts` and `tests/cardio-badge.test.ts`.

## 4 November 2026 — unnamed workouts are named after their categories

- A workout nobody named, and that didn't come from a routine or plan day, is now named after the main categories it trained, most common first (“Back & Arms”, “Rygg & Armar”). Only each exercise's main category counts, so rows and pulldowns, which also train arms, keep a back day a back day. Ties go to more sets, then to the first.

## 4 November 2026 — the owner's notes, step 5: one exercise page, Progress and Library roles, a design pass

- **One exercise page** (`/exercise/<id>`), opened from Library → Exercises (built-in rows too, which did nothing before), Progress's exercise list, Recent bests, History workout details and lift goal cards. The header has the name, the main category and the others muted, the equipment, a star and the Library ⋯ menu (Favourite, Edit and Share for your own, Hide); the row menu in Library still works. **Overview** is the former Progress exercise sheet (latest working set, best est. 1RM, change, sessions, Heaviest lift, chart; cardio shows time and distance). **History** lists every session newest first with its checked sets, each opening that workout. **Records**: best est. 1RM, heaviest weight, most reps, best set volume, best session volume and the most reps at each weight, each opening the workout with the set highlighted. “Start workout with this exercise” starts a workout with it, prefilled from last time.
- **Records point back.** A Recent best opens the workout it was set in with the set highlighted; its exercise name opens the exercise page.
- **Progress = statistics and goals; Library = your training setup.** Progress keeps Stats (period, tiles, Recent bests, exercises by sessions) and Goals; its exercise sheet moved to the exercise page. Library's eyebrow reads “Your training setup” (“Ditt träningsupplägg”), with one helper line per section: Routines are the workouts you repeat, Exercises the catalogue plus your own, Plan the phases.
- **History workout details, redesigned**: name, date, duration and sets in the header; tiles for Sets, Volume, Time and Records; a read-only card per exercise like the active workout's (badges for warm-up, cool-down and drop, values with a muted ×, a PR chip on each set that set a record; the name opens the exercise page); Repeat, Edit and Delete in a sticky footer instead of at the very bottom.
- **Design pass**: one page header everywhere (eyebrow, big title, the chevron Back) on Settings, Admin, Auth (which had a text “← Back”), 404 and “Workout not found”; full sheets get a Close (×) in their header; the last old `.primary`/`.secondary` buttons moved to `.btn-*`; empty states, notes and errors use the tokens. “Forgot password?” is now translated.
- Code: `src/data/exercise-records.ts` (`exerciseSessions`, `exerciseRecords`, `workoutRecordHits`; tested in `tests/exercise-records.test.ts`), `heaviestLift()` now shares its rule, `estimate()` in `src/data/estimate.ts`, `src/pages/Exercise.tsx`, `src/components/exercise/`, `DoneSetList`, `history/WorkoutDetails`, `ui/BackButton`, `src/styles/details.css`; `/exercise/` is a sub-page in `page-transition.ts`. Design: `docs/superpowers/specs/2026-11-04-progress-library-rework.md`.

## 4 November 2026 — the owner's notes, step 4: plans as training phases

- A plan is now a training phase. The editor leads with the name, the period (a 4–26 week length, or an end date) and the cycle. Its subtitle reads “Phase · 12 weeks · 4 Nov – 24 Jan” (“Fas · 12 veckor …”). A new or re-dated phase is at most 26 weeks; older, longer plans still open and save as they were.
- Deload weeks replace the idea of a deload group. Each cycle week is Normal or Deload, and the presets “3 + 1 deload”, “5 + 1 deload” and “No deload” set the cycle and copy week 1. A deload week trains the same routines, prefilled 10 % lighter with half the working sets; both numbers can be changed per plan.
- Progression: “Increase lifts over the phase”. Add a lift, or all of a routine's weighted exercises at once. The start weight comes from your log, and the suggested weekly step and timeline depend on your level (detected, changeable), the body part, the equipment's step, high reps, deload weeks and the lift's own recent trend, with a weekly cap. A target that's faster than usual is warned about, with “Use suggested timeline”. A week-by-week table can be typed over, and “Also add as a goal” creates a lift goal due when the phase ends. The rates and their sources are in the design doc.
- Starting a routine inside a phase prefills that week's planned weights, and a deload week starts with fewer, lighter sets. The cards show a muted “Plan week 3: 85 kg” or “Deload week”, and Train's plan row shows “Week 3 of 12 · Deload”. Plan rows show the dates, the week of the phase, the cycle and how many lifts progress.
- Groups move under Advanced in Library → Plan, with a one-line explanation. The day picker lists routines first, then day types, then groups.
- No migration: the server trigger allows extra plan and workout fields. No schema bump, and older apps keep the new fields.
- Code: `src/lib/progression.ts` (`suggestProgression`, `plannedWeeks`, steps), `src/data/phase.ts` (phase weeks, week kinds, presets, `planStartFor`, `applyPlanStart`), `src/data/progression.ts` (`estimateStartLoad`, `detectLevel`, `recentTrend`), `withPlan()` in `src/data/start.ts`, and `src/lib/plan-note.ts`. Tested in `tests/progression.test.ts` and `tests/phase.test.ts`. Design: `docs/superpowers/specs/2026-11-04-phase-planning-design.md`.

## 4 November 2026 — the owner's notes, step 3: transitions and the icon bar

- The bottom bar shows icons only; the current tab also shows its name in an accent-soft pill that slides to the tab you tap while the tabs make room. Restyled to the Quiet look: a translucent surface with a slight blur, a top hairline, no other borders. Every tab keeps a 44px target and its name for screen readers; Swedish fits at 360px.
- Switching tabs slides the new page in from that tab's side of the bar (a tab to the right enters from the right, the old page drifts left and fades), in 260ms with a 32px offset. Settings and Admin push in from the right and Back slides them out to the right. The bar stays still.
- It uses view transitions where the browser has them (Safari 18, Chrome) and otherwise, and for back/forward, slides the new page in with the Web Animations API. A failing view transition falls back to navigating at once. Each tab still opens at the top.
- Smaller touches: a page's first cards rise in with a short stagger, and the Segmented thumb slides between options. Reduced motion keeps only a quick fade.
- Code: `src/lib/page-transition.ts` (tab order, route depth, slide direction, in-app link routes; tested), `src/lib/view-transition.ts`, `usePageTransitions()` and `usePageBack()` in `src/hooks/usePageTransitions.ts`, motion tokens `--gt-ease-out`, `--gt-page-*` and `--gt-slide` in `tokens.css`.

## 4 November 2026 — the owner's notes, step 2: pause plans, set counts, swap, categories

- Plans can be paused instead of deleted: a pause/play button on each row in Library → Plan and Pause plan / Resume plan in the editor. A paused plan reads “Paused” in muted text, plans nothing on Train and frees its dates for another plan; resuming into an overlap is refused with the overlap message. Delete is still there.
- Workout cards say “3 working sets · last time 4” (Swedish “3 arbetsset · förra gången 4”) when the working sets differ from the last session; warm-ups, cool-downs and drops do not count.
- Change exercise is now Swap exercise (Byt övning), first in the card's ⋯ menu with an ArrowLeftRight icon, in workouts and the routine editor. Sets stay; unchecked ones on the old exercise's starting load or count move to the new one's (Bench Press → Pull Up gives bodyweight sets with the same reps).
- Exercises can train several categories. Compound lifts in the catalogue list their other categories (Deadlift: Back, also Legs and Glutes), and custom exercises pick them under “Also trains”. Filters, search and plan suggestions match any of them; the main category, ids and shared rows are unchanged.
- No migration: the server trigger does not check extra fields on plans or custom exercises, and older app versions keep the new fields when they save. No schema bump.
- Code: `planDay()`, `withPaused()`, `overlapMessage()` and paused-aware `plannedFor()`/`findOverlap()` in `src/data/plans.ts`; `workingSetChange()` in `src/data/workouts.ts`; `adaptSets()` behind `changeExercise()` in `src/lib/workout-editor.ts`; `alsoTrains` in `src/data/catalogue.ts`, `categoriesOf()`/`inCategory()` in `src/lib/exercise-search.ts` and `categoryText()` in `src/lib/catalogue-labels.ts`. All tested.

## 4 November 2026 — the owner's notes: Train date, kg/lb, checked rows

- Train: the rotating headline is gone; today's date is the big title (in the chosen language) and the settings gear sits level with it.
- Plan and routine editors: the Save bar is pinned flush to the sheet's bottom edge with a solid surface, so nothing shows below it (a sticky footer stopped at the sheet's bottom padding).
- Bodyweight + weight: adding a set no longer drops the “+” from the fields. The marker was relative to the most common load, which the added set changed; “+” and “−” now always show.
- Column headings: kg opens Kilograms / Pounds and Reps opens Reps / Hold (seconds); Load and count stays in the ⋯ menu. New weight unit (Settings → Training too): stored in kg, shown and typed in lb, across set fields, Previous, History, Progress and goals. Bodyweight and goal entry stay in kg.
- Finish is an outline until every set is checked, then fills with a slow animated gradient (static with reduced motion).
- Checked rows read as plain text with a muted “×” between load and reps, or “s” after a hold.
- A drag that starts on a checked value now scrolls; “Uncheck this set to edit its values.” only shows after a real tap.
- Code: `src/lib/units.ts` (conversion and formatting), `isTap()` in `src/lib/touch.ts`, `ChoiceSheet`; `src/lib/headlines.ts` removed. Tests cover the units, the tap rule and the marker regression.

## 4 November 2026 — a Goals section

- Progress has a Stats | Goals switch (Statistik | Mål, `/progress?tab=goals`). Goals no longer sit above the stats; Stats instead starts with a one-line “Goals: 2 active · this week 2/3” link.
- Goals tab: the weekly goal (this week with days left, hit rate over the last 4 and 12 finished weeks from the first workout, current and best streak, a 12-week strip, Edit), active goals by the nearest date (start → now → target, days left or overdue, pace against the six-week trend, a projected date, a sparkline), Reached (N) folded away, and an empty state.
- A lift goal with nothing logged before it now starts its bar at the first session after it instead of at zero.
- Code: `weeklyGoalStats()` in `src/lib/week-summary.ts`, `src/lib/goal-pace.ts` (trend, pace, projection, deadline) and `goalSeries()`/`goalInsight()` in `src/data/goals.ts`, all tested.

## 30 October 2026 — heaviest lift

- Progress → an exercise has a Heaviest lift tile (Swedish “Tyngsta lyft”) beside Sessions · 30 days: the heaviest weight in any completed set at any reps, with its reps and date, e.g. “100 kg × 2 · 27 Oct 2026”. A tie on weight goes to the most reps, then the most recent. Drops count, warm-ups do not. Bodyweight with added weight shows “BW + 25 kg × 3”; assisted, bodyweight-only, timed and cardio exercises have no tile.
- Code: `heaviestLift()` in `src/data/analytics.ts`, tested.

## 30 October 2026 — bug reports and the admin inbox

- Settings → Help and feedback → Send feedback: a bug or feature idea with a title, description, up to four images (shrunk to 1600 px JPEG on the phone) and optional technical details (build, language, browser, screen and the last crash). My reports below it shows each report's status and the admin's reply. Signed out it links to sign in; offline it keeps the draft and says so.
- Admins get an Admin row with the open count and a Reports page (`/settings/admin`): filter by status and kind, open a report for its images, details, status, a note to the reporter, and Delete. Others see “Not available”.
- The error screen now remembers the last crash on the phone (`gt-last-error`) so a bug report can include it. The build's commit and date are compiled in as `__APP_BUILD__`.
- Server: migration `20261030120000_feedback_reports.sql` adds `app_admins` (seeded with the owner's account), `is_admin()`, `feedback_reports` (reporter-only insert of open reports, admin-only status and note, 10 a day, reports kept with a null reporter after account deletion), `admin_feedback_feed()` and the private `feedback` bucket (5 MB JPEG/PNG/WebP, own-folder uploads, 40 a day, admin read and delete). The delete-account function removes the user's feedback images first, as Supabase will not delete a user who owns storage objects; redeploy it with the migration.
- Code: `src/lib/feedback.ts` (validation, details, image size, paths, filters, ages) is pure and tested.

## 30 October 2026 — Mine instead of Yours

- Library → Exercises: the chips All, Mine, Shared, Recently used and Hidden are one row that scrolls sideways, like the category and equipment rows, instead of wrapping onto two lines. Shared now comes right after Mine.
- “Yours” is now “Mine” everywhere: the exercise filter, the Routines Mine/Shared chips and the pill on custom exercises and your own shared routines (Swedish “Mina” for the filter and view, “Min” for the pill).

## 30 October 2026 — display names and shared routines

- Settings → Account has a Name row (signed in only). The name is shown as “by <name>” on routines and exercises you share, and on the account row.
- A routine's ⋯ menu has “Share to library” and “Stop sharing”. Saving a shared routine updates the shared copy; deleting it unshares it first.
- Library → Routines has Yours/Shared chips. Shared lists routines people shared with who shared them, the exercises and Add. Add copies the routine and the sharer's own exercises it uses, reusing a matching exercise of yours instead of making a duplicate.
- Signed out, the Shared views of exercises and routines link to sign in.
- Server: migration `20261030090000_profiles_and_shared_routines.sql` adds `profiles`, `shared_routines` (hidden owner, per-person limits, payload size and shape checks), `shared_routine_feed()` and `by_name` on `shared_exercise_feed()`. The app works with the older exercise feed too. New optional routine fields `sharedId` and `sharedFrom`; no schema bump.
- Code: `src/lib/shared-routines.ts` (payload build, parse and import with exercise reuse) and `src/lib/display-name.ts` are pure and tested.

## 30 October 2026 — English and Swedish

- The app speaks English or Swedish. Settings → Training has a Language row next to Theme; the choice is kept on this phone. English is the default.
- Existing users are asked once on launch, “Choose your language · Välj språk”. Closing the question keeps English; new users are never asked.
- Dates, months, weekday letters and decimals follow the chosen language instead of the phone's region, so screens no longer mix English labels with Swedish dates. The Train headline has its own Swedish list.
- Built-in exercise names stay in English; categories, equipment and day types (Ben, Press, Drag, Överkropp, Underkropp, Helkropp, Kondition) are translated on screen only, and search finds exercises by the Swedish category names too. Saved data does not change.
- Code: a small dependency-free i18n layer in `src/i18n` (`en.ts`, `sv.ts`, `t()`, `useT()`, plurals and `{name}` parameters) with tests for its helpers and the prompt decision.

## 29 October 2026 — sharing custom exercises

- A custom exercise's ⋯ menu has "Share to library" (publishes it to the `shared_exercises` table) and "Stop sharing" (deletes that row). Signed-out users see "Sign in to share". A failed request shows a toast and changes nothing.
- Library → Exercises has a Shared chip. It fetches other people's shared exercises when chosen (short in-memory cache, no realtime), leaves out your own and ones you already added, and takes the same search and filters. "Add" copies the row into your exercises. Signed out or offline it shows a short note instead.
- New optional fields on a custom exercise: `sharedId` (your row), `sharedFrom` (the row you copied) and the copied `equipment`, `aliases`, `load` and `measure`. Copies keep working if the original is unshared. No schema bump and no migration beyond the shared table.

## 29 October 2026 — plans, groups and goals

- Library has a third tab, Plan (`?tab=plan`; `/library/plan` redirects). Plans are now synced: a name, an exact period, a cycle of 1–6 weeks, a weeks × Monday–Sunday template where each day is a routine, a group, a day type, Rest or empty, and dated changes from an Upcoming month view. Overlapping periods are refused with a message. The old device-only plan is imported once into a synced plan and then removed.
- New day types (Legs, Push, Pull, Upper, Lower, Full body, Cardio) and your own groups (a name, routines and optional categories, saved in the library record). Train shows "Today: <name>" with Start, a group's routines, "Start with suggestions" (opens the exercise picker on a Suggested filter) or "Rest day". The This week card links to the Plan tab.
- New goals on Progress, with or without a plan: a bodyweight target or a lift (exercise, weight × reps) by a date, with a progress bar, current versus target, days left and "Reached on <date>". Goals are edited and deleted in a sheet.
- Fix: Add set gives a custom exercise in the Cardio category a cardio set even when all its sets were deleted.
- Code: `src/data/plans.ts` (plannedFor, overlap, groups, day types, the import) and `src/data/goals.ts` (goalProgress) are pure and tested; `lib/plan.ts`, `pages/Plan.tsx` and their styles are gone. The exercise picker takes `suggested` and `single`.

## 28 October 2026 — app pages, Library and the training plan

Navigation and pages (part 3)

- Four tabs: Train, History, Progress and Library. The global header and sync line are gone; each page has its own top bar and shows sync, sign-in and conflict notices as banners under its title. Settings opens from the gear on Train and has a back button.
- Train: a rotating headline, the This week card (Monday-to-Sunday dots, workouts against your goal, sets and time trained), the three most recent routines with a play button, and a Repeat button on the last workout.
- New: a weekly goal (1–14 workouts, off by default) in Settings → Training, with "N weeks in a row on goal" on Train. It is stored on the phone with the other training preferences.
- History groups workouts by week in rows and marks a workout that set a best with a "New best" badge. Progress has a 4 weeks / 3 months / Year control, four tiles with their change, Recent bests and exercises with sparklines.
- Settings is a set of grouped rows that open sheets; the links to routines and exercises moved to Library.
- Library (`/library`) holds Routines and Exercises in two tabs (`?tab=`); `/routines` and `/my-exercises` redirect to them. Routines are cards with Start, Edit and a ⋯ sheet for Delete. Exercises has search, the chips All / Yours / Recently used, Recently used and A–Z groups and a favourite star; a custom exercise opens its editor, which now also deletes it.
- New, optional: a training plan (Library → Routines → "Plan your weeks"). A Monday-to-Sunday template and dated changes up to three months ahead, stored on the phone per account (it does not sync). With a plan, Train shows "Today: <routine>" with Start (or "Rest day") and outlines planned days in the week strip. Without one nothing changes. "Clear plan" removes it.

Fixes

- Set rows give Previous more room, so the row no longer crowds the load and count fields.
- The resume card of a running workout has an animated border and a pulsing live dot; a past workout keeps the plain accent border, and reduced motion gets a static one.
- Workouts per week counts finished weeks only, so a quiet start to the week no longer lowers it; it shows a dash until a finished week has a workout.
- History opens on the simple calendar (restyled with 44 px days, a ring for today and a dot for workout days).

Code

- `src/lib/library.ts` and `src/lib/plan.ts` are new pure helpers with unit tests. `pages/Routines.tsx` and `pages/MyExercises.tsx` became `components/library/RoutinesPanel.tsx` and `ExercisesPanel.tsx`; superseded list-card, routine-card and settings-card styles and the layout notice fallback are deleted.

## 28 October 2026 — workout screen and the Quiet look

Workout screen

- Each exercise is a calm card: name, "Last: 19 Oct", ⋯, then one 44 px line per set (badge, previous result, load, count, ✓). Warm-up shows W, cool-down C, working sets are numbered 1, 2, 3.
- Anything rarely used opens a sheet instead of sitting on the card: the Set sheet (tap the badge: type, load for this set, add drop, delete), Load and count (tap a column heading), the ⋯ sheet, Reorder sets, Finish and Workout details. The edited row stays visible above its sheet.
- Each set keeps its own load. The exercise's most common load names the heading; sets that differ show a marker in the field (BW, +10, −25, or 40 with kg). The Load and count sheet changes unchecked sets only.
- New: drop sets. A drop continues the set above at a lower weight with no rest, has no ✓ of its own, and is checked, saved and counted with its set. History shows it as "↳ 80 kg × 4" under the set.
- The top bar is the only fixed element (back, name, one status line, Finish). The footer, "Go to active set" and the Workout details disclosure are gone; a "Next set" chip appears only when that row is off screen, and a floating rest bar replaces the rest panel.
- Removed: the "Edit sets" switch, compact mode, the per-row type select and remove button, and Abandon in the top bar. Abandon moved into the Finish sheet with the owner's approval; it keeps the undo toast.
- Routine planning uses the same rows and sheets.

Look

- New Quiet colours (light grey ground, white cards, one blue accent, light and dark themes) through `styles/tokens.css`, the system font and one type, spacing and radius scale. Every screen gets the palette.
- Every dialog is now a bottom sheet on phones and a centred panel from 640 px up. The Home resume card is flat; shadows remain only on sheets, the rest bar and the next-set chip.

Data and code

- `drop` is a new optional field on a set; no schema version change, database or sync change. A misplaced drop in a record from an older app version is repaired by validation instead of rejected.
- `SetRow`, `useCloseOptionsOutside` and `styles/set-editing.css` are replaced by `SetLine`, the sheets in `components/workout/` and `styles/workout.css`; superseded rules are deleted.

## 27 October 2026 — reliability, PWA and code-health pass

Installing and updating

- Fixed the corrupted 512 px and maskable app icons; the home-screen icon and splash screen now show the whole image.
- The manifest has a stable `id`, matching dark theme and background colours, Workout and History shortcuts, and install-sheet screenshots. The Workout shortcut resumes a running workout instead of replacing it.
- The theme follows the phone's light/dark setting until you choose one in Settings, and is applied before the first paint, so there is no flash.
- The app checks for updates when it returns to the foreground and hourly, not only when it is reopened.
- The browser is asked once, after your first finished workout, to keep the app's storage.
- Consistent title, description and a link-preview image for sharing.

Data safety and sync

- Fields saved by a newer app version are no longer erased when an older cached version saves the record. Records marked with a newer `schemaVersion` open read-only with an "update the app" message.
- A change the server rejects is set aside with its reason (Settings → Retry) instead of blocking every later upload. A record the server no longer has is re-created. Downloads this version can't read are kept aside and retried after an update instead of stopping sync.
- When sync has failed for a day (for example, a paused free-tier server), a notice says workouts are safe on the phone. Settings shows the last successful sync.
- Workout drafts save once typing pauses rather than on every keystroke; the recovery draft still updates on every change, and pending saves flush when the app is backgrounded or the screen closes. Uploads are batched.
- The workout screen notices when the same workout was changed in another tab or device and offers to load it or keep your entries.
- Typed or pasted future workout dates are refused.
- Blocked browser storage no longer crashes start-up.
- Migration `20261027090000_prune_sync_receipts.sql` keeps sync receipts for 90 days instead of forever.

Code health

- Shared record queries (`data/selectors.ts`), typed records, one `ConfirmDialog`, and small helpers replace code repeated across pages. History's delete uses the app's dialog instead of the browser's.
- The workout editor is split into `useWorkoutAutosave`, `ExerciseCard` and `useCloseOptionsOutside` (941 → ~530 lines), and previous results come from one lookup instead of a rescan per set row.
- Tailwind is replaced by `styles/reset.css` and `styles/primitives.css`; duplicate CSS rules are folded where order allows. Every computed style across 96 screen states was compared with the previous build.
- Lint runs in CI; hooks live in their own modules (no Fast Refresh warnings).
- Older fix notes moved to `docs/notes/`, review reports to `docs/review-reports/`.

## 26 October 2026

Edit sets toggle inside the exercise’s … menu, checked-set locking with an uncheck instruction, added kilograms for BW sets, compact calendar icon controls and continuous date-range bands. Progress shows general stats for the last 30 days. Set inputs retain incomplete text in local draft recovery and keep numeric saved records. The switch stays visible while editing and resets when Options closes; the date-range icon depicts connected endpoints. See [workout refinements](docs/review-reports/2026-10-26-workout-refinements.md), the [calendar follow-up](docs/review-reports/2026-10-26-calendar-controls.md) and the [edit-switch follow-up](docs/review-reports/2026-10-26-edit-switch.md).

Review status at the time: 151 tests total, 150 passed, one real-cloud test skipped. Typecheck and the GitHub Pages build passed; lint had zero errors and four Fast Refresh warnings. Browser rendering and physical-device verification remained pending.

## 18 October 2026

Bodyweight profile, select-all set inputs, compact set reordering, a roomier exercise picker and a current-month history calendar. See [workout usability verification](docs/review-reports/2026-10-18-workout-usability.md).

## Earlier

Original GitHub Pages design restored with direct set/load controls, timed holds, planned routines, retained form drafts, explicit Save/Discard for historical edits and optional rest/haptics. See [design restoration](docs/review-reports/design-restoration.md), [functional improvements](docs/review-reports/implementation-verification.md) and [responsive refinements](docs/review-reports/responsive-refinements.md).
