# Workout screen and Quiet visual system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered exercise card with direction A (the set badge, the column headings and ⋯ open bottom sheets), add per-set load types and drop sets, and move the app to the Quiet light/dark visual system.

**Architecture:** Pure helpers first (drop rules, load keys, centring arithmetic), each unit-tested; then shared UI primitives (tokens, Sheet, Segmented, Switch); then the workout pieces (`SetLine` and four exercise sheets) composed by a rewritten `ExerciseCard`, then the `ActiveWorkout` top bar, Finish sheet, rest bar and next-set chip; then `RoutinePlan`; then CSS cleanup, docs and browser verification. Records, sync, drafts and `useWorkoutAutosave` are untouched.

**Tech Stack:** React 18.3, TypeScript, Vite PWA, Radix Dialog 1.1, zod, node:test via tsx, Playwright (preinstalled globally; verification script only).

**Spec:** `docs/superpowers/specs/2026-10-28-workout-screen-design.md`. Read it before each task; section numbers below (§) refer to it.

## Global Constraints

- No database, migration or sync change. The only data addition is the optional set field `drop: boolean`. No `SCHEMA_VERSION` bump.
- No new runtime dependencies and no web fonts. Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Tabular figures for every number.
- Colours only through the tokens in `src/styles/tokens.css` (§3 table, verbatim). `ink-3` is 3.1:1 on white, so it is for disabled controls, icons and separators only. Readable muted text (Previous column, "Last: …", hints, headings) uses `ink-2`.
- Type sizes 12 / 13 / 15 / 17 / 20 / 28 px; weights 400 / 600 / 700. Spacing 4 / 8 / 12 / 16 / 24 / 32. Radii 10 (inputs, badges, small buttons) / 12 (buttons) / 18 (cards) / 22 (sheet top). Minimum target 44 px. Motion 150–200 ms ease-out, none under `prefers-reduced-motion: reduce`.
- Set sections in code stay `"warmup" | "working" | "winddown"`. The UI says Warm-up / Working / Cool-down.
- Set deletion is immediate (no confirmation). No set or exercise Undo. Checked sets are read-only until unchecked ("Uncheck this set to edit its values.").
- Copy given in the spec is used verbatim.
- Component render tests use `loadComponent` from `tests/helpers/render.ts` (Task 5). tsx's own `require` compiles TSX with the classic runtime and fails with "React is not defined". Existing test files keep their own harnesses.
- Radix Dialog content renders through a portal that does not run in server rendering. Each sheet file therefore exports a named `…Body` component (plain markup, tested) and a default export that wraps it in `Sheet`.
- Before every commit: `npx prettier --write` on changed files, then `npm run typecheck && npm run lint && npm test`.

## Review Focus

- **Records written by an older app version:** an older app shows drops as ordinary sets, so it can delete a drop's parent or check a drop on its own. If `validate` rejected such records they would be quarantined on download. `validate` repairs them instead: a misplaced drop, or one whose `done` differs from its set's, becomes an ordinary set. Pinned in Task 2.
- **Recovered drafts:** a localStorage recovery draft containing `drop` and unfinished `inputText` must parse and keep both. Pinned in Task 2.
- **Empty exercises:** after every set is deleted through the Set sheet, the default-load and heading helpers must not throw, and **+ Add set** must use `initialSet`. Pinned in Tasks 2 and 4.
- **Narrow phones (under 360 px):** the Previous column hides and rows must not scroll horizontally. Pinned in Task 13's browser check at 340 px.
- **Escape during a keyboard move in Reorder sets:** Radix listens for Escape in the capture phase, so the sheet would close mid-move. Escape must cancel the move first and leave the sheet open. Pinned in Task 8 and Task 13.

**Spec deviation for the owner to confirm:** §2.5 and §4 say `validate` enforces drop placement with the message "A drop must follow a working set.". This plan repairs rather than rejects (first Review Focus line), because the new UI cannot create a misplaced drop and rejecting older-app records would quarantine them. That message is therefore not used.

---

### Task 1: Quiet tokens and system font

**Files:**

- Create: `src/styles/tokens.css`
- Modify: `src/index.css` (import `tokens.css` first; redefine the existing colour variables (`--blue`, `--ink`, `--soft`, `--line`, `--surface`, `--background`, `--card`, `--border`, `--muted-foreground`, `--completed` and their `.dark` copies) in terms of the tokens; body font → system stack; `font-variant-numeric: tabular-nums` on `input`, `output` and numeric text), `src/styles/usability.css` (same mapping for its `:root` / `.dark` variables)
- Modify: `index.html` (the `theme-color` meta and the inline theme script: light `#F4F5F7`, dark `#0F1115`), `src/contexts/ThemeContext.tsx` (same two values), `vite.config.ts` (manifest `background_color` and `theme_color` → `#0F1115`)
- Test: `tests/tokens.test.ts`

**Interfaces:**

