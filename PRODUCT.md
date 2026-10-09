# Gain Train
<!-- impeccable:product-schema 1 -->

## Platform
web — phone-first React PWA, also usable on desktop.

## Users and purpose
A lifter logging sets between exercises, often one-handed. Start, resume, record actual performance, finish, and review comparable history with minimal administration.

## Operating context
Local IndexedDB saves precede cloud synchronization. The app remains usable without an account and caches production files for offline use. Routines and prior results speed repeated sessions. Native numeric controls, clear save status and readable completed values are core affordances.

## Constraints
Preserve existing records and sync compatibility. No destructive migration or real-account testing. Keep top mobile-wide toasts and directly reachable abandon-before-finish. The user explicitly requires immediate set deletion; confirm exercise deletion only when its sets contain values or completed data. No set/exercise Undo feature.

Allow one running workout: a nondeleted draft with a non-null startedAt. Blank starts, routine starts from Home or Routines, and History Repeat share the same confirmation when another workout is running. “Keep current workout” cancels without changing it; “Abandon and start” replaces and creates atomically, checking localVersion and revision so newly changed work requires confirmation again. Historical draft entries with startedAt:null remain allowed alongside a running workout.

Saving cannot resurrect a removed workout. Existing whole-workout Undo uses guarded restoreWorkout and cannot create a second running draft. Backup restore rejects the whole transaction if it would introduce two running drafts. These are local storage guards; no record migration or cloud behavior change is part of this refinement.

## Delegated decisions
On 8 October 2026 the owner authorized implementing the complete three-agent review and delegated implementation/design decisions while unavailable. On 9 October 2026 the owner rejected the resulting design and requested the original Gain Train design from GitHub Pages and repository commit 3d2514862f7babecb964eb01b09230d804b86e77, while retaining quality-of-life improvements and bug fixes. This supersedes the Training Ledger visual direction. Preserve the original blue/navy/light-grey palette, rounded components, brand header, navigation, theme switch and identity assets documented in DESIGN.md. Adapt retained and future usability controls in src/styles/usability.css. The current restoration adds no product features or backend changes.
