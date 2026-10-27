# Edit switch follow-up — 26 October 2026

The owner's latest feedback supersedes the earlier toggle-and-close behavior in the [calendar report](2026-10-26-calendar-controls.md).

Edit sets now uses an accessible switch with a visible On/Off label and thumb. Its inline options remain open while it is toggled. Closing Options, opening another exercise's menu, or clicking/focusing outside the exercise clears editing. Escape restores Options focus; an active reorder consumes its first Escape to cancel that move. Record and deletion behavior are unchanged.

The date-range control offers a calendar icon with connected From/To endpoints; while range mode is active it offers a plain calendar to return to month filtering. Existing accessible names, pressed states and 44px targets remain.

Independent review caught early outside-pointer dismissal moving controls before the tap finished. Dismissal now waits until click activation; pointer-driven focus changes do not collapse the layout early. Scoped close actions ignore stale events from the previous exercise menu. A regression test was observed failing before that guard and passing afterward. The reviewer rechecked the correction and reported no further findings.

Final local checks: 151 tests total, 150 passed, one existing real-cloud integration test skipped, zero failures. Typecheck and the GitHub Pages build passed. Lint has zero errors and four existing Fast Refresh warnings in context files. The build transforms 2546 modules and generates 29 precache entries.

Browser inspection was attempted through Computer Use. It stopped because the tool could not confidently determine the current Edge URL; no further UI input was attempted. Browser rendering, physical touch and native focus behavior are therefore unverified. State tests, source review and build checks do not establish those results.
