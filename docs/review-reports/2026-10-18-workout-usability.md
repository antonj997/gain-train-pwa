# Gain Train workout usability — 18 October 2026

This report records the implementation and pre-publication checks for the 18 October update. It retains the original Gain Train palette, icons, rounded components, header, navigation and theme switch. The owner subsequently requested publication to GitHub Pages; deployment status is available in the repository's [Pages workflow runs](https://github.com/antonj997/gain-train-pwa/actions/workflows/deploy.yml).

## Implemented behavior

- Set and routine-plan numeric inputs select their existing value on focus and repeated click. Set-type options are ordered Warm-up, Working set, Cool-down.
- Settings has a Profile bodyweight field in kg, accepting decimal points or commas and blank to clear. Validation permits values greater than zero and at most 1000 kg. Saves use an account-scoped local cache first, with pending changes queued for Supabase Auth metadata synchronization. Connections capture the account and token, reject an account mismatch and abort on disposal; profile metadata is never authorization. No database migration was added.
- BW rows show registered bodyweight when available. Completed BW sets retain a bodyWeightKg snapshot; older sets without one remain valid. New and repeated sets clear old snapshots.
- Exercise “Edit sets” exposes compact handle/index, numeric values, type and removal controls, omitting previous-result and completion clutter while retaining actual validation. Routine planning shares the sorter. Mouse/touch pointer handlers and keyboard controls preview a move locally and commit once on drop; cancellation leaves order unchanged. Space/Enter grabs or drops, arrows move, and capture-phase Escape cancels without closing a routine dialog. Animation-frame scrolling follows the nearest scrollable modal or document. Historical edits retain Save/Discard.
- Compact type controls use 16px text on mobile and join one row with the other fields at 640px. Exercise search expands to a maximum 640px desktop width and nearly fills the mobile viewport. Search clearing, a compact footer and flexible results make better use of the available space. Visual-viewport variables and safe-area bounds account for the keyboard; an outer scroll fallback remains.
- History opens on the current month with an inline Monday-first calendar. Completed-workout days are marked; previous/next/current-month controls remain available. Selecting a day filters sessions while statistics continue to describe the selected month or period above the calendar. Legacy rolling presets remain under “More periods”.

Implementation sources include src/components/SetRow.tsx, SortableSetList.tsx, RoutinePlan.tsx, ProfileForm.tsx, ExercisePicker.tsx and HistoryCalendar.tsx; src/contexts/ProfileContext.tsx; the profile, set-editing and history-calendar libraries; the set model; and scoped stylesheets. DESIGN.md, PRODUCT.md and the schemaVersion 2 sidecar record the resulting behavior without replacing the incumbent design authority.

## Automated verification

The implementation pass recorded these final results:

- Full test suite: 105 total, 104 passed, one existing real-Supabase integration test skipped, zero failures.
- Typecheck passed. Whole-project lint passed with zero errors and four React Fast Refresh context-export warnings: three previous warnings plus ProfileContext following the same pattern. The 24 no-explicit-any errors initially introduced in the VM harness were removed using concrete types.
- The Pages-path production build passed with 28 precache entries.
- The latest targeted VM component run passed both tests. It exercises the actual component's hooks, geometry and event wiring, including pointer capture, stationary-pointer scrolling in the nearest modal, one commit at drop, capture-phase Escape and animation-frame/pointer-capture cleanup. Other coverage includes SetRow server-rendered markup and model, profile, calendar and reorder-controller tests. These are automated component/model checks, not browser tests.
- Independent source and test review returned **pass with no findings** after the fixes. The design detector ran once and reported only font-ramp advisories; that result is not visual verification.

## Verification limits and preview

No actual screenshots, browser flow checks, touch-device checks, native input-selection checks or real cloud verification were completed for this pass. Computer-use inventory returned no browsers, the in-app browser was unavailable, and opening the Codex preview was queued. Earlier 9 October images remain historical evidence and were not reused as proof for these changes.

During pre-publication checks, local previews were served at [port 8082](http://127.0.0.1:8082/) and [port 8086](http://127.0.0.1:8086/), both returning HTTP 200 with the title Gain Train. This confirms local serving, not browser interaction or a GitHub Pages deployment.

## Documentation scope and existing drift

Only DESIGN.md, PRODUCT.md, .impeccable/design.json and this report were changed by the documentation pass. Original identity provenance remains intact. The pre-existing Completed set sidecar preview still uses a shorter check path than the live Lucide Check icon; unrelated drift was left unchanged.
