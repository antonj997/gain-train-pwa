# Gain Train responsive and workflow refinements

9 October 2026. This local, unpublished pass retains the original Gain Train palette, identity assets, rounded cards, brand header and day/night switch.

## Finished changes

- At widths up to 479px, main content, header, sync line and workout footer use 12px horizontal gutters, respecting device safe areas. Settings, routine and empty-state cards use 16px horizontal interior padding. Wider phone and desktop spacing retain the incumbent values.
- At 320px, previous-set hints and set type occupy two columns. Hints show a locale-formatted numeric date with a two-digit year on one line and the intact result below it. The date retains a full accessible label.
- Navigation and exercise options use borderless actions without a background option box. Borderless keyboard focus uses an underline, or blue icon color with a heavier stroke; bordered controls retain the existing outline. The active-set action reads “Go to active set”.
- Settings restores the decorative night stars. Auth has an inline Back link and no separate Continue on phone button. History metrics remain visible above the “About these stats” explanation.
- Blank starts, Home routine starts, Routines Start and History Repeat share the start/replace confirmation. Cancel keeps the current workout. Confirmed replacement and creation occur in one IndexedDB transaction; version checks protect changes made after confirmation. Historical drafts with startedAt:null remain allowed.
- Saves refuse removed workouts. Existing workout Undo uses guarded restoreWorkout, and backup restore cannot introduce two running drafts. No record migration or cloud behavior change was made.

The source of these refinements is src/styles/usability.css, src/components/SetRow.tsx, the affected page components, src/hooks/useStartWorkout.tsx, src/data/workout-start.ts and src/contexts/DataContext.tsx. DESIGN.md, PRODUCT.md and the schemaVersion 2 sidecar now document the changed spacing, focus behavior and workflow constraints.

## Bounded verification

The implementation pass recorded these results:

- Browser flow checks passed for cancel/replace from Home, Home routines, Routines Start and History Repeat, plus keyboard focus. The seven named screen captures passed visual review. The reviewer marked the removed-workout stale-save defect resolved and returned **Ship**.
- All 16 provider tests passed. The final suite contained 71 tests: 70 passed, one existing real-Supabase integration test skipped, zero failed.
- Typecheck passed. Lint reported zero errors and three existing React Fast Refresh context-export warnings. The production build passed with 29 precache entries.

Real-device and cloud integration testing were not performed in this pass. The local preview remains at http://127.0.0.1:8082/. These changes are unpublished; this report does not assert a GitHub Pages deployment.

## Screenshot evidence

The completed review used these files in C:/Users/anton/.codex/visualizations/2026/10/08/01a11c59-797a-7410-99ef-59d2aadc1707/:

- workout-compact-320-dark.jpg
- workout-compact-mobile-light.jpg
- workout-desktop-light.jpg
- history-mobile-stats.jpg
- auth-inline-back-mobile.jpg
- settings-restored-stars.jpg
- workout-start-warning.jpg

## Existing documentation drift

The pre-existing sidecar's Completed set preview uses a shorter SVG check path than the live Lucide Check icon in SetRow. This unrelated preview difference was left unchanged. Earlier review reports describe their completed historical passes and were not rewritten.
