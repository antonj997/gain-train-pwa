# Changelog

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
