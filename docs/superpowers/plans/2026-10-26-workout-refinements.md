# Workout Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make set editing predictable and give History a single calendar-based date controller.

**Architecture:** Keep React, existing CSS tokens and JSON record formats. Independent work covers calendar/Progress and additional-BW data semantics; the primary worker integrates numeric interactions, locking and exercise controls.

**Tech Stack:** React 18, TypeScript, Zod, native pointer events, Node/tsx tests, Vite PWA.

**Spec:** `docs/superpowers/specs/2026-10-26-workout-refinements.md`

## Global Constraints

- Preserve the original Gain Train visual identity and local-first records.
- No database migration, new dependency, set-delete confirmation or automatic deployment is required.
- Checked sets require explicit unchecking before their values can change.
- One date controller on History; calendar before workout list; general stats on Progress.

## Review Focus

- A partial numeric selection dragged beyond the field must not activate page or set scrolling.
- Compact/historical completed rows must have a reachable way to uncheck and an accessible warning.
- Group load/measure/extra-weight changes must preserve completed values and BW snapshots.
- Cross-month and reverse date ranges must filter inclusive bounds without competing navigation state.
- Plain and extra-weight BW must roundtrip backups and remain separate in previous results and analytics.

## Task 1: BW data semantics

**Files:** `src/data/model.ts`, `src/data/analytics.ts`, `src/data/workouts.ts`, `src/lib/workout-editor.ts`, a new `src/lib/set-load.ts`, `tests/weighted-bodyweight.test.ts`.

**Interfaces:** `WorkoutSet.extraWeight?: boolean`; true is meaningful only for bodyweight. `hasExtraWeight(set): boolean`; `changeSetLoad(set, load)`, `changeSetMeasure(set, measure)`, `changeExtraWeight(set, enabled)` return a set, retaining a completed set unchanged. UI imports these helpers from `src/lib/set-load.ts`.

- [x] Write/run failing tests for optional-field roundtrip, positive added kg validation, labels, matching/suggestions, repeating and group-change guards.
- [x] Implement the optional flag and helpers. Keep `load` enum unchanged for server compatibility and do not invent a total-bodyweight 1RM.
- [x] Run targeted tests, typecheck and scoped lint.

## Task 2: Calendar and Progress

**Files:** `src/components/HistoryCalendar.tsx`, `src/lib/history-calendar.ts`, `src/styles/history-calendar.css`, `src/pages/History.tsx`, `src/pages/Progress.tsx`, new `src/components/ProgressSummary.tsx` if useful, associated calendar/page tests.

**Interfaces:** The calendar owns one month/range selection API consumed by History. BW format is consumed through the existing `labelSet` and analytics APIs; this task does not edit their implementations.

- [x] Write/run failing date-range and simple-view tests, including reverse/cross-month bounds and future-date clamping.
- [x] Implement one calendar controller, Detailed/Simple modes and inclusive ranges; remove History's old period picker and summary.
- [x] Move general summaries/explanation to Progress with explicit recent-30-day dates.
- [x] Run focused tests, typecheck and scoped lint.

## Task 3: Numeric interaction and set controls

**Files:** `src/components/SetRow.tsx`, `src/components/RoutinePlan.tsx`, `src/pages/ActiveWorkout.tsx`, `src/lib/set-editing.ts`, `src/styles/set-editing.css`, scoped new numeric-input helper/component and tests as needed.

**Interfaces:** Consume Task 1 set-load helpers. Keep existing reorder-controller API and captured bodyweight behavior.

- [x] Investigate native selection and app scroll triggers, then write/run failing interaction and read-only markup tests.
- [x] Implement bounded single-line selection gestures, retaining select-all tap and ordinary scrolling elsewhere.
- [x] Keep completed numeric fields read-only with a red local instruction and highlighted reachable checkbox; block programmatic edits too. Suppress only empty prompts.
- [x] Replace separate edit/finish actions with one persistent pressed toggle. Add BW extra-weight controls using Task 1 helpers.
- [x] Run targeted interaction, render and editor tests.

## Task 4: Integrated verification

- [x] Independently review changed source, data handling and accessibility.
- [x] Run full tests, typecheck, lint and Pages-path production build.
- [x] Attempted the bounded browser pass. The initial sandboxed server was unreachable; it was restarted outside the sandbox, then Computer Use halted on URL-confidence policy. No app visual or native-touch pass is claimed; device verification remains open.
- [x] Update product/design documentation and record checks. Leave local preview available; publication is a separate user action.

## Completion evidence

Tasks 1–3 are implemented. Final full suite: 143 total, 142 passed, one existing live-cloud skip, zero failures. Typecheck passed; lint has zero errors and four existing Fast Refresh context warnings. Pages-path production build passed with 29 precache entries.

The independent review found mixed-row unit labels and unfinished input recovery defects. Regression cases failed before fixes, then passed with the full suite. Copy/select-all/find modifier handling was also corrected. No review finding is intentionally deferred. Raw input text now belongs to local recovery only, and main record validation blocks saving until it is corrected.

At the end of implementation, the work was local on codex/workout-refinements-oct26 and the preview at http://127.0.0.1:8082/ returned HTTP 200. Publication now proceeds through the existing GitHub Pages workflow so the owner can try it from a phone. Native mobile gestures and visual verification remain unconfirmed because Computer Use ended.