- Produces, on `:root` (light) and `.dark`: `--gt-ground`, `--gt-surface`, `--gt-surface-2`, `--gt-line`, `--gt-line-strong`, `--gt-ink`, `--gt-ink-2`, `--gt-ink-3`, `--gt-accent`, `--gt-on-accent`, `--gt-accent-soft`, `--gt-done`, `--gt-done-soft`, `--gt-warm-fg`, `--gt-warm-bg`, `--gt-cool-fg`, `--gt-cool-bg`, `--gt-danger-fg`, `--gt-danger-bg`.
- Produces, on `:root` only: `--gt-font`, `--gt-fs-1`…`--gt-fs-6` (12, 13, 15, 17, 20, 28 px), `--gt-space-1`…`--gt-space-6` (4, 8, 12, 16, 24, 32 px), `--gt-radius-sm` 10px, `--gt-radius-md` 12px, `--gt-radius-lg` 18px, `--gt-radius-xl` 22px, `--gt-motion` `180ms ease-out` (set to `0ms` under reduced motion).

- [ ] **Step 1: Write the failing test** `tests/tokens.test.ts`. It reads `src/styles/tokens.css` and extracts `--gt-*: #hex` from the `:root` and `.dark` blocks. It asserts every colour token above exists in both blocks, then computes WCAG contrast and asserts ≥ 4.5 in both themes for ink/ground, ink/surface, ink-2/surface, ink-2/surface-2, ink-2/ground, accent/surface, accent/accent-soft, on-accent/accent, done/done-soft, warm-fg/warm-bg, cool-fg/cool-bg and danger-fg/danger-bg. It asserts ink-3/surface ≥ 3. (With the spec values the lowest text pair is accent/accent-soft at 4.97 in light.)
- [ ] **Step 2: Run** `npx tsx --test tests/tokens.test.ts`. Expected: FAIL (file not found).
- [ ] **Step 3: Implement** the files listed above.
- [ ] **Step 4: Run** the token test (PASS), then `npm test && npm run build`.
- [ ] **Step 5: Commit** `feat(style): add Quiet colour tokens and system font`.

### Task 2: Drop-set data rules

**Files:**

- Create: `src/data/drops.ts` (type-only imports from `./model`, so `model.ts` can import it without a runtime cycle; new ids come from `crypto.randomUUID()`)
- Modify: `src/data/model.ts`:
  - `setSchema` gains `drop: z.boolean().optional()`.
  - `newSet` copies `drop: true` when `prior?.drop`, so `repeatExercises` keeps drops.
  - In `validate`, right after `keepUnknownFields`, every workout or routine exercise's `sets` is replaced by `normalizeDrops(sets)`.
