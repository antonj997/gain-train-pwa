# Changelog

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
