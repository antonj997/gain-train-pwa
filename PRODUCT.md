# Gain Train
<!-- impeccable:product-schema 1 -->

## Platform
web — phone-first React PWA, also usable on desktop.

## Users and purpose
A lifter logging sets between exercises, often one-handed. Start, resume, record actual performance, finish, and review comparable history with minimal administration.

## Operating context
Local IndexedDB saves precede cloud synchronization. The app remains usable without an account and caches production files for offline use. Routines and prior results speed repeated sessions. Native numeric controls, clear save status and readable completed values are core affordances.

Settings Profile saves bodyweight in kg to an account-scoped local cache first. Decimal points and commas are accepted; blank clears the value, and a saved value must be greater than zero and at most 1000 kg. Signed-in changes queue for Supabase Auth metadata synchronization under gain_train_profile. A connection captures its account and access token, stops after account changes, and leaves failed or in-flight later edits queued. Profile metadata is editable data, never authorization. No database migration is required.

Uncompleted BW sets show registered bodyweight when available. Completing a BW set captures an optional bodyWeightKg snapshot; completed values do not follow later profile edits. New and repeated sets clear old snapshots. Existing completed sets without a snapshot remain valid and display BW.

Exercise “Edit sets” exposes compact numeric/type/removal rows and the shared ordering control used by routine planning. Numeric values select on focus and repeated click. Set types are ordered Warm-up, Working set, Cool-down. Pointer or keyboard reordering commits once at drop; cancel leaves order unchanged. Historical sessions retain Save/Discard. History opens on the current month, marks completed days in a Monday-first calendar, and filters sessions by the selected day without narrowing the selected-period statistics. Legacy rolling periods remain in “More periods”.

## Constraints
Preserve existing records and sync compatibility. No destructive migration or real-account testing. Keep top mobile-wide toasts and directly reachable abandon-before-finish. The user explicitly requires immediate set deletion; confirm exercise deletion only when its sets contain values or completed data. No set/exercise Undo feature.

Allow one running workout: a nondeleted draft with a non-null startedAt. Blank starts, routine starts from Home or Routines, and History Repeat share the same confirmation when another workout is running. “Keep current workout” cancels without changing it; “Abandon and start” replaces and creates atomically, checking localVersion and revision so newly changed work requires confirmation again. Historical draft entries with startedAt:null remain allowed alongside a running workout.

Saving cannot resurrect a removed workout. Existing whole-workout Undo uses guarded restoreWorkout and cannot create a second running draft. Backup restore rejects the whole transaction if it would introduce two running drafts. These local storage guards require no record migration.

## Delegated decisions
On 8 October 2026 the owner authorized implementing the complete three-agent review and delegated implementation/design decisions while unavailable. On 9 October 2026 the owner rejected the resulting design and requested the original Gain Train design from GitHub Pages and repository commit 3d2514862f7babecb964eb01b09230d804b86e77, while retaining quality-of-life improvements and bug fixes. This supersedes the Training Ledger visual direction. Preserve the original blue/navy/light-grey palette, rounded components, brand header, navigation, theme switch and identity assets documented in DESIGN.md. Adapt usability controls in src/styles/usability.css and their existing scoped stylesheets. The 18 October profile, set-editing, search and calendar features extend this original system.