- Modify: `src/data/selectors.ts` (`setCount` and `doneSetCount` skip drops), `src/lib/workout-editor.ts` (new helpers below; `finishWorkout` needs no change because drops share their set's `done`)
- Test: `tests/drops.test.ts`

**Interfaces:**

- Produces in `src/data/drops.ts` (pure; inputs are never mutated):
  - `isDrop(set: WorkoutSet): boolean`
  - `dropGroup(sets: WorkoutSet[], index: number): { start: number; end: number }`: `start` is the parent's index (walking back over drops); `end` is exclusive, just after the parent's last drop.
  - `normalizeDrops(sets: WorkoutSet[]): WorkoutSet[]`: removes `drop` from a drop that is first, follows a `warmup` / `winddown` set, or has a `done` different from its parent's. Returns the same array when nothing changes.
  - `addDrop(sets: WorkoutSet[], setId: string): WorkoutSet[]` inserts the new drop at the target's group end. It returns `sets` unchanged when the target is done or is not a working set or drop. The new drop: `done: false`, `reps: null`, `section: "working"`, `drop: true`, and the target's `load` / `measure` / `extraWeight`. Its `weight` follows §2.5: Weight and BW + kg → `Math.round((w * 0.8) / 2.5) * 2.5`. A BW + kg result of 0 → plain BW (no `extraWeight`, `weight: null`). Assisted and plain BW → `weight: null`.
  - `removeSetOrDrop(sets: WorkoutSet[], setId: string): WorkoutSet[]`: a parent goes with its drops; a drop goes alone.
  - `changeSection(sets: WorkoutSet[], setId: string, section: WorkoutSet["section"]): WorkoutSet[]`: no-op on a done set. When a set with drops becomes `warmup` / `winddown`, its drops lose `drop` and take that section.
  - `type SetTone = "working" | "warmup" | "winddown" | "drop"`
  - `type SetBadgeInfo = { text: string; tone: SetTone; label: string; title: string }`
  - `setBadge(sets: WorkoutSet[], index: number): SetBadgeInfo`. Working sets are numbered among working non-drop sets: `{ text: "2", label: "Set 2, working set. Change type, load or delete", title: "Set 2" }`. Warm-up: `{ text: "W", label: "Warm-up set. Change type, load or delete", title: "Warm-up set" }`. Cool-down: `{ text: "C", label: "Cool-down set. Change type, load or delete", title: "Cool-down set" }`. Drop: `{ text: "↓", label: "Drop after set 2. Change load or delete", title: "Drop" }`.
- Produces in `src/lib/workout-editor.ts`:
  - `groupComplete(sets: WorkoutSet[], index: number): boolean`: `validSet` holds for the set and each of its drops.
  - `toggleGroupCompletion(sets: WorkoutSet[], setId: string, profileWeight: number | null): WorkoutSet[]`: applies `toggleSetCompletion` to the set and its drops. When checking and `!groupComplete`, it returns `sets` unchanged.
  - `appendSet(exercise: Exercise): Exercise`: `newSet` of the last non-drop set with `drop` removed, unchecked; `initialSet(exercise.exerciseId)` when there are no sets.

- [ ] **Step 1: Write the failing tests** in `tests/drops.test.ts`:
  - `addDrop prefills 80% rounded to 2.5 kg and keeps the load`: 100 → 80; 64 → 52.5; BW + kg 2.5 → plain BW; assisted 25 → `null`. The drop is inserted after existing drops. Returns the input array for a done set and for a warm-up.
  - `removeSetOrDrop removes a set with its drops, or one drop`.
  - `changeSection turns drops into ordinary sets of the new section`.
  - `setBadge numbers working sets only`: sections [warmup, working, drop, working, winddown] give texts ["W", "1", "↓", "2", "C"], and the drop's label is "Drop after set 1. Change load or delete".
  - `a set with an empty drop cannot be checked`: `groupComplete` is false and `toggleGroupCompletion` returns the input. After filling the drop's reps, both checking and unchecking apply to the set and its drop.
  - `normalizeDrops repairs records from older app versions`: a first-position drop, a drop after a cool-down, and a drop whose `done` differs from its parent's all lose `drop`. A valid group returns the same array instance.
  - `validate keeps drops and repairs misplaced ones instead of rejecting`: `validate("workout", …)` keeps `drop` on a valid drop. An orphan drop is accepted and returned without `drop`.
  - `drops survive a backup round-trip`: `validate("workout", JSON.parse(JSON.stringify(validated)))` deep-equals `validated`.
  - `recovered drafts keep drop and unfinished text`: `parseWorkoutDraft` on a draft whose set has `drop: true` and `inputText: { reps: "1e" }` returns both.
  - `finishing leaves out an unchecked set with its drops`: `finishWorkout` on [unchecked set, its unchecked drop, checked set] keeps only the checked set.
  - `appendSet copies the last non-drop set and uses initialSet when empty`.
  - `repeatExercises keeps planned drops`.
  - `set counts treat a set and its drops as one`: one checked set with one drop → `setCount` 1, `doneSetCount` 1.
- [ ] **Step 2: Run** `npx tsx --test tests/drops.test.ts`. Expected: FAIL (`Cannot find module '../src/data/drops'`).
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** the new tests (PASS), then all of `npm test`. `forward-compat`, `ledger-data` and `sync` must still pass.
- [ ] **Step 5: Commit** `feat(data): add drop sets and repair misplaced drops`.

### Task 3: Previous results, analytics and History for drops

**Files:**

- Modify: `src/data/workouts.ts`, `src/data/start.ts` (`suggestedExercises` uses `previousResult` instead of `setProfileOrdinal` + `previousSetFor`), `src/data/analytics.ts` (`progressFor` never picks a drop as a session's best set), `src/pages/History.tsx` (detail list: "Set N" numbering counts done non-drop sets; a drop renders `↳ ` + `labelSet(s)` with no "Set" label)
- Test: `tests/drops-history.test.ts`, plus one case in `tests/history-calendar-render.test.ts`

**Interfaces:**

- Consumes: `isDrop`, `dropGroup` (Task 2).
- Produces in `src/data/workouts.ts`:
  - `setProfileOrdinal(sets, index)` skips drops when counting.
  - `previousResult(prior: WorkoutSet[], sets: WorkoutSet[], index: number): WorkoutSet | undefined`. For a non-drop it calls `previousSetFor(prior without drops, sets[index], setProfileOrdinal(sets, index))`. For a drop it finds the parent's previous result and returns the drop at the same position after it in `prior`, or that group's last drop, or `undefined`.

- [ ] **Step 1: Write the failing tests:**
  - `drops never shift working-set ordinals`: for [set, drop, set], `setProfileOrdinal(sets, 2) === 1`.
  - `a drop's previous result is the matching drop from last time`: prior [100×5, ↓80×6, 100×5], current [set, drop, set]. Index 1 → the 80×6 drop; index 2 → the second 100×5.
  - `progress ignores drops for the best set`: a session whose drop has a higher estimate than its parent still reports the parent.
  - `suggested routine sets keep drops`: `suggestedExercises` on a routine exercise with a drop keeps `drop: true` on it.
  - In `history-calendar-render.test.ts`: a completed workout with a drop renders `↳ 80 kg × 4` and the next set is still "Set 2".
- [ ] **Step 2: Run** `npx tsx --test tests/drops-history.test.ts tests/history-calendar-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command plus `tests/ledger-data.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(data): match, analyse and label drop sets`.

### Task 4: Per-set load keys

**Files:**

- Create: `src/lib/load-keys.ts`
- Test: `tests/load-keys.test.ts`

**Interfaces:**

- Consumes: `changeSetLoad`, `changeExtraWeight`, `changeSetMeasure`, `hasExtraWeight` (`src/lib/set-load.ts`).
- Produces:
  - `type LoadKey = "weight" | "bw" | "bwplus" | "assisted"`; `type LoadMarker = "none" | "bw" | "plus" | "minus" | "kg"`
  - `loadKeyOf(set: WorkoutSet): LoadKey`
  - `withLoadKey(set: WorkoutSet, key: LoadKey): WorkoutSet`: unchecked sets only (a checked set is returned unchanged).
  - `defaultLoadKey(sets: WorkoutSet[]): LoadKey`: the most common key, ties to the earliest set, `"weight"` for `[]`.
  - `exerciseMeasure(sets: WorkoutSet[]): "reps" | "seconds"`: same rule over `measure ?? "reps"`, `"reps"` for `[]`.
  - `loadMarker(set: WorkoutSet, defaultKey: LoadKey): LoadMarker`: `"none"` when the keys match; otherwise bw → `"bw"`, bwplus → `"plus"`, assisted → `"minus"`, weight → `"kg"`.
  - `loadHeading(key: LoadKey): "kg" | "BW" | "+kg" | "Assist"`
  - `countHeading(sets: WorkoutSet[]): "Reps" | "Sec" | "Reps/sec"`
  - `applyExerciseLoad(sets: WorkoutSet[], key: LoadKey): WorkoutSet[]` and `applyExerciseCount(sets: WorkoutSet[], measure: "reps" | "seconds"): WorkoutSet[]`: unchecked sets only, per-set exceptions overwritten. Seconds makes unchecked sets bodyweight (`changeSetMeasure`).
  - `allowedLoadKeys(measure: "reps" | "seconds"): LoadKey[]`: seconds → `["bw", "bwplus"]`, otherwise all four.

- [ ] **Step 1: Write the failing tests:**
  - Defaults: `[bwplus, bw, assisted]` → `bwplus`; `[bw, weight, weight]` → `weight`; `[]` → `weight`. `exerciseMeasure([])` → `reps`.
  - One marker case per key. Headings for each key. `countHeading` gives `Reps`, `Sec`, and `Reps/sec` for a mix.
  - `applyExerciseLoad` leaves checked sets alone and overwrites unchecked exceptions. `applyExerciseCount("seconds")` makes unchecked sets `bw`.
  - `allowedLoadKeys("seconds")` deep-equals `["bw", "bwplus"]`.
  - `loadKeyOf(withLoadKey(s, k)) === k` for every key, and changing the key clears `weight` (the existing `changeSetLoad` rule).
- [ ] **Step 2: Run** `npx tsx --test tests/load-keys.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/lib/load-keys.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lib): add per-set load keys and markers`.

### Task 5: Bottom sheets and shared UI primitives

**Files:**

- Modify: `src/components/ui/dialog.tsx`:
  - `DialogContent` gains `backdrop?: "dim" | "light"` (default `"dim"`), set as `data-backdrop` on the overlay.
  - The close control becomes a grab handle at the top of the sheet with `aria-label="Close"`.
- Modify: `src/styles/primitives.css`:
  - Every dialog becomes a bottom sheet: full width, top radius 22, height fitting its content up to `70vh` with internal scroll, safe-area bottom padding.
  - Backdrops: light `rgb(20 22 26 / 0.08)`, dim `0.38`.
  - At `min-width: 640px`, a centred panel with max width 480 px.
  - `.picker-dialog` keeps a full-height sheet.
- Modify: `src/index.css` and `src/styles/usability.css` (delete the centred `.app-dialog` rules that would override the sheet)
- Create: `src/components/ui/Sheet.tsx`, `src/components/ui/Segmented.tsx`, `src/components/ui/Switch.tsx`, `src/styles/components.css` (`.btn-primary`, `.btn-secondary`, `.btn-quiet`, `.btn-danger` at 40 and 48 px, `.icon-btn` 44 px, `.card`, `.banner`, segmented and switch styles)
- Modify: `src/components/ConfirmDialog.tsx` (same props; renders through `Sheet`)
- Create: `tests/helpers/render.ts`
- Test: `tests/ui-primitives.test.ts`

**Interfaces:**

- Produces:
  - `Sheet(props: { open: boolean; onClose: () => void; title: ReactNode; backdrop?: "dim" | "light"; className?: string; contentRef?: Ref<HTMLDivElement>; onEscapeKeyDown?: (event: KeyboardEvent) => void; children: ReactNode })`: a Radix Dialog root with `title` as `DialogTitle`. It closes on outside tap, Escape and the handle.
  - `Segmented<T extends string>(props: { label: string; value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (value: T) => void })`: `role="radiogroup"` with `aria-label`. Each option is a `button` with `role="radio"`, `aria-checked` and roving `tabIndex`. Arrow keys move between options and skip disabled ones.
  - `Switch(props: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void })`: a `button` with `role="switch"` and `aria-checked`.
  - `loadComponent(path: string, aliases?: Record<string, unknown>): Promise<ElementType>` with `loadModule(path)` for named exports, in `tests/helpers/render.ts`:
    - Transpiles `.tsx` with `jsx: ReactJSX` (as `history-calendar-render.test.ts` does) and runs it in `runInNewContext`.
    - An `@/…` import that resolves to a `.tsx` file is loaded recursively with a shared cache. Other `@/…` ids go to `require` of `../src/…`. `.css` → `{}`. `aliases` override any id.

- [ ] **Step 1: Write the failing tests** with `loadComponent`. Segmented renders `role="radiogroup"`, its `aria-label`, exactly one `aria-checked="true"`, and `disabled=""` on disabled options. Switch renders `role="switch"` and `aria-checked="false"`.
- [ ] **Step 2: Run** `npx tsx --test tests/ui-primitives.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run** the test (PASS) and `npm test`. Then `npm run dev` and check two widths:
  - At 390 px: History → a workout → Delete opens as a bottom sheet with the handle. Escape and an outside tap both close it.
  - At 1024 px: it is a centred panel.
