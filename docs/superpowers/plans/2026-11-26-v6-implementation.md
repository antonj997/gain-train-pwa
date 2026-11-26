# Mockup v6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build mockup v6 (frames A–H and settings, rounds 1–8, the owner's decisions) and the owner's new Sport feature into the Gain Train PWA, in seven PRs.

**Architecture:** P0 lays the shared ground: tokens, schema fields, preferences, Swedish display names and the Playwright verify harness. It merges first. Six feature phases then each own a set of files. Pure logic goes in `src/data/*` and `src/lib/*` with `node:test` tests; components go in `src/components/*` and use the existing primitives. No server change.

**Tech Stack:**

- React 18.3, TypeScript, Vite 5 PWA, zod 3, Radix Dialog;
- `node:test` via tsx (`npm test` runs `tests/*.test.ts`), with server-rendered component tests through `tests/helpers/render.ts` (`loadComponent`);
- Playwright 1.63, installed globally (`/opt/node-tools/node_modules/playwright`, browsers in `/opt/pw-browsers`), for Chromium and WebKit.

**Spec:** `docs/superpowers/specs/2026-11-26-v6-implementation-design.md`. Section marks (§D3, §B12, …) below refer to it. Read the spec section before each task. Exact copy is in the spec, and the plan does not repeat it.

**Baseline (26 Nov, 1c8bcda):** `npm test` gives 917 tests, 916 pass and 1 skipped; `npm run typecheck` is clean.

## Global Constraints

- There is no server or Supabase change. New data lives only in the fields listed in the spec's "Server and Supabase" table. A task that seems to need a migration stops and reports.
- Touch targets are ≥ 44 × 44 px. Text uses only 12/13/15/17/20/28 px at weights 400/600/700.
- Motion uses only `--gt-dur-*` / `--gt-ease-*` and `MOTION` / `EASE` / `SPRING`. Waits go through `motionMs()`. Under reduced motion every movement is a 120 ms fade.
- Use the existing primitives: `Sheet`, `Segmented`, `ChoiceSheet`, `ListRow`, `Switch`, `Reveal`, `MessageSlot`, `DayCell`. Make no new primitive where one fits.
- Every new message key goes in `en.ts` (the source of truth) and `sv.ts`. Swedish copy is exactly the spec's.
- Ids never change. `hipFlexors` is appended last. `soleusF` is the only geometry id removed.
- Green means done or inside only. Red is the map and destructive actions only. Accent is for actions, the selected state, today and positive change.
- Defaults:
  - RIR is off;
  - the rest timer is off for new users, and a saved rest time is kept;
  - the fatigue mode is `suggest`;
  - workout tips are on;
  - the language follows the phone until chosen.
- The RIR pad mode is exactly as tall as the kg/reps pad.
- Commit after every task. Each phase is one PR.

## Review Focus

These cases are the most likely to hurt a real user; each has a test in the named task.

1. **An existing user's saved rest time, after upgrading.** `gt-rest-seconds = "150"` with no `gt-rest-on` must read as on, with 150 s for every exercise. A user who never set one must read as off. Tested in Task 0.6.
2. **A legacy set with `rir: 3` and no `rirHigh`.** It must read "3+" and must not become "3", and an older app must still accept a set we write with RIR 5. Tested in Task 0.4.
3. **Week matching when a done workout matches no planned day**, and when two workouts fall on one planned date. The second must be an extra and must never flag a missed day as done twice. Tested in Task 2.1.
4. **The fatigue note when the exercise had no previous session, or the target is bodyweight.** No note may show, and nothing may crash. Tested in Task 1.9.
5. **Removing a standard programme after the user edited one of its routines.** The edited routine must stay, and only untouched ones go. Tested in Task 4.5.

---

## Phases, file ownership and parallel work

| Phase | PR title | Tasks | Starts after | Can run in parallel with |
|---|---|---|---|---|
| P0 Grunden | v6 foundation | 12 | — | nothing (merge first) |
| P1 Passet | v6 workout screen | 13 | P0 merged | P2, P4, P5 (and P3 up to Task 3.6) |
| P2 Kalender, Träna, schemats kalender | v6 calendar, Train and plan calendars | 11 | P0 merged | P1, P3 (to 3.6), P4, P5 |
| P3 Muskler, volym, Framsteg | v6 muscles, volume and progress | 11 | P0 merged; Tasks 3.7 and 3.10 after P2 merged | P1, P2 (until 3.7), P4, P5 |
| P4 Bibliotek och egen övning | v6 library and own exercise | 11 | P0 merged | P1, P2, P3, P5 |
| P5 Inställningar | v6 settings | 4 | P0 merged | P1–P4 |
| P6 Sport | Sport | 8 | P2, P3 and P4 merged | P1, P5 |

**Merge order:** P0 first. Then P1, P2, P4 and P5 in any order. P3 rebases on P2 before Task 3.7 and merges after P2. P6 merges last.

**Each phase runs in its own git worktree** (superpowers:using-git-worktrees), branched from the branch with P0 merged:

```bash
git worktree add ../gt-p1 -b v6/p1-passet <base>
```

**Ownership of shared files.** Only the owner edits a file. Others consume what it exports.

| File | Owner | Rule for others |
|---|---|---|
| `src/styles/tokens.css`, `src/lib/motion.ts` | P0 | P0 adds every token v6 needs (Task 0.1). Later phases only read them. |
| `src/data/model.ts`, `src/lib/storage.ts`, `src/lib/preferences.ts` | P0 | All schema fields, storage keys and preferences are added in P0. |
| `src/lib/routes.ts` | P0 | P0 adds `discoverPath`, `plansTabPath` and `newPlanPath`. |
| `src/i18n/en.ts`, `src/i18n/sv.ts` | P0 makes anchors; each phase owns its block | Task 0.9 adds one comment line per phase, `// ---- v6 P1 Passet ----` through `// ---- v6 P6 Sport ----`, each followed by a blank line, before the closing `};`. A phase adds new keys only directly under its own anchor. It changes existing keys only in its prefixes: <ul><li>P1: `pad. set. workout. exercise. finish. picker. rest.`</li><li>P2: `home. week. history. start. calendarPlan. plan.` (period and deload) and the `planStatus.` keys on adherence, legend and the top card</li><li>P3: `muscle. muscleName. planStatus.muscle* planStatus.progression* progress. overview. goals.`</li><li>P4: `library. discover. editor. muscles. routines. exercises.`</li><li>P5: `settings. language.`</li><li>P6: `sport.` and `category.Sport`</li></ul> |
| `src/styles/pages.css` | by section | P2: Train (273–1027) and plan (1511–1970). P3: Progress and Goals (1190–1400, 1971–2224). P4: Library (1401–1510). P5: Settings (1126–1189). New P3 styles go in `muscles.css` / `details.css`. |
| `src/styles/items.css` | P2 | P4 and P6 consume. |
| `src/styles/workout.css` | P1 | — |
| `src/styles/history-calendar.css` | P2 | — |
| `src/styles/muscles.css`, `src/components/muscles/*` | P3, then P4 (`MusclePicker` layout, the machine glyph), then P6 (the sport glyph) | Sequential by merge order. |
| `src/data/catalogue.ts`, `src/data/exercise-muscles.ts` | P3 (the RDL category, hipFlexors), then P6 (sports) | Sequential. |
| `src/data/week-match.ts` | P2, then P6 (`other`) | Sequential. |
| `src/components/plan/PlanEditor.tsx`, `src/pages/PlanStatus.tsx`, `src/components/plan/PlanStatusCards.tsx` | P2 | P3 inserts its cards (Tasks 3.7 and 3.10) after rebasing on P2. P4 only passes `draft` to `PlanEditor` (added by P2 in Task 2.9). |
| `src/pages/Home.tsx`, `TodayCard.tsx`, `DaySheet.tsx`, `usePlanDaySheet.tsx` | P2, then P6 | Sequential. |
| `src/components/library/ExerciseEditorSheet.tsx`, `MusclePicker.tsx` | P4, then P6 | Sequential. |
| `src/lib/exercise-search.ts` | P0 (Swedish names), then P1 (exact and prefix first) | Sequential. |
| `scripts/verify/harness.cjs`, `fixture.cjs` | P0 | Each phase adds only `scripts/verify/<phase>.cjs`. A phase that needs more fixture data adds a `fixture-<phase>.cjs` that the harness merges. |
| `CHANGELOG.md`, `DESIGN.md`, `PRODUCT.md` | each phase appends its own entry or section | Conflicts are text only; resolve by keeping both. |

## Verification (every phase's last task)

Run from the phase's worktree:

```bash
npm run lint && npm run typecheck && npm test && npm run build
node scripts/verify/run.cjs --phase <p0|p1|…|p6>
```

`run.cjs` (Task 0.11):

