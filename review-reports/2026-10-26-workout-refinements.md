# Gain Train workout refinements — 26 October 2026

This report records implementation and pre-publication verification of the [26 October specification](../docs/superpowers/specs/2026-10-26-workout-refinements.md). The changes preserve the original Gain Train blue/navy/light-grey palette, rounded components, icons and license, header, navigation and theme switch. Publication proceeds through the repository's [Pages workflow](https://github.com/antonj997/gain-train-pwa/actions/workflows/deploy.yml); native mobile/device verification remains pending and is separate from deployment.

## Implemented behavior

- Each exercise has one persistent **Edit sets** toggle with an accessible pressed state. Compact rows retain ordering, immediate removal and the completion button needed to unlock a checked set. Historical editors retain Save/Discard.
- Checked numeric values stay read-only in logging, compact and historical editors; checked type selects are disabled. Attempting to edit shows “Uncheck this set to edit its values.” in red and highlights that row's completion button. Group load, measure and Extra weight changes preserve checked rows, their completion and captured values. Mixed profiles retain captions identifying kg, assistance, plain BW or added BW, and reps or seconds.
- Blank unfinished rows omit “Enter reps to complete this set.” and “Enter kg, or choose Bodyweight above.” Actual invalid numeric values remain visible and cannot become valid checked sets.
- Set and routine-plan inputs are single-line `type="text"` fields with decimal keyboards for kg and numeric keyboards for reps/seconds. Focus and repeated tap select the value. A custom pointer-selection controller captures gestures that begin in a field, bounds horizontal selection and prevents native selection-drag auto-scroll. Handle-only reordering and page scrolling outside the field remain available. Copy, select-all and browser find modifier shortcuts remain available. These behaviors have automated controller/component coverage; no native selection gesture was verified.
- Incomplete strings such as `1e` persist in the local editor's optional `inputText` field through `changeSetNumber` / `getSetInputText`. The `recoverySet` schema accepts that state for workout and routine recovery, so remounts and recovery do not erase the visible entry. Correction clears it. `validSet` rejects pending raw text and `validate` blocks saving it; saved record weight/reps fields remain numeric and have no `inputText` field.
- Bodyweight exercises and routine plans offer **Extra weight** for unfinished sets. Optional `extraWeight:true` retains `load:"bodyweight"`; the usual `weight` field holds added kg only. Completed added load must be greater than zero and at most 10000 kg; blank can remain unfinished. “BW + kg” headings and “BW + added kg” captions distinguish it from the separate profile `bodyWeightKg` snapshot. New/repeated sets preserve added-load mode and kilograms while clearing completion and old snapshots. Routine planning, backup validation, suggestions and previous-result matching preserve the mode. Analytics compare plain BW, added BW, assisted and weighted profiles separately; added BW compares reps/seconds at the same added kilograms and introduces no BW estimated 1RM. No server load-enum change or migration was added.
- History contains one calendar/date controller followed by workouts. It opens on the current month, with **Detailed** and **Simple** displays. Detailed retains the Monday-first date grid. Simple has one small square per actual day of the displayed month, filled for completed workouts; full accessible labels include the date and workout count. **Month** supports whole-month or selected-day filtering. **Date range** uses From/To buttons and the same calendar for inclusive bounds across months. Browsing preserves the chosen bounds and future dates cannot be selected. History has no general statistics, More periods control or second date picker.
- Progress retains exercise progress and receives the original **Workouts / active week**, **Avg duration · min** and **Exercises improving** metrics and **About these stats** explanation. Its **Last 30 days** summary explicitly dates the recent period and preceding 30-day comparison. It is independent of History's calendar selection.

Implementation sources include `SetNumberInput.tsx`, `SetRow.tsx`, `RoutinePlan.tsx`, `HistoryCalendar.tsx`, `ProgressSummary.tsx`, the ActiveWorkout/History/Progress pages, the set-input/set-load/history-calendar libraries, draft recovery, model/workout matching/analytics and scoped stylesheets. No new dependency or automatic deployment was added.

## Review and automated verification

The implementation pass recorded these final fresh results:

- `npm test`: **143 total, 142 passed, one existing real-cloud integration test skipped, zero failures**.
- `npm run typecheck`: passed.
- `npm run lint`: zero errors and four existing context-export Fast Refresh warnings.
- GitHub Pages-path production build: passed, **2545 modules** and **29 precache entries**. Final assets include `index-7S-2EAb9.js` and `index-CmRSE3EX.css`.

Independent read-only source/test review identified important gaps in incomplete-input recovery and mixed-row unit labels. Regression tests for these gaps were observed failing before correction and passing afterward. A minor modifier-shortcut issue was also fixed and covered, followed by the full checks above. No findings were intentionally deferred. The final fixes were verified by tests and were not independently re-reviewed; this report does not claim an unqualified reviewer pass.

Coverage includes selection capture/bounding/cancellation, checked-row edit rejection and matching uncheck feedback, retained raw input through workout/routine recovery with save blocking, modifier shortcuts, mode-specific clearing, mixed-row captions, positive added-load validation, snapshots, repetition, backup parsing, routine suggestions, profile matching and analytics separation. Calendar coverage includes display modes, actual-month day counts, inclusive ranges across months, range-browse stability and future-date restrictions. These are automated source, component and data checks, not app browser or device checks.

The Impeccable detector ran once and exited 0 with **13 font/radius advisories only** and no primary findings. The reported 12/13/10/18px text and 9/4/3px radius details fit the existing design intent. This detector result is not visual verification.

## Browser attempt and verification limits

Native Edge was launched, but the initial server inside the sandbox was unreachable. The server was restarted outside the sandbox and returned HTTP 200. Computer Use then stopped because it could not confidently verify the current browser URL. No successful new app browser walkthrough, mobile/touch check, native-selection gesture or visual verification was completed, and no app screenshots were captured. October 9/18 evidence remains historical and is not proof of these changes. The real-cloud integration test remains skipped.

The final local preview at [http://127.0.0.1:8082/](http://127.0.0.1:8082/) returned HTTP 200 with the title **Gain Train**. This verifies local serving, not browser interaction or publication. Native browser/device checks remain outstanding.

## Documentation scope

The documentation pass updates `DESIGN.md`, `PRODUCT.md`, `.impeccable/design.json`, `README.md` and this report only. It preserves original identity/provenance and existing sidecar HTML/CSS previews, adding bounded static toggle and Simple-calendar state specimens and updating behavior descriptions. The sidecar remains schemaVersion 2. Unrelated older documentation/preview drift was left unchanged.