- [ ] **Step 5: Commit** `feat(ui): present dialogs as bottom sheets; add Sheet, Segmented and Switch`.

### Task 6: SetLine

**Files:**

- Create: `src/components/workout/SetLine.tsx`, `src/components/workout/SetBadge.tsx`, `src/styles/workout.css` (imported by `SetLine`)
- Modify: `tests/workout-controls-render.test.ts` and `tests/set-lock.test.ts` (render `SetLine`; keep every assertion that is not about compact mode; delete the compact-only tests)

**Interfaces:**

- Consumes: `SetBadgeInfo` (Task 2), `LoadMarker` (Task 4), `SetNumberInput`, `getSetIssues`, `bodyWeightForSet`, `changeSetNumber`.
- Produces:
  - `SetBadge(props: { badge: SetBadgeInfo; editing?: boolean; onClick: () => void })`: a 44 px button with `aria-label={badge.label}` and `data-tone={badge.tone}`.
  - `SetLine(props)`. Props:
    - Data: `set: WorkoutSet; mode: "log" | "plan"; name: string; badge: SetBadgeInfo; previous?: string; marker: LoadMarker; bodyWeightKg?: number | null`
    - Row state: `next?: boolean; editing?: boolean; canCheck: boolean; checkHint?: string`
    - Callbacks: `onOpenSheet: () => void; onChange: (set: WorkoutSet) => void; onToggleDone?: () => void; onFocus?: () => void`
  - Markup: `div[data-set-id]` with class `set-line` plus `is-done`, `is-drop`, `is-next` and `is-editing` as they apply. Columns: badge · `.set-previous` (hidden below 360 px) · load · count · ✓.
  - The ✓ keeps `SetRow`'s `aria-label` / `aria-pressed`. It is disabled while `!set.done && !canCheck`. When disabled it has `aria-describedby` pointing at visually hidden `checkHint` text. In `mode: "plan"` and on drops it is replaced by an empty cell that keeps the grid.
  - Load cell:
    - Plain BW shows "BW", plus " {kg} kg" when `bodyWeightForSet` knows it (accessible text "Bodyweight {kg} kilograms").
    - Otherwise a `SetNumberInput` with the marker inside the field: `plus` → "+" prefix, `minus` → "−" prefix, `kg` → small "kg" suffix, `bw` → the text "BW" (no input).
    - Markers are `aria-hidden`. The input's accessible name ends in "added kilograms", "assistance kilograms" or "kilograms".
  - Locking, issue messages, unfinished text and the just-checked animation behave as in `SetRow`.