- starts `npx vite preview --port 4180 --strictPort` itself;
- seeds the fixture;
- runs Chromium and WebKit at 360 and 390 px, plus 1100 px for the layout checks, in light and dark theme;
- runs the common checks:
  - no interactive element under 44 × 44 px (also after the phase's interactions);
  - no text node outside 12/13/15/17/20/28 or 400/600/700;
  - no horizontal scroll;
  - no console error;
- runs the phase module's checks.

It prints `PASS`/`FAIL` lines, saves screenshots to `verify-output/<phase>/`, and exits 1 on any FAIL. Expected: every line PASS, in both engines.

---

# P0 Grunden

### Task 0.1: Tokens and motion tokens

**Files:**
- Modify: `src/styles/tokens.css`, `src/lib/motion.ts`
- Test: `tests/tokens.test.ts`, `tests/motion-tokens.test.ts`

**Interfaces:**
- Produces these CSS tokens (light and dark):
  - `--gt-sel-bg`, `--gt-sel-line`, `--gt-sel-ink`;
  - `--gt-heat-1..5` set to the H3 values in both themes;
  - `--gt-map-panel` (dark #2f3746);
  - `--gt-map-halo` (transparent in light, #6f7a8d in dark);
  - `--gt-scrim` (dark `rgb(10 12 16 / .58)`);
  - `--gt-dur-dock-in` 240ms, `--gt-dur-dock-out` 200ms, `--gt-dur-settle` 320ms, `--gt-ease-swipe` (`EASE.swipe`), `--gt-dur-reward` 420ms, `--gt-dur-sheen` 600ms.
- Produces `MOTION.settle = 320` and `MOTION.reward = 420`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/tokens.test.ts`, "v6 tokens exist in both themes": parse both theme blocks and assert:
    - `--gt-heat-1` = `#fde3df` and `--gt-heat-5` = `#9a1f17` in both;
    - dark `--gt-map-panel` = `#2f3746`;
    - dark `--gt-map-halo` = `#6f7a8d`;
    - `--gt-sel-bg` = `var(--gt-accent-soft)`.
  - `tests/motion-tokens.test.ts`, "v6 motion tokens equal MOTION": `--gt-dur-dock-in` equals `MOTION.dockIn` (240); `--gt-dur-settle` equals `MOTION.settle` (320); `--gt-dur-reward` equals `MOTION.reward`; `--gt-dur-sheen` equals `MOTION.sheen`.
- [ ] **Step 2: Run** `npx tsx --test tests/tokens.test.ts tests/motion-tokens.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the tokens and the MOTION entries.**
- [ ] **Step 4: Run** the same command. Expected: PASS. Then run `npm test`.
- [ ] **Step 5: Commit** with `feat(tokens): v6 selected look, map and heat tokens, motion names`.

### Task 0.2: The one selected look

**Files:**
- Modify: `src/styles/primitives.css` (`Segmented` pressed), `src/styles/components.css` (`.filter-chip[aria-pressed=true]`)
- Test: `tests/ui-primitives.test.ts`

**Interfaces:**
- Produces the CSS class `.seg-option.is-neutral`: a pressed option that stays neutral. "Ingen" in level pickers uses it.

- [ ] **Step 1: Failing test** "pressed segment and chip use the sel tokens": read the CSS, and assert that the pressed selectors set `background: var(--gt-sel-bg)`, a `1.5px` border in `var(--gt-sel-line)` and `color: var(--gt-sel-ink)`. Assert that `.is-neutral` sets none of the three.
- [ ] **Step 2: Run** `npx tsx --test tests/ui-primitives.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the CSS. `Segmented.tsx` gets an optional `neutral?: T` prop, which adds `is-neutral` to that option.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(ui): one selected look for segments and chips`.

### Task 0.3: Schema fields

**Files:**
- Modify: `src/data/model.ts`
- Test: create `tests/v6-schema.test.ts`

**Interfaces:**
- Produces:
  - `setSchema.rirHigh?: 4 | 5 | null`;
  - `exerciseSchema.fatigue?: "lowered"`;
  - `librarySchema.exerciseNotes?: Record<string, string>` (≤ 300 characters each);
  - `librarySchema.weightSteps?: Record<string, number>` (positive, ≤ 20);
  - `librarySchema.restSeconds?: Record<string, number>` (an integer, 0–600).

  Each record is capped at `MAX_CARDIO_SETTINGS` entries.

- [ ] **Step 1: Failing tests:**
  - "a set keeps rirHigh 5 with rir 3": `validate("workout", …)` keeps `rirHigh: 5`;
  - "rirHigh 6 is invalid": it throws `RecordValidationError`;
  - "library keeps exerciseNotes, weightSteps and restSeconds";
  - "an exercise keeps fatigue lowered";
  - "no SCHEMA_VERSION bump": `SCHEMA_VERSION === 2`.
- [ ] **Step 2: Run** `npx tsx --test tests/v6-schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the fields**, with comments on why there is no migration (the spec's Server table).
- [ ] **Step 4: Run** the test and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(model): v6 optional fields (rirHigh, fatigue, per-exercise notes, steps, rest)`.

### Task 0.4: RIR 0–5+

**Files:**
- Modify: `src/lib/rir.ts`
- Test: `tests/load-none-rir-note.test.ts` (extend)

**Interfaces:**
- Produces:
  - `type Rir = 0|1|2|3|4|5`;
  - `RIR_VALUES = [0,1,2,3,4,5]`;
  - `rirOf(set): Rir | null`;
  - `withRir(set, rir: number | null): WorkoutSet`;
  - `rirValueText(rir: Rir, legacyPlus?: boolean): string`;
  - `rirLabel(set)`.

- [ ] **Step 1: Failing tests:**
  - `withRir(set, 5)` gives `{ rir: 3, rirHigh: 5 }`, and `rirOf` returns 5;
  - `withRir(set, 4)` gives `rirHigh: 4`;
  - `withRir(set, 2)` removes `rirHigh`;
  - `withRir(set, null)` clears both;
  - `rirOf({ rir: 3 })` is 3, and `rirLabel({ rir: 3 })` is "RIR 3+" (legacy);
  - `rirLabel({ rir: 3, rirHigh: 5 })` is "RIR 5+";
  - `rirLabel({ rir: 3, rirHigh: 4 })` is "RIR 4";
  - `rirOf({ rir: 2, rirHigh: 5 })` is 2 (`rirHigh` is ignored unless `rir` is 3).
- [ ] **Step 2: Run** `npx tsx --test tests/load-none-rir-note.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `rirLabel` writes "3+" only for `rir === 3` without `rirHigh`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(rir): 0–5+ stored as rir + rirHigh, no server change`.

### Task 0.5: Per-exercise settings helpers

**Files:**
- Create: `src/lib/exercise-settings.ts`
- Test: create `tests/exercise-settings.test.ts`

**Interfaces:**
- Produces:
  - `defaultWeightStep(equipment?: string | null): number` (spec §D5 table);
  - `weightStepOf(library, exerciseId, equipment): number`;
  - `withWeightStep(library, id, step | null): Library` (`null` or the default removes the entry);
  - `exerciseNote(library, id): string`;
  - `withExerciseNote(library, id, text): Library` (trimmed; empty removes);
  - `restOf(library, id): number | undefined`;
  - `withRest(library, id, seconds | null): Library`;
  - `WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 4, 5] as const`.

- [ ] **Step 1: Failing tests:**
  - `defaultWeightStep`: `"barbell"` → 2.5, `"dumbbell"` → 2, `"machine"` → 5, `"kettlebell"` → 4, `"cable"` → 2.5, `"bodyweight"` → 1.25, `undefined` → 2.5;
  - `withWeightStep(lib, id, 2.5)` on a barbell exercise leaves no entry;
  - `withExerciseNote(lib, id, "  ")` removes the entry;
  - `withRest(lib, id, 0)` stores 0;
  - `restOf` returns `undefined` when absent.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-settings.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, following `src/lib/exercise-units.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(library): per-exercise note, weight step and rest helpers`.

### Task 0.6: Preferences, rest tiers and storage keys

**Files:**
- Modify: `src/lib/preferences.ts`, `src/lib/storage.ts`
- Create: `src/data/rest-tiers.ts`
- Test: create `tests/preferences-v6.test.ts`, `tests/rest-tiers.test.ts`

**Interfaces:**
- `TrainingPreferences` gains `restOn: boolean`, `workoutTips: boolean` and `fatigueMode: "off" | "suggest" | "auto"`. `restSeconds` now means the all-exercises time (0 = the tiers).
- New `storageKeys`: `restOn: "gt-rest-on"`, `workoutTips: "gt-workout-tips"`, `fatigueMode: "gt-fatigue-mode"`, `barKg: "gt-bar-kg"`, `plates: "gt-plates"`.
- `normalizeTrainingPreferences` takes an options object; the positional form is kept as a wrapper for its callers.
- `restTier(exercise: { id: string; name: string; equipment?: string; muscles: ExerciseMuscles; custom?: boolean }): 150 | 120 | 90`.
- `ISOLATION_EXERCISES: ReadonlySet<string>` (catalogue names).
- `effectiveRest(prefs: TrainingPreferences, own: number | undefined, tier: number): number`.
- `saveRestTimerOn(on)` keeps the existing behaviour, but writes `restOn`.

- [ ] **Step 1: Failing tests:**
  - "an existing saved time reads as on": with `restOn` null and `rest` "150", `restOn` is true and `restSeconds` is 150;
  - "a new user is off": everything null gives `restOn` false and `restSeconds` 0, with `askRir` false, `fatigueMode` "suggest" and `workoutTips` true;
  - "an explicit off wins": `restOn` "false" with `rest` "150" gives `restOn` false and keeps 150;
  - `effectiveRest`:
    - `(on, own undefined, tier 90)` gives 90;
    - `(on, restSeconds 150, own undefined, tier 90)` gives 150;
    - `(off, own 120)` gives 120;
    - `(on, own 0)` gives 0;
    - `(off, own undefined)` gives 0.
  - `restTier`:
    - 150 for Squat, Bench Press, Deadlift;
    - 120 for Bulgarian Split Squat, Leg Press, Pull Up;
    - 90 for Standing Calf Raise, Lateral Raise, Dumbbell Curl, Tricep Pushdown, Lying Leg Curl;
    - a custom exercise with one main muscle gives 90; with two, 120; with two on a barbell, 150.
- [ ] **Step 2: Run** `npx tsx --test tests/preferences-v6.test.ts tests/rest-tiers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write `ISOLATION_EXERCISES` by going through the catalogue's single-joint lifts (raises, curls, extensions, pushdowns, flyes, leg curls and extensions, calf raises, shrugs, crunch-type core). For your own exercises, one main muscle means isolation.
- [ ] **Step 4: Run.** Expected: PASS. Then run `npm test`; the existing rest tests must still pass.
- [ ] **Step 5: Commit** with `feat(prefs): rest on/tiers with migration, workout tips, fatigue mode`.

### Task 0.7: Language follows the phone

**Files:**
- Modify: `src/i18n/index.ts`, `src/i18n/LanguageProvider.tsx`, `src/components/LanguagePrompt.tsx`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Produces:
  - `languageOnLaunch(stored, hasUserData): "none" | "prompt" | "phone"`;
  - `phoneLanguage(languages: readonly string[]): Language`;
  - the `useT()` result gains `chosen: boolean` (already there) and `followsPhone: boolean`.

- [ ] **Step 1: Failing tests:**
  - `phoneLanguage(["sv-SE","en"])` is "sv";
  - `phoneLanguage(["nb-NO","sv"])` is "en" (the first entry decides);
  - `phoneLanguage([])` is "en";
  - `languageOnLaunch(null, false)` is "phone";
  - with user data it is still "prompt".
- [ ] **Step 2: Run** `npx tsx --test tests/i18n.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** On `"phone"`, set the current language from `navigator.languages` without storing it.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(i18n): a new user's language follows the phone`.

### Task 0.8: Swedish display names and subtitles

**Files:**
- Create: `src/lib/exercise-name.ts`, `src/data/exercise-names-sv.ts`
- Modify:
  - `src/lib/exercise-search.ts`;
  - every display site of an exercise name. Find them with `grep -rn "\.name}" src/components src/pages`, including `ExerciseCard.tsx`, `ExerciseRow` (both), `ExercisePickerBody.tsx`, `Exercise.tsx`, `WorkoutDetails.tsx`, `RoutinePreview*`, `PlanProgression.tsx`, `ProgressSummary.tsx`, `GoalCard.tsx` and `FinishSheet.tsx`.
- Test: create `tests/exercise-name.test.ts`; extend `tests/exercise-search.test.ts`

**Interfaces:**
- Produces:
  - `exerciseDisplayName(exerciseId: string, storedName: string, language?: Language): string`;
  - `exerciseSubtitle(entry: { id; equipment?; category; custom: boolean; englishName: string }): string`;
  - `SV_NAMES: Record<string, string>`.

- [ ] **Step 1: Failing tests:**
  - every `SV_NAMES` key is in `catalogueById`;
  - in Swedish, `exerciseDisplayName("builtin:tricep-pushdown", "Tricep Pushdown")` is "Tricepsnedtryck med kabel";
  - in English it is the stored name;
  - a custom id returns the stored name;
  - `exerciseSubtitle` for bench press in Swedish is "skivstång · Bench Press";
  - your own cable exercise in Core reads "kabel · Bål · egen";
  - search: "rodd" finds `builtin:barbell-row`, and "Bench" still finds Bänkpress.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-name.test.ts tests/exercise-search.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the table (spec §D2) and the helpers. Swap the display sites (stored names stay in records), and give the search the Swedish name as a matched field.
- [ ] **Step 4: Run.** Expected: PASS. Then run `npm test` and `npm run typecheck`.
- [ ] **Step 5: Commit** with `feat(names): Swedish exercise names with the English name as subtitle`.

### Task 0.9: i18n anchors, routes and the category chip row

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/sv.ts` (seven anchor lines), `src/lib/routes.ts`
- Create: `src/components/ui/CategoryChips.tsx`, `src/lib/category-filter.ts`
- Test: `tests/i18n.test.ts`; create `tests/category-filter.test.ts`

**Interfaces:**
- Produces the routes:
  - `discoverPath(): "/library?view=discover"`;
  - `plansTabPath(): "/library?tab=plans"`;
  - `newPlanPath(programId?: string)`.
- Produces `CATEGORY_CHIPS = ["all","Legs","Glutes","Chest","Back","Shoulders","Arms","Core","mine"] as const`. P6 inserts "Sport" before "mine".
- Produces `matchesChip(entry, chip): boolean`.
- Produces `<CategoryChips value onChange />`: one sideways-scrolling row of `filter-chip` buttons, 44 px.

- [ ] **Step 1: Failing tests:**
  - en and sv have the same keys (the existing test);
  - `matchesChip` with "Legs" matches the Squat and also a row whose `categories` include Legs;
  - "mine" matches custom only.
- [ ] **Step 2: Run** `npx tsx --test tests/category-filter.test.ts tests/i18n.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The chip labels use `category.*`, with "Alla" and "Mina".
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `chore(v6): i18n phase anchors, routes and the shared category chips`.

### Task 0.10: Avatars, glyph sizes and the tab bar (H4)

**Files:**
- Modify: `src/components/items/ExerciseAvatar.tsx`, `src/components/muscles/MuscleIcon.tsx`, `EquipmentIcon.tsx`, `src/styles/muscles.css` (the `--mi-*` dark mixes), `src/components/Layout.tsx` and `pages.css` (the bottom-navigation section, 1027–1125)
- Test: `tests/exercise-icon.test.ts`, `tests/ui-primitives.test.ts`

**Interfaces:**
- Produces:
  - `ExerciseAvatar` size `"md"` (44 px circle, 34 px figure, 24 px glyph at a 1.8 stroke) replacing the 40 px default, with `"lg"` (60 px) unchanged;
  - all four tab labels rendered (12/600) on an opaque bar.

- [ ] **Step 1: Failing tests:**
  - in dark theme, with the mixes from spec §H4 (circle = the tone's background darkened by half, body 65 %, untrained 50 %, helping 78 %, main = the tone + 15 % white), the existing contrast helper gives body/circle ≥ 4:1 and untrained/circle ≥ 3:1 for all nine tones;
  - the navigation renders four visible labels "Träna, Kalender, Framsteg, Bibliotek", and none is `sr-only`.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-icon.test.ts tests/ui-primitives.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(icons): 44 px avatars, stronger dark mixes, labels on all tabs`.

### Task 0.11: The Playwright verify harness

**Files:**
- Create:
  - `scripts/verify/run.cjs` (CLI);
  - `scripts/verify/harness.cjs`: the browsers, viewports, themes, preview server, and the common checks (44 px, type scale, overflow, console);
  - `scripts/verify/fixture.cjs`: seeds IndexedDB `gain-train-v2` (version 1) and localStorage. The fixture holds:
    - eight weeks of workouts (Benpass and Tryckpass, with records);
    - a running Benpass draft;
    - a plan "Styrkeblock" of 8 weeks, started four weeks before the fixed clock, with a moved Tuesday;
    - one custom cable exercise "Knästående pallofpress" (Core).
    The clock is fixed to Thursday 19 November 2026.
  - `scripts/verify/p0.cjs`.
- Modify: `.gitignore` (`verify-output/`), `README.md` (one line on how to run it)

**Interfaces:**
- A phase module exports `module.exports = async ({ page, engine, width, theme, check, shot }) => {…}`. `check(name, boolean)` records a PASS or FAIL, and `shot(name)` saves a screenshot.
- The harness requires Playwright from `require.resolve("playwright", { paths: [execSync("npm root -g").toString().trim()] })`.

- [ ] **Step 1: Write `p0.cjs` checks:**
  - "pressed Segmented uses sel tokens": the computed background of a pressed option equals the resolved `--gt-sel-bg`;
  - "no text outside scale on Train, Kalender, Framsteg, Bibliotek, Inställningar";
  - "no target under 44 px on the same pages".
- [ ] **Step 2: Run** `npm run build && node scripts/verify/run.cjs --phase p0`. Expected: PASS in Chromium and WebKit. Fix any common-check failure on existing pages in the task that owns that page; P0 records them as known in the PR and does not hide them.
- [ ] **Step 3: Commit** with `chore(verify): Playwright harness, fixture and P0 checks`.

### Task 0.12: P0 verification and docs

- [ ] **Step 1:** Run the full verification (see Verification) with `--phase p0`. Expected: all PASS.
- [ ] **Step 2:** Add a CHANGELOG entry "v6 foundation", and add the new tokens to DESIGN.md's Colors and Motion sections (the spec's H3 and H5).
- [ ] **Step 3: Commit** with `docs: v6 foundation`. Open PR P0.

---

# P1 Passet

### Task 1.1: The exercise heading, its meta line and the note

**Files:**
- Create: `src/lib/exercise-heading.ts`
- Modify: `src/components/ExerciseCard.tsx`, `src/styles/workout.css`
- Test: create `tests/exercise-heading.test.ts`; extend `tests/workout-controls-render.test.ts`

**Interfaces:**
- Consumes: `weightStepOf` and `exerciseNote` (Task 0.5); `exerciseDisplayName` (Task 0.8).
- Produces:
  - `headingMeta({ equipment, step, perHand, perLeg }): string` → "Hantlar ±2 · kg per hand · per ben";
  - `headingRange(repRange | undefined, workingSets: number): string` → "5–7 reps · 3 set" or "3 set";
  - `isPerLeg(exerciseId): boolean` (single-leg ids in a set).

- [ ] **Step 1: Failing tests:**
  - "Skivstång ±2,5", "Maskin ±5" and "Hantlar ±2 · kg per hand · per ben" for Bulgarian Split Squat;
  - `headingRange({min:5,max:7}, 3)` is "5–7 reps · 3 set";
  - render: the card has no "Senast:" text, shows the note text under the title when the library has one, and the reps line counts working sets live;
  - the ↑ mark's CSS colour is `var(--gt-accent)`;
  - raising set 1 to 102.5 carries the weight to sets 2 and 3 while they are unchecked (R4-17; extend `tests/set-editing.test.ts` if `set-editing.ts` already does it, and keep it).
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-heading.test.ts tests/workout-controls-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove the `exercise.last` and `workingSetsNote` lines from the log heading.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(workout): v6 exercise heading with step, range and note`.

### Task 1.2: The pad: steps, keys, header and field order

**Files:**
- Modify: `src/lib/number-pad.ts`, `src/components/workout/NumberPad.tsx`, `src/components/workout/number-pad-context.ts`
- Test: `tests/number-pad.test.ts`

**Interfaces:**
- `PadField` becomes `"weight" | "reps" | "rir"`.
- Produces `padFields(askRir: boolean, drop: boolean): PadField[]`, giving `["weight","reps","rir"]` or `["weight","reps"]`.
- `stepValue(field, value, dir, step)`.
- `padHint(key, field, text): "Reps är hela tal" | "Fältet är redan tomt" | "Högst fem siffror" | null`.
- `dropMinus20(kg, step, lastKg?): number`.

- [ ] **Step 1: Failing tests:**
  - `padFields(true,false)` ends with "rir";
  - `padFields(true,true)` has no rir;
  - the + step with step 5 on 60 gives 65;
  - `padHint("decimal","reps","8")` is "Reps är hela tal";
  - `dropMinus20(60,5)` is 50;
  - `dropMinus20(50,5,50)` is 40;
  - `dropMinus20(52.5,2.5)` is 42.5.
- [ ] **Step 2: Run** `npx tsx --test tests/number-pad.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the logic, then the pad:
  - the header: the name, "Set n · Förra …", the target chip, the field segment;
  - the keys: `pad.same` reads "Som förra passet", and on a drop "−20 %";
  - the action key: "Nästa ›" or "Klar ✓";
  - the hint shows for 1.5 s (`motionMs`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(pad): exercise steps, v6 keys and header, RIR in the field order`.

### Task 1.3: The RIR box and the RIR slider (same pad height)

**Files:**
- Create: `src/components/workout/RirSlider.tsx`, `src/lib/rir-slider.ts`
- Modify:
  - `src/components/workout/SetLine.tsx`: add the RIR field and remove `RirAsk` and its timers;
  - `NumberPad.tsx`;
  - `ExerciseCard.tsx`: the RIR column heading when `askRir` is on;
  - `workout.css`.
- Test: create `tests/rir-slider.test.ts`; extend `tests/workout-controls-render.test.ts`

**Interfaces:**
- Consumes `rirOf` and `withRir` (Task 0.4), and `padFields` (Task 1.2).
- Produces:
  - `rirFromPosition(x: number, width: number): Rir`;
  - `rirKey(value: Rir | null, key: string): Rir | null` (ArrowLeft/Right ±1, Home → 0, End → 5; null plus an arrow → 2);
  - `RIR_TEXT: Record<Rir | "unset", MessageKey>`.

- [ ] **Step 1: Failing tests:**
  - `rirFromPosition(0,200)` is 0, `(200,200)` is 5 and `(81,200)` is 2;
  - `rirKey(5,"ArrowRight")` is 5, and `rirKey(null,"Home")` is 0;
  - render with `askRir`: the row has a fourth field labelled "RIR" showing "–", and there is no `.set-rir-ask`;
  - render without `askRir`: no RIR field.
- [ ] **Step 2: Run** `npx tsx --test tests/rir-slider.test.ts tests/workout-controls-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the slider:
  - `role="slider"` and the aria values from spec §B12;
  - a 44 px thumb that moves with `transform` over `--gt-dur-quick` / `--gt-ease-out`, with no transition under reduced motion;
  - pointer drag uses `pointer-capture.ts`.

  RIR mode's body has the same fixed height as the key grid: one CSS custom property `--pad-body-h`, set from the key grid's four rows, applies to both modes. The "Hoppa över" key checks without RIR; "Klar" checks with it.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(rir): RIR box in the set row and a slider on the pad`.

### Task 1.4: The Set sheet and the warm-up ladder

**Files:**
- Create: `src/lib/warmup.ts`, `src/components/workout/WarmupSheet.tsx`
- Modify: `src/components/workout/SetSheet.tsx`, `ExerciseCard.tsx`
- Test: create `tests/warmup.test.ts`

**Interfaces:**
- Consumes `weightStepOf` and `prefs.workoutTips`.
- Produces:
  - `warmupLadder(workKg: number, step: number, barKg: number, barbell: boolean): { kg: number; reps: number; plates: number[] | null; emptyBar: boolean }[]`;
  - `platesPerSide(kg, barKg, plates = [25,20,15,10,5,2.5,1.25]): number[] | null`.

- [ ] **Step 1: Failing tests:**
  - `warmupLadder(100,2.5,20,true)` gives the kg `[20,40,60,80]` and reps `[10,8,5,2]`;
  - `platesPerSide(80,20)` is `[25,5]`, `platesPerSide(40,20)` is `[10]`, and `platesPerSide(21,20)` is null;
  - a non-barbell ladder for 22 kg on step 2 gives `[8,14,18]` with three rows (40/60/80 %, rounded to the step).
- [ ] **Step 2: Run** `npx tsx --test tests/warmup.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Implement the logic, then the sheet (spec §B6), then the Set sheet's groups (spec §B4). "Lägg till uppvärmning" shows only on the first unchecked working set while `workoutTips` is on. The RIR row opens the pad in RIR mode.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(workout): v6 Set sheet and warm-up ladder with plates`.

### Task 1.5: Drops: −20 % to the step, and "+ Drop"

**Files:**
- Modify: `src/data/drops.ts`, `ExerciseCard.tsx`, `workout.css`
- Test: `tests/drops.test.ts`

**Interfaces:**
- `addDrop(sets, parentId, step?: number)` prefills `dropMinus20` (Task 1.2).
- Produces `addNextDrop(sets, step): { sets: WorkoutSet[]; id: string }` (after the last drop of the last group that has one).

- [ ] **Step 1: Failing tests:**
  - `addDrop` on a 60 kg parent with step 5 prefills 50;
  - `addNextDrop` after a 50 kg drop adds 40 directly after it;
  - with no drop, `addNextDrop` throws or returns unchanged (choose unchanged).
- [ ] **Step 2: Run** `npx tsx --test tests/drops.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The foot shows "+ Drop" while the exercise has a drop. A tap adds the drop, opens the pad on reps, and the row grows in (`MOTION.rowIn`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(drops): step-rounded −20 % and a quick + Drop`.

### Task 1.6: Swipe delete without undo, and the locked toast

**Files:**
- Modify: `src/components/gestures/SetSwipeRow.tsx`, `ExerciseCard.tsx`, `src/pages/ActiveWorkout.tsx`, `src/lib/locked-tap.ts`
- Test: `tests/set-lock.test.ts`, `tests/gestures.test.ts`

- [ ] **Step 1: Failing tests:**
  - "set swipe deletes with no undo slot": render after delete has no `UndoPlaceholder` for the set;
  - "first tap on a checked set returns a toast message": `lockedTapMessage()` is the spec text.
- [ ] **Step 2: Run** `npx tsx --test tests/set-lock.test.ts tests/gestures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - the delete motion: out 220 ms ease-in, then a 240 ms collapse;
  - the toast in the workout's foot slot, which leaves after 4 s;
  - the row shakes ±4 px over `--gt-dur-pop`;
  - checked fields get the `aria-label` from spec §B2.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(workout): swipe deletes a set at once; locked set says why`.

### Task 1.7: The exercise menu, the rep-range sheet and step-aware targets

**Files:**
- Modify: `src/components/workout/ExerciseMenuSheet.tsx`, `RepRangeSheet.tsx`, `src/data/targets.ts`
- Test: `tests/targets.test.ts`

**Interfaces:**
- `TargetSettings` gains `step?: number` (kg). It is used instead of `LOAD_STEP.kg` when the unit is kg.
- `targetHistory` / `suggestTarget` skip a session whose exercise has `fatigue: "lowered"` (spec §D4).

- [ ] **Step 1: Failing tests:**
  - "step 2 for dumbbells": last 20 × 10 at the top of 8–10 gives a target of 22 × 8;
  - "a lowered session is skipped": the history `[A: 22 × 8 target met] → [B: lowered, 20 × 8]` gives the next target from A's rule, not B's.
- [ ] **Step 2: Run** `npx tsx --test tests/targets.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the menu (spec §B7):
  - the note text area saves on blur through `withExerciseNote`;
  - "Repintervall" opens `RepRangeSheet` with a `Segmented` of six ranges;
  - "Viktsteg (kg)" is a `Segmented` over `WEIGHT_STEPS`, saving `withWeightStep`;
  - "Vilotid" opens B8;
  - "Ta bort övningen" stays in danger.

  Pass the step into `workoutTargets`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(workout): exercise menu with note, range and weight step`.

### Task 1.8: Rest per exercise and the dock

**Files:**
- Modify:
  - `src/components/settings/RestControl.tsx` (a new `RestSheet` export);
  - `src/hooks/useRestTimer.ts`: `start(seconds)` takes the exercise's effective rest;
  - `src/components/workout/RestDock.tsx`;
  - `src/lib/rest-dock.ts`;
  - `ExerciseCard.tsx` (the chip).
- Test: `tests/rest-dock.test.ts`, `tests/drafts-rest.test.ts`

**Interfaces:**
- Consumes `effectiveRest` and `restTier` (Task 0.6), and `restOf` / `withRest` (Task 0.5).
- Produces `nextLine(name, setNumber, target, range): string` → "Nästa: Knäböj · set 2 · Mål 100 × 6 (5–7)".
- `useRestTimer().start(seconds: number)`.

- [ ] **Step 1: Failing tests:**
  - `nextLine` gives the exact string;
  - "start uses the given seconds": `start(90)` sets `end` 90 s ahead;
  - "0 starts nothing".
- [ ] **Step 2: Run** `npx tsx --test tests/rest-dock.test.ts tests/drafts-rest.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the sheet (spec §B8):
  - the switch, the time segment, "Egen tid" (the nested `RestControl`), "Gäller", sound and vibrate, "Klar";
  - the dock's 3 px top bar for the time left, with the fill gone from behind the text;
  - the chip shows the effective rest or "Vila av".
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(rest): rest per exercise with tiers; the dock shows the next target`.

### Task 1.9: The fatigue rule (data)

**Files:**
- Create: `src/data/fatigue.ts`
- Test: create `tests/fatigue.test.ts`

**Interfaces:**
- Consumes `musclesOf`, `isHardSet`, the step and `previousResult` / `priorWorkouts`.
- Produces:
  - `fatigueNote(workout: Workout, exerciseIndex: number, previous: Workout | null, musclesOf: MusclesOf, step: number): FatigueNote | null`;
  - `type FatigueNote = { muscle: Muscle; today: number; before: number; from: SetTarget; to: SetTarget }`;
  - `lowerTargets(exercise: Exercise, to: SetTarget): Exercise` (sets `fatigue: "lowered"`);
  - `restoreTargets(exercise, snapshot)`.

- [ ] **Step 1: Failing tests:**
  - "B13 case": today has Squat 3 checked and Leg Press 3 checked before the Bulgarian Split Squat with target 22 × 8 on step 2; the previous workout had only Squat 3 before it. The result is quads, today 6, before 3, to 20 × 8;
  - "difference 2 gives null";
  - "no previous gives null";
  - "a checked working set in the exercise gives null";
  - "a bodyweight target gives null";
  - "helping muscles count at 0.5": Leg Press adds 1.5 to glutes, but glutes as a main muscle of the split squat still needs ≥ 3;
  - `lowerTargets` sets `fatigue` and only unchecked working sets change.
- [ ] **Step 2: Run** `npx tsx --test tests/fatigue.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §D10.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(coach): fatigue rule — 3+ more hard sets before the exercise than last time`.

### Task 1.10: The fatigue row in the workout

**Files:**
- Create: `src/components/workout/FatigueRow.tsx`
- Modify: `ExerciseCard.tsx`, `src/pages/ActiveWorkout.tsx` (the toast), `src/hooks/useRetainedDraft.ts` or `src/lib/drafts.ts` (the per-workout dismissed set), `workout.css`
- Test: extend `tests/workout-controls-render.test.ts`

**Interfaces:**
- Consumes `fatigueNote`, `lowerTargets` and `restoreTargets` (Task 1.9), and `prefs.fatigueMode`.

- [ ] **Step 1: Failing tests:**
  - mode suggest: the render shows the note text and two buttons, "Sänk till 20 × 8" and "Behåll målet";
  - mode off: nothing;
  - mode auto: the text "Målet sänkt till 20 × 8 för i dag. Räknas inte som ett missat mål." with Ångra.
- [ ] **Step 2: Run** `npx tsx --test tests/workout-controls-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The row folds with `MOTION.rowOut` / `EASE.collapse`. Sänk shows the 5 s toast with Ångra. Behåll records the dismissal in the draft's session state.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(coach): quiet fatigue row with Sänk/Behåll and undo`.

### Task 1.11: Finishing and the reward

**Files:**
- Create: `src/components/workout/RewardSheet.tsx`, `src/lib/finish-summary.ts`
- Modify: `FinishSheet.tsx`, `src/components/workout/WorkoutTopBar.tsx`, `src/pages/ActiveWorkout.tsx`, `src/hooks/useWorkoutActions.ts`, `workout.css`
- Test: create `tests/finish-summary.test.ts`; extend `tests/workout-controls-render.test.ts`

**Interfaces:**
- Produces:
  - `finishSummary(workout, records): { done: number; total: number; unchecked: number; volumeKg: number; record: { text: string; previous: string | null; more: number } | null }`;
  - `weekOrdinal(n: number, language): string` (Swedish "1:a, 2:a, 3:e, …");
  - `formatVolume(kg): string` (a narrow no-break space from 1 000, e.g. "6 252").

- [ ] **Step 1: Failing tests:**
  - `weekOrdinal(2,"sv")` is "2:a", `weekOrdinal(3,"sv")` is "3:e", and `(1,"en")` is "1st";
  - `formatVolume(6252)` is "6 252" (U+202F) and `formatVolume(980)` is "980";
  - render with 0 checked: the title "Inga set är ikryssade" and three buttons;
  - render with checked sets: the title "Avsluta Benpass?", the record row, three stats, "6 set är inte ikryssade och sparas inte.", and no muscle lines or routine switch;
  - the top bar's Avsluta has `data-ready` once all sets are checked.
- [ ] **Step 2: Run** `npx tsx --test tests/finish-summary.test.ts tests/workout-controls-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §B9 and §B10:
  - mode 1's actions, with "Spara som rutin och avsluta" going through `routineFromWorkout`, the Train message and Undo;
  - Släng's two taps (red outline, the label fading in over 120 ms);
  - mode 2;
  - the reward (icon pop with `SPRING.record` over `--gt-dur-reward`, the sheen over `--gt-dur-sheen`, "Visa schemat {plan}" inside an active plan, Klar to Train with "Passet sparat i Kalender");
  - the top bar's outline, or the existing `finish-shift` fill.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(finish): shorter v6 finish sheet and a reward with a way to the plan`.

### Task 1.12: The picker

**Files:**
- Modify: `src/components/picker/ExercisePickerBody.tsx`, `src/lib/exercise-search.ts`, `src/styles/items.css` (`.picker-order` as a 24 px circle)
- Test: `tests/exercise-search.test.ts`

**Interfaces:**
- Consumes `CategoryChips` and `matchesChip` (Task 0.9), and `exerciseSubtitle` (Task 0.8).

- [ ] **Step 1: Failing tests:**
  - search "knäböj": "Knäböj" ranks first, before "Knäböj med kroppsvikt" and "Bulgarisk utfallsböj";
  - "bänk": prefix matches come before the rest;
  - the chip "Legs" with the query "press" gives only leg presses.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-search.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - one chip row replacing the category and equipment facet rows;
  - "Senast använda" first;
  - subtitles;
  - the order circle.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(picker): v6 chips, Senast använda, exact matches first`.

### Task 1.13: P1 verification

**Files:** Create `scripts/verify/p1.cjs`. Modify `CHANGELOG.md`, `DESIGN.md` (the set row with RIR, the motion rows from H5), `PRODUCT.md`.

- [ ] **Step 1: Write the checks:**
  - **the pad and RIR:**
    - the pad's height in RIR mode equals its height in kg mode to ±0 px (decision 5);
    - the RIR slider changes with ArrowRight, Home and End, and `aria-valuetext` follows;
  - **the set row:**
    - the RIR box shows only with `gt-ask-rir = "true"`;
    - swiping set 3 removes the row and shows no "Ångra";
    - the first tap on a checked set shows the toast, and no row moves (its `getBoundingClientRect().top` is unchanged);
  - **coach and drops:**
    - the B13 fixture shows the fatigue row; Sänk changes the fields to 20 and the row's height reaches 0;
    - "+ Drop" appears after the first drop and adds 40 after 50;
  - **finishing:**
    - finishing with 0 checked opens "Inga set är ikryssade";
    - with all sets checked, Avsluta has the gradient class.
- [ ] **Step 2: Run** the full verification with `--phase p1`. Expected: all PASS in Chromium and WebKit.
- [ ] **Step 3: Commit** with `test(verify): P1 workout checks; docs`. Open PR P1.

---

# P2 Kalender, Träna och schemats kalender

### Task 2.1: Week matching

**Files:**
- Create: `src/data/week-match.ts`
- Modify: `src/data/plan-status.ts` (`planAdherence` gains `weeksFulfilled`, `weeksFinished`, `extras` and `status: "on" | "behind" | "ahead"`)
- Test: create `tests/week-match.test.ts`; extend `tests/plan-status.test.ts`

**Interfaces:**
- Produces:
  - `matchWeek(plan: PlanItem, done: DoneWorkout[], weekStart: string, today: string, resolve: (cell) => string | null): WeekMatch`, where `resolve` maps a cell to a routine id;
  - `type DayMatch = { date: string; planned: string | null; workoutIds: string[]; state: "done" | "missed" | "planned" | "plannedToday" | "today" | "rest"; movedFrom?: string; other?: boolean }`;
  - `type WeekMatch = { days: DayMatch[]; fulfilled: boolean; extras: number; matched: number; planned: number }`.
- P6 adds `other`.

- [ ] **Step 1: Failing tests:**
  - "Monday's Tryckpass done on Tuesday": Monday is not missed, and Tuesday is done with `movedFrom` Monday;
  - "same date wins over routine match";
  - "a workout on an unplanned day after all planned days are matched is an extra";
  - "two workouts on one planned date: one matches, the other is an extra";
  - "a past unmatched day is missed";
  - "today unmatched is plannedToday";
  - `planAdherence`: 3 finished weeks all fulfilled gives `weeksFulfilled` 3, `weeksFinished` 3 and status "on"; one week short gives "behind"; this week ahead gives "ahead".
- [ ] **Step 2: Run** `npx tsx --test tests/week-match.test.ts tests/plan-status.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §D9.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): week matching for done, missed and moved days`.

### Task 2.2: Day cell states

**Files:**
- Modify: `src/components/items/day-cell.ts`, `DayCell.tsx`, `DateTile.tsx`, `src/styles/items.css`
- Test: `tests/item-shapes.test.ts`

**Interfaces:**
- `DayCellState` gains `missed?`, `plannedToday?`, `moved?: "left" | "right"` and `todayDot?` (the grid size uses a dot instead of a ring).
- Produces `<MovedBadge side />`.

- [ ] **Step 1: Failing tests:**
  - the classes: `is-missed`, `is-planned-today`, `has-moved-left`, `is-today-dot`;
  - the CSS: `.day-cell.is-planned` uses `--gt-line-control`, not `--gt-done`;
  - the moved badge is 20 px with a 3 px stroke;
  - `DateTile`'s weekday is 12/700 and its number 17/700 (H1).
- [ ] **Step 2: Run** `npx tsx --test tests/item-shapes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the H1 day states.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(items): missed, moved, planned-today and today-dot day states`.

### Task 2.3: The week strip and the Today card (A2)

**Files:**
- Modify: `src/components/home/WeekCard.tsx`, `TodayCard.tsx`, `src/components/items/RoutineBadge.tsx` (no count), `RoutineCard.tsx` (secondary play), `pages.css` (the Train section)
- Test: `tests/home-helpers.test.ts`

**Interfaces:**
- Consumes `matchWeek` (Task 2.1) and the `DayCell` states (Task 2.2).
- Produces `weekLegend(days): { moved?: string }`, the weekday short name for "Flyttat hit från {d}".

- [ ] **Step 1: Failing tests:**
  - the heading is "Den här veckan · 1 av 3 pass";
  - the legend includes "Flyttat hit från mån" when a moved day exists;
  - the routine badge renders no number.
- [ ] **Step 2: Run** `npx tsx --test tests/home-helpers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §A2.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(train): week strip with week matching, moved badge and legend`.

### Task 2.4: First start (A1)

**Files:**
- Create: `src/components/home/GetStarted.tsx`
- Modify: `src/pages/Home.tsx`, `TodayCard.tsx`
- Test: extend `tests/today-and-redirects.test.ts`

**Interfaces:**
- Consumes `discoverPath`, `newPlanPath` (Task 0.9), `followsPhone` (Task 0.7) and `hasUserData`.

- [ ] **Step 1: Failing test:** with no user data, the render shows "Kör ditt första pass", three "Kom igång" rows and "Språk · Language" with "Svenska, som telefonen", and "Tomt pass" occurs once.
- [ ] **Step 2: Run** `npx tsx --test tests/today-and-redirects.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(train): first-start card and Kom igång`.

### Task 2.5: A running workout (A3)

**Files:**
- Modify: `src/hooks/useStartWorkout.tsx`, `src/components/home/ResumeCards.tsx`
- Test: extend `tests/today-and-redirects.test.ts`

- [ ] **Step 1: Failing test:** the dialog has the title "Du har ett pass igång", the subline "Bröst & Ben · 2 övningar · 0 av 3 set", and the three buttons in order. Släng needs two taps.
- [ ] **Step 2: Run** `npx tsx --test tests/today-and-redirects.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** "Spara som rutin och avsluta" uses `routineFromWorkout`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(train): clearer running-workout dialog`.

### Task 2.6: The compact calendar (C1)

**Files:**
- Modify: `src/components/ActivityHeatmap.tsx`, `src/components/HistoryCalendar.tsx`, `src/styles/history-calendar.css`
- Test: `tests/history-calendar.test.ts`, `tests/drag-selection.test.ts`

- [ ] **Step 1: Failing tests:**
  - a compact square has no click handler and no "tryck" in its label;
  - today's square has `is-today-dot`;
  - the selection caption for a weekday drag is "Måndagar, 26 okt – 16 nov", with "3 pass · 4 veckor";
  - the heading is "Senaste halvåret" with "73 pass" for the fixture.
- [ ] **Step 2: Run** `npx tsx --test tests/history-calendar.test.ts tests/drag-selection.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove the single-day tap, add the dot, the legend, the hint and the plan line.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(calendar): compact calendar without day taps; today as a dot`.

### Task 2.7: The Kalender list: Gjort/Planerat, older weeks, search

**Files:**
- Create: `src/lib/history-weeks.ts`
- Modify: `src/pages/History.tsx`
- Test: create `tests/history-weeks.test.ts`

**Interfaces:**
- Produces:
  - `historyWeeks(workouts, today, plan, query): { key; label; summary: { workouts; sets; records }; beforePlan: boolean; older: boolean; items }[]`;
  - `matchesQuery(workout, q): boolean` (name, exercise display names, date text).

- [ ] **Step 1: Failing tests:**
  - "benpass" keeps only Benpass, and the week summary counts only the matches;
  - weeks beyond the last three are marked `older`;
  - a week before the plan start is marked `beforePlan`;
  - no matches gives an empty list.
- [ ] **Step 2: Run** `npx tsx --test tests/history-weeks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the `Segmented` "Gjort | Planerat · n", the search toggle with autofocus, "Äldre veckor" with `Reveal`, and the match and no-match lines.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(calendar): Gjort/Planerat lists, older weeks folded, search`.

### Task 2.8: The plan period calendar

**Files:**
- Create: `src/components/plan/PlanPeriodCalendar.tsx`, `src/lib/period-calendar.ts`
- Modify: `history-calendar.css` (shared grid styles; 2 px row gap variant)
- Test: create `tests/period-calendar.test.ts`

**Interfaces:**
- Produces:
  - `periodColumns(start: string, end: string): { weekStart: string; days: string[] }[]`;
  - `periodLabels(plan, today): { column: number; text: "v. 1" | "nu" | "deload" }[]`;
  - `<PlanPeriodCalendar plan cell={(date) => DayCellState & { deload?: boolean }} labels legend rowGap={2|3} />`.

- [ ] **Step 1: Failing tests:**
  - 21 Dec – 14 Feb gives 8 columns starting on Monday 21 Dec;
  - the labels put "deload" on column 8 for 7 + 1;
  - "nu" sits on the column that holds today.
- [ ] **Step 2: Run** `npx tsx --test tests/period-calendar.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, reusing the grid code from `ActivityHeatmap` (extract the shared month and weekday header into a helper both use).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): plan period in the compact calendar`.

### Task 2.9: The new plan (F1): period row, deload presets, the whole period

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx` (adds the prop `draft?: Plan` for a prefilled new plan; P4 uses it), `PlanPeriodPicker.tsx`, `PlanCycle.tsx`, `src/data/phase.ts`
- Test: `tests/phase.test.ts`

**Interfaces:**
- Produces:
  - `deloadPresets(weeks: number): { id: string; label: string }[]` (for 8 weeks: "Ingen", "7 + 1", "3 + 1 två gånger");
  - `defaultDeload(weeks): string` (6 → "5+1", 8 → "7+1", 12 → "5+1x2");
  - `withCyclePreset(plan, preset)`, extended.

- [ ] **Step 1: Failing tests:**
  - `defaultDeload(8)` is "7+1", and the plan's last week kind is deload;
  - `defaultDeload(12)` gives weeks 6 and 12 as deload;
  - the period text is "8 veckor · 21 dec – 14 feb";
  - "21 dec – 14 feb · 21 pass och 3 lättare i deloadveckan" for a 3-day template.
- [ ] **Step 2: Run** `npx tsx --test tests/phase.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §F1, without the Planerad vecka card (P3 adds it in Task 3.7).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): period row, length-based deload presets, whole-period calendar`.

### Task 2.10: Plan status top (F2)

**Files:**
- Create: `src/components/plan/PlanPeriodCard.tsx`
- Modify: `src/pages/PlanStatus.tsx`, `src/components/plan/PlanStatusCards.tsx` (remove the phase bar and week grid card), `pages.css` (plan section)
- Test: `tests/plan-status.test.ts` (render)

**Interfaces:**
- Consumes `planAdherence`'s new fields (Task 2.1) and `PlanPeriodCalendar` (Task 2.8).

- [ ] **Step 1: Failing test:** the render shows "3 av 3 veckor fullföljda", "I fas", "3 extrapass · 13 pass totalt · den här veckan 1 av 3", "Nästa pass · i dag", and an ⓘ that opens "Fullföljd vecka".
- [ ] **Step 2: Run** `npx tsx --test tests/plan-status.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Leave a clearly marked slot `{/* P3: plan gaps warning */}` after "Nästa pass" for Task 3.7.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): status top as the period calendar with week-based adherence`.

### Task 2.11: P2 verification

**Files:** Create `scripts/verify/p2.cjs`. Modify `CHANGELOG.md` and `DESIGN.md` (the Day shape row in Shapes; week strip legend).

- [ ] **Step 1: Write the checks:**
  - **Train week strip:** the moved badge sits top-left on Tuesday with its arrow pointing right; no day under 44 px;
  - **Calendar:** a tap on a compact square does not change the URL or open a sheet; a hold-and-drag along one row shows the weekday caption; today's square has a centred 4 px dot (by `getBoundingClientRect`);
  - **plan calendars:** F1's period rows are 2 px apart; F2 shows "fullföljda".
- [ ] **Step 2: Run** the full verification with `--phase p2`. Expected: all PASS.
- [ ] **Step 3: Commit** with `test(verify): P2 checks; docs`. Open PR P2.

---

# P3 Muskler, volym och Framsteg

### Task 3.1: hipFlexors, volume groups and three names per muscle

**Files:**
- Modify:
  - `src/data/muscles.ts`;
  - `src/data/exercise-muscles.ts`;
  - `src/lib/muscle-figure.ts`;
  - `src/i18n/en.ts` and `sv.ts`: edit `muscleName.*` to the spec §D1 short names, and add `muscleLatin.*` and `muscleAnatomy.*` under the P3 anchor;
  - `src/lib/catalogue-labels.ts`.
- Test: `tests/exercise-muscles.test.ts`, `tests/muscle-figure.test.ts`; create `tests/volume-groups.test.ts`

**Interfaces:**
- Produces:
  - `MUSCLES` with `hipFlexors` last;
  - `VOLUME_GROUPS: readonly { group: MuscleGroup; main: Muscle[]; minor: Muscle[] }[]`;
  - `JUDGED_MUSCLES` (12);
  - `muscleLatin(m)` and `muscleAnatomy(m)` in `catalogue-labels.ts`.

- [ ] **Step 1: Failing tests:**
  - `MUSCLES.length` is 24, and the last is `hipFlexors`;
  - every muscle sits in exactly one `VOLUME_GROUPS` entry;
  - `JUDGED_MUSCLES` has 12 entries and equals the spec's list;
  - Hanging Leg Raise has `hipFlexors` 1 and `abs` 1;
  - Sit Up has `hipFlexors` 0.5;
  - `VIEW_SIDE.hipFlexors` is 1;
  - in Swedish, `muscleAnatomy("soleus")` is "Flundremuskeln" and `muscleName("lats")` is "Breda ryggmuskeln".
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-muscles.test.ts tests/muscle-figure.test.ts tests/volume-groups.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §D1, including the RDL family's category in `catalogue.ts`.
- [ ] **Step 4: Run** the tests, then `npm test`. Fix the snapshots that change only because of names.
- [ ] **Step 5: Commit** with `feat(muscles): hip flexors, main/minor groups, anatomical names; RDL in Legs`.

### Task 3.2: Map geometry (D3, D3b, H3)

**Files:**
- Modify: `src/components/muscles/detailed-geometry.ts` (`FIGURES.m` and `FIGURES.f`), `MuscleMap.tsx` (the halo outline), `src/styles/muscles.css`
- Test: `tests/muscle-geometry.test.ts`, `tests/muscle-render.test.ts`

- [ ] **Step 1: Failing tests:**
  - both figures have a front shape for `hipFlexors`, drawn last in the front list;
  - no `soleusF`;
  - the `tibialis` and `calves` front shapes' bounding boxes are ≥ 2.5 units apart horizontally;
  - `gluteMed` is drawn before `gluteMax` on the back;
  - the `hipFlexors` bounding box overlaps neither `rFem` nor `adductors` by more than 0.5 units.
- [ ] **Step 2: Run** `npx tsx --test tests/muscle-geometry.test.ts tests/muscle-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Port** the paths from `docs/superpowers/mockups/2026-11-v6/mockup.html`: search the inline SVG `<path id=…>` / the `FIG` data for `hipFlexors`, `gluteMed`, `abs1`–`abs4`, `vLat`, `rFem`, `vMed`, `tibialis` and `calfF`. Add the dark halo through `--gt-map-halo`.
- [ ] **Step 4: Run.** Expected: PASS. Compare screenshots of the exercise page map before and after in both themes.
- [ ] **Step 5: Commit** with `feat(map): fuller front, glute medius under maximus, iliopsoas, shin gap`.

### Task 3.3: The volume model

**Files:**
- Create: `src/data/muscle-volume.ts`
- Test: create `tests/muscle-volume.test.ts`

**Interfaces:**
- Consumes `hardSetsPerMuscle` (`muscle-map.ts`) and `VOLUME_GROUPS` (Task 3.1).
- Produces:
  - `type GroupRow = { group; judged: boolean; sum: number; planSum: number; inside: number; mains: number; allInside: boolean; muscles: { muscle; done; plan; minor: boolean }[] }`;
  - `muscleVolume(done: MuscleSets, plan: MuscleSets): { rows: GroupRow[]; collapsed: MuscleGroup[] }`;
  - `plannedWeekVolume(plan: Plan, routines: Map<string, Routine>, week: number, musclesOf): MuscleSets`.

- [ ] **Step 1: Failing tests:**
  - "Axlar sums the mains": frontDelts 8, sideDelts 4.5 and rearDelts 0 give `sum` 12.5, `inside` 0 and `mains` 3;
  - "order by plan per muscle, then done; Core last";
  - "only a group with 0 done and 0 planned on every main collapses";
  - `plannedWeekVolume` for a template of Benpass and Tryckpass counts working sets × level, and counts group or day-type cells as nothing.
- [ ] **Step 2: Run** `npx tsx --test tests/muscle-volume.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §D11.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(volume): per-muscle model with group sums and planned week`.

### Task 3.4: MuscleVolumeCard on Framsteg (D1)

**Files:**
- Create: `src/components/muscles/MuscleVolumeCard.tsx`, `src/components/progress/KeyStats.tsx`
- Modify: `src/pages/Progress.tsx`; delete `src/components/MuscleSets.tsx` once unused; `pages.css` (Progress section), `muscles.css`
- Test: create `tests/muscle-volume-card.test.ts`; extend `tests/progress-helpers.test.ts`

**Interfaces:**
- Produces `<MuscleVolumeCard done plan weekdaysText coach?={ReactNode} onMap? />`.

- [ ] **Step 1: Failing tests:**
  - the render shows "Axlar", "12,5", "0 av 3 inom" and no muscle name on the group row;
  - expanding shows "Främre deltamuskeln" with "plan 4";
  - the minor rows have the `is-minor` class plus the grey note;
  - `keyStats` gives the deltas against the 4 weeks before.
- [ ] **Step 2: Run** `npx tsx --test tests/muscle-volume-card.test.ts tests/progress-helpers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The fold-outs use `Reveal`. Rows are 44 px and the fold-out 28 px. Nyckeltal goes in its own card with the period segment; remove the header period chip.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(progress): sets per muscle card and Nyckeltal`.

### Task 3.5: The exercise page (D2)

**Files:**
- Create: `src/lib/session-compare.ts`
- Modify: `src/components/exercise/ExerciseOverview.tsx`, `src/pages/Exercise.tsx`, `ExerciseMuscles.tsx` (the compact row and sheet), `details.css`
- Test: create `tests/session-compare.test.ts`; extend `tests/exercise-overview.test.ts`

**Interfaces:**
- Produces `compareSessions(now: SessionSummary, before: SessionSummary): { chips: { text: string; tone: "up" | "neutral" | "down" }[] }`. The chips are "+1 rep", "−2,5 kg" and "1RM lika".

- [ ] **Step 1: Failing tests:**
  - 4 × 80 × 6 against 4 × 82.5 × 5 gives the chips `["+1 rep","−2,5 kg","1RM lika"]`, with the third neutral;
  - Overview has no recent-sessions list and shows the "Alla pass med bänkpress finns under Historik" row.
- [ ] **Step 2: Run** `npx tsx --test tests/session-compare.test.ts tests/exercise-overview.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §D2:
  - the two boxes;
  - "Nästa mål";
  - the compact map row (132 px) opening the sheet;
  - the e1RM curve (reuse `TrendChart` in compact form);
  - the Historik row;
  - the tab bar marking Bibliotek.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(exercise): structured comparison, map row and 1RM curve`.

### Task 3.6: Goals (D4)

**Files:**
- Modify: `src/components/goals/GoalCard.tsx`, `src/lib/goal-pace.ts`, `pages.css` (Goals section)
- Test: `tests/goal-insights.test.ts`

**Interfaces:**
- Produces `likelyRange(goal, now, today): { lo: number; hi: number; date: string }`. The low end is 1 % 1RM a week; the high end is your own rate.

- [ ] **Step 1: Failing tests:**
  - the bench press fixture gives `lo` 102 and `hi` 108 for 3 Jan, `rate` 1.8 and `need` 3.3;
  - the render shows "Start", "Nu", "Mål", "Takt 1,8 kg i veckan", "Krävs 3,3" and "Trolig nivå 3 jan ≈ 102–108";
  - no explanatory text box.
- [ ] **Step 2: Run** `npx tsx --test tests/goal-insights.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, with ⓘ through `ChoiceSheet` / `Sheet` and the info copy from the spec.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(goals): three numbers, pace line and likely range`.

### Task 3.7: Plan gaps, Planerad vecka and the F2 warning (after P2 merged)

**Files:**
- Create: `src/data/plan-gaps.ts`, `src/components/plan/PlannedWeekCard.tsx`
- Modify: `PlanEditor.tsx` (insert the card after Hela perioden), `PlanPeriodCard.tsx` / `PlanStatus.tsx` (the P2 slot)
- Test: create `tests/plan-gaps.test.ts`

**Interfaces:**
- Consumes `plannedWeekVolume` (Task 3.3).
- Produces:
  - `planGaps(planned: MuscleSets): { pull: boolean; hinge: boolean; zero: Muscle[]; gluteNoHams: boolean } | null`;
  - `gapActions(plan, routines): { id: "hinge" | "pull"; label: string; apply(): { plan; routines }; done: string }[]`.

- [ ] **Step 1: Failing tests:**
  - a template with only Benpass (squat, split squat, calf raise) and Tryckpass gives pull and hinge, with zero `[lats, biceps, hamstrings]` in that order, and `gluteNoHams` true;
  - the hinge action adds Romanian Deadlift with 3 sets and the 8–10 range to Benpass.
- [ ] **Step 2: Run** `npx tsx --test tests/plan-gaps.test.ts`. Expected: FAIL.
- [ ] **Step 3: Rebase on P2, then implement** spec §F1's Planerad vecka and F2's warning row with "Se volymen".
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): planned week volume with gap warning and actions`.

### Task 3.8: The coach box and the volume card on plan status (F3)

**Files:**
- Create: `src/data/coach.ts`
- Modify: `PlanStatusCards.tsx` (the volume card becomes `MuscleVolumeCard` with `coach`), the map sheet
- Test: create `tests/coach.test.ts`

**Interfaces:**
- Produces `coachSuggestions(volume: GroupRow[], plan, today, routines): { text: string; action: string; done: string; apply(): { routines }; undo(): void }[]` (at most 2).

- [ ] **Step 1: Failing tests:**
  - the fixture gives `["Baksida lår 0 av 10, i dag Benpass", "Rygg och biceps 0 i veckan"]`, with the actions "Lägg till rumänsk marklyft och lårcurl i dag" and "Lägg till rodd på lördag";
  - apply adds the sets to the routines, and the planned volume for hamstrings becomes 6.
- [ ] **Step 2: Run** `npx tsx --test tests/coach.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** An applied row becomes "✓ {done}", and the message has Ångra. The groups and the map sheet redraw. The footnote leaves out the RIR sentence.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): coach box on the volume card`.

### Task 3.9: The week map overlay hook for P6

**Files:**
- Modify: `src/data/muscle-map.ts` (export `heatStepWith(sets: number, trained: boolean): HeatStep`), `src/components/muscles/MuscleMap.tsx` (accept an optional `trained?: ReadonlySet<Muscle>`)
- Test: `tests/muscle-map.test.ts`

- [ ] **Step 1: Failing tests:** `heatStepWith(0, true)` is 1, `(12, true)` is 3, and `(0, false)` is 0.
- [ ] **Step 2: Run** `npx tsx --test tests/muscle-map.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(map): trained-without-sets heat step`.

### Task 3.10: Stalled lifts (F4) (after P2 merged)

**Files:**
- Create: `src/data/plateau.ts`, `src/components/plan/StalledLifts.tsx`
- Modify: `PlanStatusCards.tsx` (replace the progression card's plateau part, and remove "Lägg till dubbel progression")
- Test: create `tests/plateau.test.ts`

**Interfaces:**
- Produces `stalledLifts(records, plan, today, step): { exerciseId; best: WorkoutSet; sessions: number; weeks: number; action: "deload10" | "doubleProgression"; deloadKg?: number; nextText?: string }[]`.

- [ ] **Step 1: Failing tests:**
  - an overhead press at 40 × 8 for 9 weeks over more than 4 sessions gives `deload10` with `deloadKg` 35 on step 2.5;
  - an incline dumbbell press at 24 × 10 over 5 sessions gives "Kör till 3 × 12, sedan 26 kg";
  - 2 sessions give nothing.
- [ ] **Step 2: Run** `npx tsx --test tests/plateau.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §F4, including "Utveckling sedan start" and the footnote.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(plan): stalled lifts with step-rounded suggestions`.

### Task 3.11: P3 verification

**Files:** Create `scripts/verify/p3.cjs`. Modify `CHANGELOG.md` and `DESIGN.md` (map tokens, volume card).

- [ ] **Step 1: Write the checks:**
  - **the volume card:**
    - Framsteg's group rows are 44 px and the fold-out rows 28 px;
    - every map muscle appears in exactly one fold-out (24 names);
  - **the map:**
    - in dark theme the map panel is `rgb(47, 55, 70)`;
    - the hip flexor shape exists on the front;
  - **the exercise page and plan status:**
    - the exercise page shows the two boxes side by side at 360 px without overflow;
    - F3's "Lägg till rodd på lördag" becomes "✓ Tillagt …", and Ångra restores it.
- [ ] **Step 2: Run** the full verification with `--phase p3`. Expected: all PASS.
- [ ] **Step 3: Commit** with `test(verify): P3 checks; docs`. Open PR P3, rebased on P2.

---

# P4 Bibliotek och egen övning

### Task 4.1: Tabs and redirects

**Files:**
- Modify: `src/pages/Library.tsx`, `src/lib/legacy-routes.ts`, `src/App.tsx` (`/library/plan` redirects to `/library?tab=plans`), `src/pages/LibraryPlan.tsx` (removed or redirecting)
- Test: `tests/today-and-redirects.test.ts`

- [ ] **Step 1: Failing tests:**
  - `?tab=discover` maps to `?view=discover`;
  - `/library/plan` maps to `?tab=plans`;
  - the tabs read "Rutiner, Övningar, Scheman".
- [ ] **Step 2: Run** `npx tsx --test tests/today-and-redirects.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Rutiner gets the `Segmented` "Mina | Upptäck", which drives `?view=`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(library): Rutiner · Övningar · Scheman; Upptäck inside Rutiner`.

### Task 4.2: The Övningar list

**Files:**
- Modify: `src/components/library/ExercisesPanel.tsx`, `ExerciseRow.tsx` (library), `pages.css` (Library section)
- Test: `tests/library.test.ts`

- [ ] **Step 1: Failing tests:**
  - A–Ö uses Swedish order (a–z, then å, ä, ö): `["Ögonlyft","Axelpress","Ändlyft"]` sorts to `["Axelpress","Ändlyft","Ögonlyft"]` with `localeCompare(…, "sv")`;
  - "Mina övningar" comes first;
  - the chip row uses `CategoryChips`.
- [ ] **Step 2: Run** `npx tsx --test tests/library.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(library): Övningar with chips, Mina first, Swedish A–Ö`.

### Task 4.3: The Scheman tab

**Files:**
- Create: `src/components/library/PlansTab.tsx`
- Modify: `src/components/plan/PlanPanel.tsx` (extract the list rows; groups stay under Advanced)
- Test: `tests/plans.test.ts`

**Interfaces:**
- Produces `planRowStatus(plan, today, adherence): { line: string; word: "Aktivt" | "Kommande" | "Avslutat" }`.

- [ ] **Step 1: Failing tests:**
  - an active plan gives "Vecka 4 av 8 · 3 pass i veckan · deload v. 8" / "Aktivt";
  - a future one gives "Startar 21 dec · 8 veckor" / "Kommande";
  - an ended one gives "Jun–aug · 11 av 12 veckor fullföljda" / "Avslutat".
- [ ] **Step 2: Run** `npx tsx --test tests/plans.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add "Nytt schema" and the note. There is no share button.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(library): Scheman tab`.

### Task 4.4: Programme data

**Files:**
- Create: `src/data/programs.ts`
- Test: create `tests/programs.test.ts`

**Interfaces:**
- Produces:
  - `PROGRAMS: Program[]` (spec §D8);
  - `programWeeklySets(p, musclesOf): Partial<Record<Muscle, number>>`;
  - `programRange(p, musclesOf): [number, number]`.

- [ ] **Step 1: Failing tests:**
  - every exercise id is in the catalogue;
  - there are 5 programmes and 13 routines;
  - the routine names are exactly the spec's;
  - `programRange(ou)` is `[6.5, 17.5]`;
  - `programWeeklySets(ou).rearDelts` is 6.5 and `.glutes` is 17.5;
  - every `schedule` row has 7 cells, and the hk schedule has 2 rows.
- [ ] **Step 2: Run** `npx tsx --test tests/programs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the data.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(programs): five standard programmes`.

### Task 4.5: Adding and removing programmes, and making a plan

**Files:**
- Create: `src/lib/program-actions.ts`
- Test: create `tests/program-actions.test.ts`

**Interfaces:**
- Produces:
  - `programRoutines(p): Routine[]` (folder = title, `repRange`, `newSet()` working sets);
  - `isProgramAdded(p, routines): boolean`;
  - `routinesToRemove(p, routines, added: Map<string, string>): string[]`, which returns only routines unchanged since added (compare exercises and sets ignoring ids);
  - `programPlanDraft(p, routineIds: Record<string, string>, today): Plan`.

- [ ] **Step 1: Failing tests:**
  - adding ou gives 4 routines in the folder "Över/under 4 dagar";
  - `isProgramAdded` is true after adding;
  - **(Review Focus 5)** after editing Underkropp B, `routinesToRemove` leaves it out;
  - `programPlanDraft(hk)` has `cycleWeeks` 2 and template row 1 `[A, null, B, null, A, null, null]` (ids).
- [ ] **Step 2: Run** `npx tsx --test tests/program-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(programs): add, remove and make a plan`.

### Task 4.6: Upptäck and the programme sheet

**Files:**
- Create: `src/components/library/ProgramSheet.tsx`
- Modify: `DiscoverPanel.tsx`, `RoutinesPanel.tsx` (the Mina/Upptäck segment)
- Test: create `tests/program-sheet.test.ts`

**Interfaces:**
- Consumes Tasks 4.4 and 4.5, `newPlanPath`, and `PlanEditor`'s `draft` prop (P2, Task 2.9).

- [ ] **Step 1: Failing tests:**
  - the list shows five rows with "Van · 4 dagar · 4 rutiner" and a + labelled "Lägg till Över/under 4 dagar i Mina rutiner";
  - the chip "Styrka" leaves one row;
  - the sheet shows "6,5–17,5 · riktmärke 10–20" and twelve muscles, lowest first.
- [ ] **Step 2: Run** `npx tsx --test tests/program-sheet.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - + and ✓ with the messages;
  - "Lägg till {n} rutiner";
  - "Gör det till ett schema", which opens the plan editor with `draft`;
  - the signed-out row with ⓘ.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(library): standard programmes in Upptäck`.

### Task 4.7: The editor: equipment, derived category, duplicate row

**Files:**
- Create: `src/lib/custom-exercise.ts`
- Modify: `src/components/library/ExerciseEditorSheet.tsx`
- Test: create `tests/custom-exercise.test.ts`; extend `tests/editor-helpers.test.ts`

**Interfaces:**
- Produces:
  - `derivedCategories(muscles): { category: string; categories: string[] }`;
  - `CUSTOM_EQUIPMENT = ["dumbbell","barbell","kettlebell","machine","cable","band","bodyweight"]`;
  - `withEquipment(payload, eq)`, which sets `equipment` and `icon`.

- [ ] **Step 1: Failing tests:**
  - obliques 1 and abs 0.5 give Core;
  - a tie between Chest and Shoulders gives Chest (`MUSCLE_GROUPS` order);
  - no muscles give "Other";
  - `withEquipment(p,"cable").icon` is "cable";
  - an existing exercise with `icon: "body"` keeps it until equipment changes;
  - "Använd dess muskler" for "pallof press" copies the catalogue muscles and `cable`.
- [ ] **Step 2: Run** `npx tsx --test tests/custom-exercise.test.ts tests/editor-helpers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §E3:
  - the field order and focus;
  - the equipment chip row;
  - the duplicate `MessageSlot` row with the two links;
  - the derived line;
  - the note;
  - "Spara övning".

  The Kategori and Tränar även fields go.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(editor): equipment choice, derived category, duplicate warning`.

### Task 4.8: The muscle picker beside a flippable, sticky map

**Files:**
- Modify: `src/components/library/MusclePicker.tsx`, `src/components/muscles/MuscleMap.tsx` (a `side?: "front" | "back"` single-side mode at 138 × 327), `src/lib/muscle-picker.ts`, `src/styles/muscles.css`
- Test: `tests/muscle-picker.test.ts`

**Interfaces:**
- Produces `cycleLevel(level: MuscleLevel | undefined): MuscleLevel | undefined` (none → 1 → 0.5 → none).

- [ ] **Step 1: Failing tests:**
  - `cycleLevel` order;
  - the render shows a two-column grid, a "Fram | Bak" segment, the levels "Ingen | Lite | Mycket" with "Ingen" neutral, and Latin subtitles in Avancerad;
  - the map column has `position: sticky` (class `is-sticky`).
- [ ] **Step 2: Run** `npx tsx --test tests/muscle-picker.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The flip is a cross-fade (`MOTION.reduced` under reduced motion). The hairline under the sticky map shows when scrolled.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(editor): larger flippable map beside the levels, sticky`.

### Task 4.9: The new routine (E5)

**Files:**
- Modify: `src/components/library/RoutinesPanel.tsx` (the editor), `src/lib/routine-library.ts`
- Test: `tests/routine-library.test.ts`

- [ ] **Step 1: Failing tests:**
  - `addExercisesToRoutine` gives each exercise 3 working sets;
  - the editor renders no draft buttons before a change;
  - the name input has `autoFocus`.
- [ ] **Step 2: Run** `npx tsx --test tests/routine-library.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(routines): focused name, no early draft buttons, 3 sets`.

### Task 4.10: The machine glyph

**Files:**
- Modify: `src/components/muscles/equipment-shapes.ts`
- Test: `tests/exercise-icon.test.ts`

- [ ] **Step 1: Failing test:** the machine shape has no `pin` part (assert that the element list has no path with id or role `pin`).
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-icon.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, following H4: the rails and the weight stack.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(icons): machine glyph without the lock pin`.

### Task 4.11: P4 verification

**Files:** Create `scripts/verify/p4.cjs`. Modify `CHANGELOG.md` and `DESIGN.md` (Where things live: Scheman tab, Upptäck in Rutiner).

- [ ] **Step 1: Write the checks:**
  - **the editor map:**
    - in the editor, scrolling the level list keeps the map's top constant;
    - the map is 138 px wide;
    - Fram/Bak flips it;
  - **Upptäck:**
    - + becomes ✓ and the message appears;
    - "Gör det till ett schema" opens the plan editor with seven day buttons filled.
- [ ] **Step 2: Run** the full verification with `--phase p4`. Expected: all PASS.
- [ ] **Step 3: Commit** with `test(verify): P4 checks; docs`. Open PR P4.

---

# P5 Inställningar

### Task 5.1: Groups and rows

**Files:**
- Modify: `src/pages/Settings.tsx`, `src/components/settings/PreferenceSheets.tsx`, `RestControl.tsx` (`RestSettings`: the switch with Ljud and Vibrera under it, no time), `pages.css` (Settings section)
- Test: create `tests/settings-render.test.ts`

- [ ] **Step 1: Failing tests:**
  - the group titles are, in order, "Utseende, Träning, Vilotimer, Loggning, Coach, Allmänt", followed by the existing Data, Hjälp and Konto;
  - with the timer off, Ljud and Vibrera are absent;
  - with it on, both are present;
  - "Fråga efter RIR" has the sub-text "Plattan får ett RIR-läge efter reps".
- [ ] **Step 2: Run** `npx tsx --test tests/settings-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §G1.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(settings): grouped as Utseende, Vilotimer, Loggning, Coach, Allmänt`.

### Task 5.2: The theme row and the language row

**Files:**
- Modify: `src/contexts/ThemeContext.tsx` (`followPhone()`), `PreferenceSheets.tsx` (ThemeSheet removed), `Settings.tsx`
- Test: `tests/settings-render.test.ts`

- [ ] **Step 1: Failing tests:**
  - the theme row is a button containing the day/night switch, with the value "Följer telefonen (ljust nu)";
  - after a manual choice, "Följ telefonen igen" shows;
  - the language row reads "Svenska, som telefonen" while `followsPhone`.
- [ ] **Step 2: Run** `npx tsx --test tests/settings-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The theme change sets the transition class one frame before the theme class (R9).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(settings): theme switch in the row and follow the phone again`.

### Task 5.3: The Coach group

**Files:**
- Modify: `Settings.tsx`, `PreferenceSheets.tsx` (`CoachSettings`)
- Test: `tests/settings-render.test.ts`

- [ ] **Step 1: Failing test:** the "Trött muskel sent i passet" segment has "Föreslå" pressed by default, and choosing "Av" saves `gt-fatigue-mode = "off"`.
- [ ] **Step 2: Run** `npx tsx --test tests/settings-render.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(settings): Coach group`.

### Task 5.4: P5 verification

**Files:** Create `scripts/verify/p5.cjs`. Modify `CHANGELOG.md`.

- [ ] **Step 1: Write the checks:**
  - a tap anywhere on the Tema row switches the theme, and in WebKit the text and the surface fade together (sample computed colours at 0, 325 and 650 ms);
  - all switches are full rows ≥ 44 px.
- [ ] **Step 2: Run** the full verification with `--phase p5`. Expected: all PASS.
- [ ] **Step 3: Commit** with `test(verify): P5 checks; docs`. Open PR P5.

---

# P6 Sport

### Task 6.1: The category, the standard sports and their fields

**Files:**
- Modify:
  - `src/data/catalogue.ts`: "Sport" in `categories`, equipment `"sport"`, eleven rows with `measure` "cardio" (`options.measure: "cardio"`; widen `Row`'s type);
  - `src/data/exercise-muscles.ts`: the sport muscles;
  - `src/lib/cardio.ts` (`SPORT_FIELDS`);
  - `src/data/exercise-names-sv.ts`;
  - `src/lib/catalogue-labels.ts`;
  - `src/data/workouts.ts` (`initialSet`);
  - `src/data/exercise-muscles.ts` (`isCardioExercise`);
  - the i18n P6 block (`category.Sport`, `equipment.sport`).
- Create: `src/lib/sport.ts`
- Test: create `tests/sport.test.ts`

**Interfaces:**
- Produces:
  - `isSport(entry: { category?: string }): boolean`;
  - `SPORT_IDS: readonly string[]`;
  - `defaultCardioFields("builtin:swimming")` gives `{ fields: ["time","distance"], distanceUnit: "m" }`, the same shape as the rowing machine's defaults.

- [ ] **Step 1: Failing tests:**
  - eleven catalogue entries have category Sport and measure cardio, and their ids are the spec's;
  - each is in `MUSCLES_BY_NAME`;
  - the Swedish names come from `SV_NAMES`;
  - `initialSet("builtin:alpine-skiing")` has measure "cardio";
  - a custom `{ category: "Sport", measure: "cardio" }` too;
  - `defaultCardioFields` for alpine skiing is time only;
  - "Sport" is not in `MUSCLE_GROUPS`.
- [ ] **Step 2: Run** `npx tsx --test tests/sport.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §D13 (the standard sports table).
- [ ] **Step 4: Run** the test, then `npm test`. The catalogue-wide mapping tests must still pass.
- [ ] **Step 5: Commit** with `feat(sport): Sport category and eleven standard sports`.

### Task 6.2: Icons

**Files:**
- Modify: `src/components/muscles/equipment-shapes.ts` (the `sport` glyph), `src/data/exercise-muscles.ts` (`CUSTOM_ICONS` gains "sport" and "heart"), `src/lib/exercise-icon.ts` (Sport uses the cardio tint and the sport glyph; a custom sport uses "sport" or "heart")
- Test: `tests/exercise-icon.test.ts`

- [ ] **Step 1: Failing tests:**
  - `exerciseIcon` for `builtin:yoga` is `{ kind: "equipment", glyph: "sport", tone: "cardio" }`;
  - a custom sport with `icon: "heart"` gives the cardio heart figure;
  - the sport glyph keeps ≥ 3:1 on the cardio tint in both themes (the existing contrast helper);
  - an unknown icon still gives the dumbbell.
- [ ] **Step 2: Run** `npx tsx --test tests/exercise-icon.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sport): sport glyph and icons`.

### Task 6.3: A sport workout and how it counts

**Files:**
- Create: `src/data/sport.ts`
- Modify: `src/lib/history-weeks.ts` (from P2: set counts leave sport sets out), `src/components/items/WorkoutRow.tsx` / `src/lib/history-caption.ts` (the "{tid} · {distans}" line)
- Test: extend `tests/sport.test.ts`

**Interfaces:**
- Produces:
  - `sportWorkout({ exerciseId, name, date, values: Pick<WorkoutSet, "durationSec"|"distanceM"|"calories"|"heartRate">, note?, planMark? }): Workout`;
  - `isSportWorkout(w, isSportId): boolean`;
  - `sportLine(w): string`.

- [ ] **Step 1: Failing tests:**
  - `sportWorkout` gives a completed workout with one done cardio working set, `duration` = round(`durationSec`/60), `startedAt` null, that passes `validate("workout", …)`;
  - `durationSec` 0 throws (the quick flow forbids it);
  - **"no hard sets":** `hardSetsPerMuscle` and `isHardSet` give 0 for a sport workout;
  - `historyWeeks` counts the workout but 0 sets;
  - `sportLine` is "1 h 30 min · 12 km".
- [ ] **Step 2: Run** `npx tsx --test tests/sport.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sport): sport workouts count as workouts, never as sets`.

### Task 6.4: Adherence: "annan träning"

**Files:**
- Modify: `src/data/week-match.ts` (`other`), `src/components/home/DaySheet.tsx`, `src/hooks/usePlanDaySheet.tsx`, `PlanPeriodCard.tsx` (the F2 list text)
- Test: `tests/week-match.test.ts`

- [ ] **Step 1: Failing tests:**
  - a sport-only workout on a planned Monday makes Monday done with `other: true`, and the week is fulfilled;
  - a sport on an unplanned day after all are matched is an extra;
  - the day sheet text is "Annan träning: Alpin skidåkning".
- [ ] **Step 2: Run** `npx tsx --test tests/week-match.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sport): a sport on a planned day counts as other training`.

### Task 6.5: Sport on the map

**Files:**
- Modify: `src/data/muscle-map.ts` (`sportMuscles`), `PlanStatusCards.tsx` / `MuscleVolumeCard`'s map and the D3 week map sheet (pass `trained`)
- Test: `tests/muscle-map.test.ts`

**Interfaces:**
- Consumes `heatStepWith` (Task 3.9).
- Produces `sportMuscles(workouts, musclesOf, isSportId): Set<Muscle>`.

- [ ] **Step 1: Failing tests:**
  - a week with alpine skiing gives quads, glutes, hamstrings, adductors, abductors, abs and obliques;
  - the volume numbers are unchanged with and without the ski workout;
  - quads with 0 sets render at heat step 1.
- [ ] **Step 2: Run** `npx tsx --test tests/muscle-map.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, with the note "Sport syns på kartan men räknas inte som set." under Veckans karta when a sport is in the week.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sport): sport muscles on the map, not in the set counts`.

### Task 6.6: The "Logga sport" sheet and its entry points

**Files:**
- Create: `src/components/sport/LogSportSheet.tsx`, `src/hooks/useLogSport.ts`
- Modify: `src/pages/Home.tsx`, `TodayCard.tsx` (⋯ items), `DaySheet.tsx` / `usePlanDaySheet.tsx` ("Gjorde en sport i stället")
- Test: create `tests/log-sport.test.ts`

**Interfaces:**
- Consumes `sportWorkout` (Task 6.3), the cardio field inputs (`CardioFieldsSheet` / `SetNumberInput`), the past-workout date picker, and `planStartFor` for the plan mark.
- Produces `recentSports(records, limit = 5): string[]` (exercise ids, the latest first).

- [ ] **Step 1: Failing tests:**
  - `recentSports` orders by the latest workout date;
  - the sheet renders "Logga sport", "Senast", "Alla sporter" and "Ny sport";
  - choosing Längdskidåkning shows the Tid and Distans fields, and "Spara" is disabled until Tid > 0;
  - saving calls `saveRecord` with a completed workout on the chosen date, and the message reads "Längdskidåkning sparad i Kalender".
- [ ] **Step 2: Run** `npx tsx --test tests/log-sport.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** spec §S. Ångra deletes the record through the existing undo-delete action.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sport): Logga sport from Train and from a planned day`.

### Task 6.7: Your own sport and the Library chip

**Files:**
- Modify: `ExerciseEditorSheet.tsx` (`mode: "sport"`), `MusclePicker.tsx` (the note prop), `src/lib/category-filter.ts` (the "Sport" chip before "mine"), `ExercisesPanel.tsx` (the empty state)
- Test: extend `tests/sport.test.ts` and `tests/category-filter.test.ts`

**Interfaces:**
- Produces `newSportPayload({ name, fields, muscles, icon }): CustomExercise`, with category "Sport", measure "cardio", and `categories` from `derivedCategories(muscles).categories`. The library's `cardioFields[id]` is written alongside it.

- [ ] **Step 1: Failing tests:**
  - the payload validates as `"exercise"`;
  - its `cardioFields` entry always includes "time";
  - the chip "Sport" matches only sports.
- [ ] **Step 2: Run** `npx tsx --test tests/sport.test.ts tests/category-filter.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the editor's sport mode (spec §S).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sport): create your own sport; Sport chip in Library`.

### Task 6.8: P6 verification

**Files:** Create `scripts/verify/p6.cjs` and `scripts/verify/fixture-p6.cjs` (a planned Monday this week without a workout). Modify `CHANGELOG.md`, `PRODUCT.md` (the Sport section) and `DESIGN.md` (the sport glyph).

- [ ] **Step 1: Write the checks:**
  - **logging from Train:** Logga sport → Alpin skidåkning → Tid 90 min → Spara. Then:
    - Train's week strip shows today done;
    - Kalender's list shows "Alpin skidåkning" with "1 h 30 min";
    - Framsteg's volume numbers are unchanged;
  - **logging from a planned day:** the planned Monday's day sheet → "Gjorde en sport i stället" → save. Plan status counts the week as fulfilled.
- [ ] **Step 2: Run** the full verification with `--phase p6`. Expected: all PASS.
- [ ] **Step 3: Commit** with `test(verify): P6 checks; docs`. Open PR P6.
