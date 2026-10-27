# Compact calendar controls — 26 October 2026

This follow-up implements the owner's mobile feedback after the workout refinement release. The [specification](../superpowers/specs/2026-10-26-calendar-controls.md) preserves the original Gain Train visual system and all record behavior. Publication uses the existing [Pages workflow](https://github.com/antonj997/gain-train-pwa/actions/workflows/deploy.yml).

- Edit sets appears only in the exercise’s … menu as one pressed toggle. Its icon changes when enabled. Activating it closes the menu and returns focus to that exercise's Options button.
- Two 44px icon buttons on one line replace the segmented Month/Date range and Detailed/Simple controls. Current mode is represented by the icon, title and accessible pressed state.
- Range selection uses a joined blue-tinted band with continuous top/bottom borders. Only visible row/period ends are capped. Geometry accounts for week wraps, hidden adjacent-month days and Simple's actual-day-only grid.
- The footer has a Workout day legend and one Show current month reset, absent when already showing the unfiltered current month.
- Simple uses 12px markers, 32px day rows (36px on coarse pointers), 2px row gaps and 8px card padding. Compact range-bound buttons and shorter instructions save further space. Full accessible dates and keyboard day navigation remain.

Focused range-edge and real React-render tests were observed failing for the missing behavior before implementation and passing afterward. Full checks: 147 tests total, 146 passed, one existing real-cloud integration test skipped, zero failures. Typecheck and Pages-path build passed; lint has zero errors and four existing context Fast Refresh warnings. The production PWA has 29 precache entries.

The design detector ran once on the changed UI and exited 0: no primary findings and 13 advisory font/radius notes. Existing small captions and intentionally compact calendar corners remain within this refinement's design intent. This is a static scan, not visual verification.

Read-only review found one keyboard issue: closing Edit sets removed the focused menu button. Focus is now explicitly returned to Options with preventScroll. No further findings were reported. That focus correction was source-checked; no native keyboard/browser test is claimed.

Browser rendering and mobile interaction remain unverified in this follow-up. The earlier Computer Use attempt ended because the current browser URL could not be verified confidently. Static React rendering, geometry tests and the production build do not constitute screenshot or touch-device verification. Earlier app images are not new proof.
