# Workout refinements — 26 October 2026

Preserve the original Gain Train visual identity and local-first records. The owner has delegated routine implementation decisions and asked to continue without questions.

- Numeric set inputs still select all on a tap. Dragging a selection outside a single-line field must not start page auto-scrolling or set reordering. Keep normal page scrolling outside the field and handle-only set reordering.
- Show one persistent `Edit sets` toggle per exercise, with an accessible pressed state. Compact editing preserves ordering and immediate set removal.
- Suppress the empty-field prompts `Enter reps to complete this set.` and `Enter kg, or choose Bodyweight above.` Keep actual invalid-value feedback.
- All checked set values remain read-only until unchecked, including historical/compact editors. Attempted input interaction shows a short red instruction and highlights the matching completion button. Keep that button reachable in compact mode. Group load/measure changes must not rewrite or automatically uncheck completed sets.
- A Bodyweight exercise has an `Extra weight` toggle for unfinished sets. When enabled, the usual kg input holds only added kilograms, labelled `BW + kg`, while profile bodyweight remains a separate snapshot. Legacy BW records remain readable. Repetition, backup and suggestions preserve the mode; analytics do not confuse plain BW, added BW, assisted and weighted results.
- History contains one calendar/date controller followed by the workout list. It defaults to the current month and supports Detailed/Simple display. Simple shows one small square per current-month day, filled for completed workouts, with full accessible date labels.
- The same calendar chooses months or inclusive From/To date ranges, including ranges across months. There is no second date picker. Navigating a range's calendar must not silently change its chosen bounds. Future dates cannot be selected.
- Move the existing general statistics and explanations to Progress, using a clearly labelled recent 30-day summary. Preserve exercise progress.

No database migration, new dependency, set-delete confirmation or automatic deployment is required.
