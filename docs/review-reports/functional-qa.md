# Functional QA — 8 October 2026

Review-only testing of the current local code. No production source, credentials, accounts, or real workout records were changed. Browser test records were disposable, prefixed `QA` or `QA Functional`, and remained unsigned-in. No commit, push, or deployment was performed.

## Result

Core local workout logging and cached-app persistence worked in the executed paths. Two reproducible P2 defects remain: invalid input prevents discard/abandon until corrected, and multiple workouts on one calendar date use the earlier session as the latest workout and load suggestion. Invalid input also produces a misleading, persistent storage error.

This report does not establish that every app function works. Real authentication, cloud sync, account deletion, backup import, and a full network-offline transition were not verified end to end.

## Executed project checks

| Check | Observed result |
| --- | --- |
| `npm test` | 22 tests: 21 passed, 0 failed, 1 skipped |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0, 0 errors, 3 warnings |

The skipped test is `real Supabase: offline queue, lost acknowledgement, newer edit and retry`. It requires a disposable confirmed account through `QA_EMAIL`/`QA_PASSWORD`; none was supplied. Passing mock transport tests are not evidence of live Supabase behavior. The lint warnings are `react-refresh/only-export-components` in AuthContext.tsx:93, DataContext.tsx:279, and ThemeContext.tsx:55.

The parent agent separately verified the production build and noted the existing large-bundle warning. I did not repeat or independently claim that build check.

## Reproducible defects

### P2 — Invalid input blocks abandon/discard without explaining why

**Executed draft reproduction:**

1. Start a new workout and expand Workout details.
2. Enter `-1` in Duration (optional, minutes).
3. Click the new top `Abandon workout` action.
4. Confirm `Abandon workout` in the dialog.

**Expected:** discard the saved draft or explain what prevents the action; abandoning should not require fixing values that are being discarded.

**Actual:** the confirmation remains open on the same workout URL, with no useful dialog error. Correcting the duration permits abandonment. The saved draft still exists; no permanent loss was observed.

Draft ID: `4f5d510e-34f1-4387-8bf7-eaaa75250661`, origin `http://127.0.0.1:8082`.

**Executed completed-workout reproduction:** finish a workout with checked valid sets; open Edit; clear a checked set's reps; click Discard workout and confirm. The dialog likewise stays open. The checked set's Uncheck button and Save changes are disabled while the field is invalid. Re-entering valid reps recovers the editor. ID: `d52ec096-b3d5-44b5-99df-443c922e5d00`.

**Code evidence:** [ActiveWorkout.tsx:430](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/pages/ActiveWorkout.tsx:430>) calls `save(id, "workout", w, true)` with the current invalid editor value; [DataContext.tsx:192](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/contexts/DataContext.tsx:192>) validates even when `deleted=true`. The discard click handler has no catch or local error state. [SetRow.tsx:70](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/components/SetRow.tsx:70>) disables even Uncheck when the set is invalid.

### P2 — Earlier same-day session is shown and suggested as the latest

Independently reproduced on the isolated production origin `http://127.0.0.1:8083`:

1. Complete `QA Current Improvement` on 2026-10-08 with Bench Press `50 kg × 8`.
2. Later complete `QA Later Same Day`, also on 2026-10-08, with `60 kg × 8`; save it as a routine.
3. Open Home, then start the `QA Later Same Day` routine.

**Expected:** Home's Last workout is QA Later Same Day; the routine suggests the latest `60 kg × 8`.

**Actual:** Home links QA Current Improvement, and the later session's routine starts with `50 kg × 8`, also showing `Last: 50 kg × 8`. Both completed records remain intact.

Earlier ID: `c400063d-ef39-43ff-bfd1-17ed43817ee8`; later ID: `e5c5f134-8e94-4a32-9777-04d987851c63`; new routine-start draft: `21dd0149-807a-4421-8ec8-1947f878a36b`.

**Code evidence:** [Home.tsx:23](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/pages/Home.tsx:23>), [start.ts:17](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/data/start.ts:17>), and [ActiveWorkout.tsx:104](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/pages/ActiveWorkout.tsx:104>) sort by calendar date only. Equal dates retain record iteration order, and suggestion lookup then takes the first matching exercise. [History.tsx:41](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/pages/History.tsx:41>) has the same tie behavior.

### P3 — Validation is mislabeled as storage failure and the banner stays after recovery

**Executed:** draft durations `-1`, `1.5`, `1441`, and reps `-1`, `1.5`, `10001` each produce `Not saved. Keep this screen open.` and the global message `Could not save on this phone. Keep this screen open and free some storage.` Clearing a checked completed set's reps produces the same message.

**Expected:** an appropriate field validation message, followed by clearing the error after a valid save.

**Actual:** the message suggests storage exhaustion. After correcting the values the editor says `Draft saved on this phone` or `Changes saved on this phone`, while the storage-error banner persists on the editor, Home, and Settings. Reload clears it. No real storage failure occurred in these tests.

**Code evidence:** [DataContext.tsx:209](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/contexts/DataContext.tsx:209>) maps all exceptions to the storage message; the successful save branch at [DataContext.tsx:206](</C:/Users/anton/VS Code Projects/gain-train-pwa/src/contexts/DataContext.tsx:206>) does not clear it. In unsigned-in mode, successful cloud sync cannot clear that error either.

## Browser coverage

`Passed` means executed and visibly verified, not merely inferred from source.