- [ ] **Step 1: Port the tests.** Render `SetLine` with `mode: "log"`, `badge: setBadge([set], 0)`, `marker: "none"`, `canCheck: true`. Then add:
  - `exception markers render inside the field`: `plus` → a "+" before the input and an accessible name with "added kilograms"; `minus` → "−" and "assistance kilograms"; `kg` → a "kg" suffix.
  - `drops and planned sets have no done button`: a drop and a `mode: "plan"` row render no `aria-pressed`.
  - `a set waiting on its drops explains the disabled check`: `canCheck: false` with `checkHint: "Fill in or delete its drops to check this set."` renders a disabled ✓ whose `aria-describedby` points at that text.
  - `the edited set is marked`: `editing: true` adds `is-editing`.
- [ ] **Step 2: Run** `npx tsx --test tests/workout-controls-render.test.ts tests/set-lock.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `SetBadge` and `SetLine`, moving logic over from `SetRow`.
- [ ] **Step 4: Run** the same command (PASS), then `npm test`.
- [ ] **Step 5: Commit** `feat(workout): add SetLine with load markers and drop rows`.

### Task 7: Keep the edited set above the sheet

**Files:**

- Create: `src/lib/keep-above-sheet.ts`, `src/hooks/useKeepAboveSheet.ts`
- Test: `tests/keep-above-sheet.test.ts`

**Interfaces:**

- Produces:
  - `centreScrollDelta(m: { visibleTop: number; sheetTop: number; rowTop: number; rowHeight: number }): number`, equal to `m.rowTop + m.rowHeight / 2 - (m.visibleTop + (m.sheetTop - m.visibleTop) / 2)`.
  - `useKeepAboveSheet(rowId: string | null, sheet: RefObject<HTMLElement>): void`:
    - While `rowId` is set, a `ResizeObserver` writes the sheet's height to `--sheet-space` on `document.documentElement`. The property is removed on close. `workout.css` adds `var(--sheet-space, 0px)` to the workout list's bottom padding.
    - On the first frame after opening it measures:
      - `visibleTop`: the bottom of `[data-top-bar]`, or 0 when there is none.
      - `sheetTop`: the top of `sheet`.
      - The row: `[data-set-id="{rowId}"]`.
    - Then it calls `window.scrollBy({ top: delta, behavior })`, with behavior `"smooth"`, or `"auto"` under reduced motion.

- [ ] **Step 1: Write the failing test** `centreScrollDelta`: visible area 70–470 with the row centre at 500 → `230`; row already centred → `0`; row above the area → negative.
- [ ] **Step 2: Run** `npx tsx --test tests/keep-above-sheet.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(workout): keep the edited set centred above its sheet`.

### Task 8: Exercise sheets

**Files:**

- Create: `src/components/workout/SetSheet.tsx`, `LoadCountSheet.tsx`, `ExerciseMenuSheet.tsx`, `ReorderSetsSheet.tsx`
- Modify: `src/components/SortableSetList.tsx` (new optional prop `onMovingChange?: (moving: boolean) => void`, called when a keyboard or pointer move starts and ends), `tests/set-component.test.ts`
- Test: `tests/exercise-sheets.test.ts`

**Interfaces:**

- Consumes: `Sheet`, `Segmented`, `Switch` (Task 5); `LoadKey`, `allowedLoadKeys` (Task 4); `SetBadgeInfo`, `dropGroup` (Task 2); `SortableSetList`.
- Produces:
  - `SetSheetBody(props: { badge: SetBadgeInfo; previous?: string; set: WorkoutSet; dropCount: number; exerciseDefault: LoadKey; onSection: (section: WorkoutSet["section"]) => void; onLoadKey: (key: LoadKey) => void; onAddDrop: () => void; onDelete: () => void })`:
    - The title line shows `badge.title`, with "Last time {previous}" on its right.
    - The section Segmented reads Warm-up / Working / Cool-down. A drop hides it and shows "Done straight after the set above, at a lower weight. No rest in between."
    - "Load for this set" is a Segmented with Weight / BW / BW + kg / Assist. Options outside `allowedLoadKeys(set.measure ?? "reps")` are disabled. Under it: "Same as the exercise" or "Differs from the exercise".
    - One button row:
      - **Add drop** ("Add another drop" on a drop). Not rendered when `set.done` or the set is a warm-up / cool-down.
      - **Delete set** / "Delete drop" / "Delete set and 1 drop" / "Delete set and {n} drops".
    - No Done button.
  - Default `SetSheet(props: SetSheetBody props & { open: boolean; onClose: () => void; contentRef: Ref<HTMLDivElement> })`, with `backdrop="light"`.
  - `LoadCountSheetBody(props: { loadKey: LoadKey; measure: "reps" | "seconds"; onLoadKey: (key: LoadKey) => void; onMeasure: (measure: "reps" | "seconds") => void; onDone: () => void })`:
    - Title "Load and count".
    - Load Segmented: Weight / Bodyweight / Assisted. Under seconds, Weight and Assisted are disabled with "Timed sets use bodyweight".
    - The "Add extra weight" Switch appears only for `bw` / `bwplus`.
    - Count Segmented: Reps / Seconds.
    - Note: "Applies to the sets you haven't checked yet."
    - A Done button.
  - Default `LoadCountSheet` with the dim backdrop.
  - `ExerciseMenuSheetBody(props: { hint: string; canMoveUp: boolean; canMoveDown: boolean; onLoadAndCount: () => void; onReorder: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void })`: the actions in §2.4 order. Remove exercise is `.btn-danger`. The default export takes the exercise name as its title.
  - `ReorderSetsSheet(props: { open: boolean; exercise: Exercise; onReorder: (sets: WorkoutSet[]) => void; onClose: () => void })`:
    - Passes only non-drop sets to `SortableSetList` and shows each set's drops nested beneath it, without handles.
    - On reorder it rebuilds `sets` by concatenating each parent's `dropGroup` in the new order.
    - It passes `onEscapeKeyDown` that calls `event.preventDefault()` while `onMovingChange` reports a move. The Escape still reaches `SortableSetList`, which cancels the move.

- [ ] **Step 1: Write the failing tests:**
  - `Set sheet hides Add drop on a checked set and on warm-ups`.
  - `Set sheet names the drops it will delete`: `dropCount: 2` renders "Delete set and 2 drops".
  - `Set sheet disables weight loads for timed sets`: with `measure: "seconds"`, the Weight and Assist radios are disabled.
  - `Load and count shows extra weight only for bodyweight and explains the seconds rule`.
  - `reordering keeps drops with their set`: moving B above A in [A, ↓a, B] gives [B, A, ↓a]. Test the exported pure helper `reorderGroups(sets: WorkoutSet[], parentIds: string[]): WorkoutSet[]` from `ReorderSetsSheet.tsx`.
  - In `set-component.test.ts`: `SortableSetList reports when a keyboard move starts and ends`.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-sheets.test.ts tests/set-component.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four sheets and the `SortableSetList` prop.
- [ ] **Step 4: Run** the same command (PASS), then `npm test`.
- [ ] **Step 5: Commit** `feat(workout): add set, load-and-count, menu and reorder sheets`.

### Task 9: Exercise card

**Files:**

- Modify: `src/components/ExerciseCard.tsx` (rewrite), `src/pages/ActiveWorkout.tsx` (call site only: drop the `options` / `changeOptions` / `onFocusSet` props and the menu state)
- Delete: `src/components/SetRow.tsx`, `src/hooks/useCloseOptionsOutside.ts`, `src/lib/exercise-options.ts`, `tests/exercise-options.test.ts`
- Test: `tests/exercise-card.test.ts`

**Interfaces:**

- Consumes: Tasks 2, 3, 4, 6, 7 and 8.
- Produces: `ExerciseCard(props: { exercise: Exercise; isFirst: boolean; isLast: boolean; lastSession?: LastSession; bodyWeightKg: number | null; nextSetId?: string; onChange: (exercise: Exercise) => void; onMove: (step: -1 | 1) => void; onRemove: () => void; onSetDone: () => void })`.
  - Header: the name; "Last: {date}" when `lastSession` exists (formatted with `localizedDate` and `{ day: "numeric", month: "short" }`, e.g. "Last: 19 Oct"); a ⋯ `.icon-btn` labelled "{name} options".
  - Headings: Set · Previous · {load} · {count} · Done. {load} is `loadHeading(defaultLoadKey(sets))` and {count} is `countHeading(sets)`. Both are accent buttons with a chevron that open LoadCountSheet.
  - Rows: `SetLine` with `setBadge`, `previousResult` and `loadMarker`.
    - `canCheck = groupComplete(sets, i)`. `checkHint` is "Fill in or delete its drops to check this set." when the set is valid but a drop is not.
    - The ✓ runs `toggleGroupCompletion` and calls `onSetDone` when the group becomes checked.
  - **+ Add set** runs `appendSet`.
  - The card owns which sheet is open: `{ kind: "set"; setId } | { kind: "loadCount" } | { kind: "menu" } | { kind: "reorder" } | null`. The open set's row gets `editing`, and `useKeepAboveSheet(setId, sheetRef)` runs. Sheet actions use `changeSection`, `withLoadKey`, `addDrop`, `removeSetOrDrop`, `applyExerciseLoad`, `applyExerciseCount` and `reorderGroups`.
  - Remove exercise calls `onRemove`. `ActiveWorkout` keeps its existing confirmation rule (`hasLoggedExercise`).

- [ ] **Step 1: Write the failing tests** (`loadComponent`, closed sheets):
  - `card shows badges, headings and the last date`: sets [warmup, working, drop, working] render badges "W", "1", "↓", "2", heading buttons "kg" and "Reps", and `"Last: " + localizedDate("2026-10-19", { day: "numeric", month: "short" })` (built the same way, so the test does not depend on the runtime locale).
  - `mixed loads show markers and the most common heading`: [bw, bw, bwplus] → heading "BW"; the third row's field has the "+" marker.
  - `a set with an empty drop has a disabled check`.
  - `an exercise with no sets still renders Add set`.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-card.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the rewrite and the `ActiveWorkout` call-site change, and delete the replaced files.
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test`. Then in `npm run dev` at 390 px:
  - Log and check a set with a drop: rest starts once.
  - Add and delete drops.
  - Change one set's load: its marker appears.
  - Change the heading load: only unchecked sets follow.
  - Reorder: the drops move with their set, and Escape cancels a keyboard move without closing the sheet.
  - Open a set near the bottom: it sits centred above the sheet.
