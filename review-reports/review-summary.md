# Gain Train — three-agent review

8 October 2026. Review of the current local app, including the recent select, abandon and top-toast changes. This review added reports only; it did not implement fixes or redesign the app.

## Overall result

The normal local workout flow worked in the tested paths. The app has reproducible recovery and recency defects, plus usability friction that matters during lifting. Passing unit tests do not establish that every function works.

| Review | Full report |
| --- | --- |
| Agent 1: functional testing | [Functional QA](functional-qa.md) |
| Agent 2: UX and user flows | [UX review](ux-review.md) |
| Agent 3: distinctive design directions | [Creative direction](creative-direction.md) |

## Fix first

1. **Abandon can still fail after invalid input.** Entering an invalid duration or reps value can prevent confirming abandon/discard. The deletion path validates the current editor payload, even though it is being discarded. Clearing reps in a checked completed set also disables Uncheck. Correcting the field recovers the editor; no permanent loss was observed. Deletion should operate on a valid saved record and handle failures explicitly.
2. **Same-day recency is wrong.** Completing 50 kg × 8, then 60 kg × 8 on the same date still leaves the earlier workout as Home's Last workout and the source of routine/previous-set suggestions. Both reviewers observed this; functional QA reproduced it independently on an isolated production origin. Define within-day ordering consistently across Home, History and suggestions.
3. **Validation looks like storage exhaustion.** Invalid values show “free some storage,” and the global error remains after values are corrected and saved. Separate field validation from persistence failures and clear recovered errors.
4. **Set/exercise deletion has no recovery.** The permanent minus beside Done removes a set immediately and autosaves. Removing an exercise also has no Undo. Provide reliable Undo, then reconsider the position of the destructive controls.
5. **Bodyweight and set-type controls are hard to discover.** A new Push Up starts with kg input; entering reps leaves Done disabled without explanation. Load type and warm-up/cool-down live behind the exercise ellipsis menu. Make the visible load/type labels usable controls, supply appropriate defaults and show actionable validation.

## Clarify next

- Historical edits autosave immediately while the footer still says Save changes and opens a Finish dialog. Choose a consistent autosave/Done or explicit Save/Discard contract.
- Workouts/week uses only active weeks. The existing calculation is deliberate; label it Workouts/active week so the headline communicates that denominator.
- Exercise-picker selection needs an accessible individual state, beyond a check icon and aggregate count.
- New routine creation cannot define set counts or load types. Routine/custom-exercise edits can disappear when their dialogs close.
- Signed-out Settings implies pending automatic cloud sync; clarify the phone-only state and copy-to-account step. Sign-in also lacks a password-recovery entry point.
- Progress needs a no-results state and a clearer Best working set label. Timed holds in the catalogue do not have a duration-based set model.

These findings mix observed behavior, source-confirmed behavior and design preferences; the individual reports distinguish them.

## Recommended creative direction

**Training Ledger** is the designer's strongest proposal: warm bone and graphite, restrained clay actions, crisp rules, readable tabular numbers and fewer repeated cards. Identity comes from entering and completing a set.

- Home promotes Resume when a draft exists and treats routines as concise ruled rows.
- Active Workout brings the first set higher, preserves an easy top abandon action, and gives values and completion priority over repeated metadata.
- A small next-set marker and short check transition add satisfaction without forcing scrolling, focus changes or exercise order. Completed values stay readable; reduced motion preserves the same state.
- History puts dated sessions before aggregate summaries. Progress leads with actual comparable working sets and opens exact session detail on demand.
- Keep the requested top, mobile-wide toasts, local-save trust language, large inputs, fixed completion footer, explicit checks and incomplete-finish warnings.

Alternatives are **Rack Instrument** (dark, precise, equipment-like) and **Club Programme** (navy/vermilion, bold sporting typography). The creative report supplies concrete palettes, typography, interactions, tradeoffs and an incremental sequence. Prototype a populated active workout before applying a direction everywhere.

## Verification and limits

- Automated suite: **21 passed, 0 failed, 1 live-cloud test skipped**.
- Typecheck and production build passed. Lint has no errors and three warnings; the build retains its large-bundle warning.
- Browser walkthroughs covered normal logging, resume/reload, set/load types, completion, valid abandon/Undo, routine reuse, past workouts, history periods, progress, custom-exercise CRUD, theme persistence and backup export.
- Actual **390 × 844 CSS-pixel** layouts were reviewed in light/dark, plus desktop. The single chevron and top/mobile-wide toast changes passed normal-path checks. This was browser resizing, not a physical-phone test.
- With the production server stopped, cached direct-route reloads and local draft/checked-set changes persisted. Browser networking remained online; this does not prove a full network-offline/cloud transition.
- Backup restore was blocked by the browser extension's file-access permission. Authenticated cloud sync, account deletion and some destructive/routine paths were not tested end to end. No security permissions or real accounts were changed.
- Disposable local QA records remain for reproduction. Product source and the pre-existing local lockfile changes were preserved.