| Area | Executed result / limits |
| --- | --- |
| Empty Home/navigation | Passed; unsigned-in empty states and Workout/History/Progress/Settings links |
| Start workout | Passed; empty draft saved on phone, top abandon action present |
| Save and leave / resume / reload | Passed; draft name, exercises, loads, checked state, and set sections retained |
| Exercise picker | Passed; search, multi-select, categories shown, Recent labels, Favourites filter |
| Custom exercise in picker | Passed; create/add; case-insensitive same-name create reuses one custom record; adding again creates another workout block |
| Weight / bodyweight / assisted | Passed; 50kg×8, BW×6 with disabled weight input, 20kg assist×10 |
| Sets | Passed; add inherited values, working/warm-up/cool-down selection, done/uncheck, unchecked extra set |
| Exercise reorder | Passed; Up moved Pull Up in the active draft; routine arrows changed stored exercise order |
| Completion | Passed; confirmation counted 5 of 6 sets, warned about 1 unchecked set; history retained only 5 checked sets |
| Save as routine | Passed; completion created a routine; routine start reset done flags and supplied history values |
| Finish with no sets | Empty draft footer showed0 sets. Zero-set confirmation/save gating was source-reviewed, not attempted in the browser |
| Abandon / confirmation cancel / Undo | Passed for valid drafts, including a fresh empty draft at mobile width; Undo restored the Home in-progress card. Invalid-value path fails as above |
| Routine management | Edit/reorder/start passed. Separate create-with-picker and routine deletion/Undo were source-reviewed, not executed |
| Past workout | Passed; startedAt absent, details open, unknown duration remained absent; changed date to 2026-09-01 and saw September history |
| History edit | Passed; valid completed reps edit persisted; transient invalid edit exposes defect above |
| History repeat | Passed; copied 40kg×8 into unchecked current-date draft with automatic timer |
| History delete | Browser native confirm appeared; cancellation preserved the record. Confirm-delete/Undo not verified because original tab's CDP focus calls failed after dialog cancellation |
| History periods | Passed; 30 days, calendar September, 6 months, 12 months selected; September record excluded from last30d and included in longer ranges |
| History metrics | Passed with isolated records: unknown duration excluded, avg duration30, frequency1/week, improving100%. Calendar boundary calculations also exercised by automated tests |
| Progress | Passed; 40kg×8 baseline vs50kg×8 current produced63.3kg best estimate and +12.7kg change,1 session/30days,2 total, chart with2 points |
| Custom management | Passed on isolated production origin: create, favourite, rename/note edit, deletion and immediate Undo; stored after reload |
| Appearance | Passed; Daylight switch retained after reload, then restored Moonlight |
| Export backup | Passed; export produced C:\Users\anton\Downloads\gain-train-backup-2026-10-08.json with QA records, format gain-train/version2. Browser download event timed out, but exact file/timestamp and QA record ID verified the output |
| Restore backup | Blocked by extension file access permission; documented chooser opened, setFiles was rejected. No browser security permission was changed |
| Cached app with server down | Passed on production origin after parent stopped8083: direct /my-exercises and /workout reloads; custom CRUD; favourite picker; renamed draft;10kg×12 checked set retained after reload |
| Full network offline/cloud queue | Not executed. Browser network stayed online during server-outage check; mock sync tests cover queue retry/conflict/account switch but do not prove real offline/cloud behavior |
| Mobile/current changes | Actual CSS390×844 verified, no horizontal overflow. Dark Warm-up selector screenshot showed one chevron. Top abandon and top toast/Undo observed. Physical683×1477 compensated browser175% zoom; viewport reset afterwards |

## Static review and limits

- Reviewed data validation, IndexedDB transactions, local save queue, sync outbox, conflict handling, account switching, backup merge behavior, routine suggestions, and analytics code. The executed unit tests cover lost acknowledgement retry, newer edit while request is in flight, explicit conflict, soft deletion propagation, pagination, account switch cancellation, and account-deletion credential/session guards.
- No account was created or signed in. Password reset, sign-out, real cloud conflict resolution, phone-to-account copy, session revocation, and permanent account deletion remain untested end to end. No live server schema or RLS assertion was made.
- Backup import source at DataContext.tsx:245 skips any ID already present, including a deleted local record. Restoring a pre-delete backup therefore cannot resurrect that same ID on the same device. This is a source-review recovery concern, not a browser-confirmed defect in this run.
- Duplicate same-exercise blocks are allowed. Analytics appends a point per exercise block at analytics.ts:36, so its Sessions count can exceed workout count when a completed workout contains duplicate blocks. This was source-reviewed but not completed in the browser as a metrics reproduction.
- Native date `fill()` changed the browser control without committing the React value through this automation backend. Native ArrowUp/ArrowDown events committed the date and the saved summary verified it. The first uncommitted date attempt is not reported as a product defect.
- Early8082 testing shared unsigned-in Chrome storage with the UX agent; neither agent cleared data, and only own records were edited. Some batched actions/transient snapshots were ambiguous. Custom CRUD was repeated successfully on isolated8083; ambiguous early failures are not classified as app defects.
- The file upload rejection was: `To enable file upload ... enable Allow access to file URLs` for the ChatGPT Chrome extension. Changing that security-sensitive access was outside the test scope, so restore stopped there.
- Browser proof-of-work screenshots were captured inline for the desktop discard toast, actual390px layout, dark Warm-up selector, and mobile discard/Undo. No standalone screenshot files or production changes were created by this agent.

## Handoff state

Preview8083 was restarted by the parent after the cached-app check. Temporary viewport override was reset and production appearance returned to Moonlight. Disposable QA records remain locally for reproduction. The exported QA backup remains in Downloads. The attempted import chooser was cancelled with Escape. Only this report file was added to the workspace by this agent.