- [ ] **Step 5: Commit** `feat(workout): rebuild the exercise card around sheets`.

### Task 10: Workout screen

**Files:**

- Modify: `src/pages/ActiveWorkout.tsx`
- Create: `src/components/workout/FinishSheet.tsx`, `WorkoutDetailsSheet.tsx`, `RestBar.tsx`, `NextSetChip.tsx`
- Test: `tests/workout-screen.test.ts`

**Interfaces:**

- Consumes: `Sheet`, `Switch`, `useRestTimer` (unchanged), `setCount`, `doneSetCount`, `countLabel`.
- Produces:
  - `FinishSheetBody(props: { completed: number; unchecked: number; showRoutineSwitch: boolean; saveRoutine: boolean; busy: boolean; onSaveRoutine: (on: boolean) => void; onSave: () => void; onKeepLogging: () => void; onAbandon: () => void })`:
    - Summary text: "{n} sets will be saved · {m} unchecked sets left out" via `countLabel`, singular when 1. The second part is omitted when `m` is 0. When `n` is 0 the summary is "Complete at least one set" and Save workout is disabled.
    - Then the "Save as a routine" Switch (when `showRoutineSwitch`), **Save workout** (primary), **Keep logging** and **Abandon workout** (danger).
    - Only drafts use this sheet. Editing a completed workout keeps the top-bar Save with the existing confirmation copy.
  - `WorkoutDetailsSheetBody(props: { workout: Workout; onChange: (workout: Workout) => void })`: the name, date (`max` today) and duration fields `ActiveWorkout` renders today.
  - `RestBar(props: { rest: ReturnType<typeof useRestTimer> })`: renders nothing unless `rest.remaining > 0 || rest.elapsed`. While running: the remaining time, "+30 s" (`rest.extend`) and "Skip" (`rest.skip`). After it ends: "Rest done" and "Dismiss" (`rest.skip`).
  - `NextSetChip(props: { setId?: string })`: an `IntersectionObserver` on `[data-set-id="{setId}"]` keeps "Next set ↓" visible only while that row is out of view. A tap scrolls the row to the centre and focuses its first enabled input.
  - `ActiveWorkout`:
    - Top bar `[data-top-bar]` holds the back button, then the title button (opens WorkoutDetailsSheet).
    - The status line has three parts, separated by " · ":
      - A live timer from `startedAt`, updated every 30 s. A past workout (`startedAt` null) shows a date chip instead, which opens WorkoutDetailsSheet.
      - "{done} of {total} sets".
      - The save status.
    - On the right, **Finish** (opens FinishSheet), or **Save** when editing a completed workout.
    - The body is the exercise cards, then a dashed **+ Add exercise**. With no exercises it shows one large "Add your first exercise" button.
    - The existing error, "changed elsewhere" and sync notices use `.banner` under the top bar.
    - Removed: the sticky footer, the details disclosure, "Go to active set" and the top-bar Abandon.

