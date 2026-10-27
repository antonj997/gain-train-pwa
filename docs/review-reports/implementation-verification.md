# Gain Train implementation and verification

Visual direction was superseded by the owner's later request on 9 October: the original GitHub Pages styling and icons are restored, with these functional improvements retained. See [design restoration](design-restoration.md) for the current design and verification. The Training Ledger styling described below is historical.

Completed 9 October 2026 in the existing local checkout, following the three-agent review and the owner's delegated design decisions. The selected direction is Training Ledger; the alternative art directions were proposals, not additive interface modes.

## Delivered

- Bone/graphite/clay themes, ruled session and exercise layouts, readable tabular numbers, stronger input boundaries and a flat matching home-screen icon. The app retains its three labeled destinations and native numeric controls.
- Resume leads Home, with dated progress and additional drafts visible. Routine rows preview their exercises. Active Workout has compact context, visible Abandon, direct load/measure/type controls, bodyweight defaults and a seconds option for holds.
- Completed values remain readable. The next-set cue follows the focused unfinished row and advances after checking; scrolling/focus only follows the explicit next-set action. A 140ms check transition respects reduced motion. Optional rest countdown and haptics default off; rest uses an absolute persisted end time with extension, skip and elapsed states.
- Draft workouts autosave and retain unsaved entries for recovery. Field-specific errors explain missing/invalid values; corrected saves clear stale errors. Abandon operates on the saved record even after invalid editor input. Completed workouts stage edits until Save; Discard preserves the original.
- **Deletion exceptions are honored:** no set confirmation or set/exercise Undo. Populated workout/routine exercises ask before removal; empty exercise blocks remove directly. Library deletion asks clearly and preserves historical names/entries. Whole-workout and routine Undo remain available.
- Routine planning supports set count, load, measure, set type and optional values. Routine, library-exercise and picker-custom forms retain unfinished drafts across close/reload, separated by account. Picker selection and filters expose pressed states.
- History shows sessions before the period summary, uses localized dates and labels the active-week denominator. Progress leads with the latest session's best working set, restricts prior comparisons to compatible values, exposes exact session links before charts, uses a zero chart baseline and distinguishes same-day sessions. Timed holds never count as lifted kilograms or estimated strength.
- Same-day ordering and prior-set matching are shared across views and routine suggestions. Historical editing excludes later sessions from prior hints and preserves old ordering/duration, including legacy records without new timestamps. Duplicate exercise blocks contribute one progress session.
- Settings distinguishes phone-local data from account sync. Auth includes password reset and new-password forms; updating a password requires an actual matching recovered session. Invalid recovery links show a usable fallback.
- Backup import restores backed-up tombstones while preserving live records and local revision information. Existing optional-field compatibility is maintained; no database migration was added.
- Top toasts use safe-area-aware 16px offsets and mobile side gutters. Observed mobile toast width was 358px at a 390px viewport; settled desktop toast placement was 16px from the top.
- Refactoring extracts shared ordering/profile helpers, editor validation/completion, draft storage, date/progress presentation and preferences/rest hooks. Pages load separately while the navigation shell remains mounted. The production bundle no longer emits the large-chunk warning.

## Verification

| Check | Result |
| --- | --- |
| Automated tests | 61 total: 60 passed, 0 failed, 1 live-cloud test skipped |
| Typecheck | Passed |
| Lint | No errors; three existing React development-refresh warnings |
| Production build | Passed; PWA precaches 29 entries, about 1.09 MiB |
| Diff whitespace check | Passed |
| Impeccable detector | No findings |
| Responsive browser review | 320px, 390px and desktop; both themes, populated content and long names |
| Interactive regression checks | Invalid abandon, empty/populated exercise removal, immediate set removal, bodyweight/seconds, completed Save/Discard, checked-invalid uncheck, routine plans/reload, both custom-draft paths, favourites, rest reload/extension/skip, reset entry/invalid callback, Progress no-results and exact session details |
| Cached production build | Updated an earlier cached version; direct workout/Progress reloads and changed/checked set values persisted with the production server stopped |

The production cached-loading check used a separate localhost origin and disposable test records. Browser networking remained online. Live cloud sync, reset-email delivery, real credential updates and account deletion were not exercised in this final browser pass. Physical-phone keyboard, glare and vibration behavior cannot be established by browser resizing. Older sessions without timestamps retain deterministic fallback order; their original same-day sequence cannot be reconstructed.

No commit, push or deployment was performed. The pre-existing package-lock.json changes remain. The local development preview remains available at http://127.0.0.1:8082/.

## Design evidence

- [Training Ledger direction](../../DESIGN.md), [original creative review](creative-direction.md), [functional review](functional-qa.md), [UX review](ux-review.md).
- [Pinterest printed-log reference](https://www.pinterest.com/pin/organisation--73394668921588828/) informed the ruled layout; [Rive interaction examples](https://www.rive.app/use-cases) informed short state feedback. No external assets or animation runtime were added.
- Screenshots are in the task's visualization directory: ledger-mobile-light.png, ledger-mobile-dark.png, ledger-desktop-light.png, ledger-desktop-dark.png and ledger-routine-320.png. They contain disposable QA sessions rather than the owner's training data.
