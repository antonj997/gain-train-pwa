# Exercise edit switch implementation plan

**Goal:** Make Edit sets visibly switchable and active only while its exercise options stay open; clarify the date-range icon.

**Architecture:** One nullable options state couples the open exercise and its editing state. The existing inline menu stays open while toggling. Closing it, changing exercise menus, pressing Escape or moving outside the exercise resets editing. A calendar with connected start/end markers represents choosing a From/To period.

**Tech stack:** Existing React, TypeScript, CSS and Node test runner. No dependencies or data changes.

**Spec:** Owner's current request and the compact-calendar specification, superseding its earlier toggle-close behavior. The owner has delegated these small implementation choices.

- [x] Test options lifecycle: toggle while open, close/reopen, switch exercise and ignore stale actions.
- [x] Replace separate menu/editing state in ActiveWorkout; show an accessible On/Off switch and retain menu while editing. Dismiss outside the exercise or with Escape without stealing normal input focus.
- [x] Replace the generic calendar icon with connected From/To markers; the active mode offers the return-to-month icon. Retain 44px controls, keyboard labels and range behavior.
- [x] Run tests, typecheck, lint and Pages build. Review changes and update behavior documentation.

Release procedure: push the verified change through the existing Pages workflow, wait for deployment success and compare live asset hashes with the tested build.

Native browser/device checks are separate from state tests and static rendering. Do not claim them without direct verification.