- [ ] **Step 1: Write the failing tests:**
  - `finish summary counts sets and unchecked sets`: (5, 1) → "5 sets will be saved · 1 unchecked set left out"; (1, 0) → "1 set will be saved".
  - `finish needs one completed set`: (0, 2) → "Complete at least one set" and a disabled Save workout.
  - `routine switch hidden for routine workouts`.
  - `details sheet limits the date to today`.
- [ ] **Step 2: Run** `npx tsx --test tests/workout-screen.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test`. Then in `npm run dev`:
  - Start a workout: the timer runs.
  - Finish → Keep logging; then Finish → Abandon → Undo.
  - Finish and save.
  - Edit the completed workout: Save is disabled until something changes.
  - Log a past workout: the date chip appears.
  - Scroll the next set off screen: the chip appears; tapping it centres and focuses the row.
- [ ] **Step 5: Commit** `feat(workout): simplify the workout screen with a Finish sheet and rest bar`.

### Task 11: Routine planning on SetLine

**Files:**

- Modify: `src/components/RoutinePlan.tsx`. Rows become plan-mode `SetLine`s with the same badge, heading and ⋯ sheets as `ExerciseCard`, without completion. Adds **+ Add set** (`appendSet`). Removes the planned-count, load and measure selects.
- Test: `tests/routine-plan.test.ts`

**Interfaces:**

- Consumes: `SetLine`, `SetSheet`, `LoadCountSheet`, `ExerciseMenuSheet`, `ReorderSetsSheet`, and the Task 2 / Task 4 helpers.

- [ ] **Step 1: Write the failing tests:** `routine rows have badges and no done buttons` (badges "1", "2"; no `aria-pressed`) and `planned drops render ↓`.
- [ ] **Step 2: Run** `npx tsx --test tests/routine-plan.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Starting a workout from the routine keeps drops; Task 3 covers this.
- [ ] **Step 4: Run** the same command (PASS) and `npm test`. Then in `npm run dev`, edit a routine with a drop and start a workout from it.
- [ ] **Step 5: Commit** `feat(routines): plan routines with the new set rows and sheets`.

### Task 12: Stylesheet cleanup

**Files:**

- Modify: `src/styles/workout.css` (final workout styles for §2–3), `src/index.css`, `src/styles/usability.css`
- Delete: `src/styles/set-editing.css` (move the reorder-handle and drag rules `SortableSetList` still uses into `workout.css` and update its import)

- [ ] **Step 1:** For each class selector in `src/index.css`, `src/styles/usability.css` and `src/styles/set-editing.css`, delete its rules when `grep -rn "<name>" src --include=*.tsx` finds no use. Expected removals include `.set-block`, `.set-row`, `.set-labels`, `.set-meta`, `.exercise-actions`, `.exercise-load-controls`, `.workout-footer`, `.next-set-action` and `.workout-details`, with their media-query copies.
- [ ] **Step 2: Run** `npm run build && npm test`. Then compare screenshots of Home, History, Progress, Settings, Routines and My exercises at 390 px in both themes against `main`. They may differ only in colour, font and dialog presentation.
- [ ] **Step 3: Commit** `refactor(style): remove superseded workout styles`.

### Task 13: Verification script, docs and accessibility

**Files:**

- Create: `scripts/verify-ui.mjs`:
  - Uses the global Playwright (`require('playwright')`, no install).
  - Seeds IndexedDB `gain-train-v2` with a fixture: completed workouts, a running draft with a drop, a bodyweight exercise with mixed loads, and a routine. It fixes the clock.
  - Runs the checks below at 340, 360 and 390 px, light and dark.
  - Prints PASS/FAIL lines and saves screenshots to `verify-output/`.
  - Injects `axe.min.js` from `npm exec --yes --package=axe-core@4.10.2` and fails on serious or critical violations.
- Modify: `.gitignore` (`verify-output/`), `README.md` (one line on running the script), `PRODUCT.md` and `DESIGN.md`:
  - Replace "Edit sets", compact mode, the per-row type select and the top-bar Abandon.
  - Describe the card, sheets, per-set load, drops and the Quiet tokens.
  - Record that Abandon moved into the Finish sheet with the owner's approval on 28 October 2026.
- Modify: `CHANGELOG.md` (entry for this release)

- [ ] **Step 1: Write the script** with these checks:
  - Logging and checking.
  - Set sheet:
    - The edited row is marked, and its centre is within ±8 px of the midpoint between the top bar's bottom and the sheet's top.
    - The sheet is no taller than its content.
    - Escape closes it and returns focus to the badge.
  - Type, load, drop add/delete, and immediate set deletion.
  - Reorder with keyboard: Escape cancels the move and the sheet stays open.
  - Finish sheet: save, keep logging, abandon + undo.
  - A set with drops: no ✓ on the drops, and the rest bar appears once.
  - The next-set chip appears only when its row is off screen.
  - The details sheet and the past-workout date chip.
  - Editing a completed workout.
  - Routine planning.
  - Every converted dialog opens as a sheet.
  - No horizontal overflow at 340 px.
  - `drop` survives a reload.
- [ ] **Step 2: Run** `npm run build && npx vite preview --port 4180`, then `node scripts/verify-ui.mjs http://localhost:4180/`. Expected: every line PASS and no serious or critical axe violations. Fix failures in the task that owns the code.
- [ ] **Step 3: Capture before/after screenshots** of the workout screen and each sheet (before from a `main` build) for the pull request.
- [ ] **Step 4: Update the docs** listed above, then run `npm run typecheck && npm run lint && npm test && npm run build`.
- [ ] **Step 5: Commit** `docs: describe the new workout screen; add UI verification script`.
