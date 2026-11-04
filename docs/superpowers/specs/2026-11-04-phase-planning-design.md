# Phase planning: deload weeks and progression — design

Date: 4 November 2026 · Status: implemented (the owner asked for the proposal to be built directly, step 4 of his notes)

## The owner's question

He meant groups as a way to bundle routines for scheduling ("put routines in a *deload* group so you can drop it into a plan") and wondered whether that is too heavy. What he wants: planning a 1–6 month training phase should feel easy, routines can recur or develop through the phase, and he'd like to set a goal of raising one lift, or all of a routine's lifts, by some percentage and get a suggested weight increase and timeline, based on varied facts and what's reasonable, which he can then adjust.

## Decision

1. **A plan is a training phase.** We kept the object and its name (Plan / Schema) and changed what the editor leads with. It now opens with a name, a period (a start date and a **length of 4–26 weeks**, which sets the end to the Sunday of the last week, or any end date from the calendar) and the repeating cycle of 1–6 weeks. The sheet's subtitle reads "Phase · 12 weeks · 4 Nov – 24 Jan" ("Fas · 12 veckor · …"). Weeks count Monday to Sunday from the first day's week, the same count the template already used, so "week 3" and the template's third row always agree. A new phase, one whose dates change, or one with a progression can be at most 26 weeks. An older plan that is longer keeps working, and can still be edited as long as its dates stay the same.
2. **Week types instead of a deload group.** Each cycle week is Normal or **Deload** (a pill beside "Week n"). A deload week trains the *same routines*, prefilled lighter when you start them. The default follows common practice: **10 % lighter and half the working sets**, and both can be changed per plan (load: same, or 5–30 % lighter; sets kept: 40–100 %). Presets set the cycle in one tap: **3 + 1 deload** (a four-week cycle), **5 + 1 deload** (six weeks) and **No deload**. A preset copies week 1 into any new weeks, and "Copy week 1 to the other weeks" does the same later. This covers the case a "deload group" was meant for, with no group to build or keep up to date.
3. **Groups are demoted, not removed.** They still do the one thing only they can do: let a plan day offer a choice of routines ("Legday: Legs A or Legs B"). In Library → Plan they now sit folded under **Advanced**, with that one-line explanation. The day picker lists Routines first, then Day types, then Groups. Existing groups and plans keep working unchanged.
4. **Progression (optional, per plan): "Increase lifts over the phase".** Lifts can be added one at a time or as "All exercises in a routine". That adds every weighted exercise in the routine; cardio, timed and bodyweight-only exercises are skipped. Each row holds the reps, a start weight, a target (as a % increase or in kg), a level and any weeks typed over. The editor shows a table with one row per lift and one column per week (W1 82.5, W2 85 …), with deload weeks shaded. A lift opens its own sheet with the suggestion, the warning and the week-by-week list, where any week can be typed over.
5. **Using the plan.** Starting any routine on a date inside an active phase applies the plan to its prefill. A progressed lift gets that week's planned weight and reps on its working sets. In a deload week, the working sets are cut to the deload share (at least one set, and a dropped set takes its drops with it) and every other weighted working set and drop is made lighter, rounded to the exercise's step. Exercises the plan doesn't cover keep the normal "last time" prefill. The workout stores a small `plan` mark, so each card can show a muted line ("Plan week 3: 85 kg", "Deload week: 75 kg", "Deload week") that stays the same even if the plan is edited later. Repeating a workout drops the mark. Past workouts ("Log past") and blank workouts are not touched. Paused plans do nothing, as before.
6. **Train** shows "Week 3 of 12 · Deload" on today's plan row, where it used to say "From your plan". **Library → Plan** rows read "4 Nov – 24 Jan · Week 3 of 12 · 3 + 1 deload · 3 progressions", next to the status, so paused plans show as Paused as before.

Why not the alternatives: deload groups would have meant one extra object per kind of week and per routine (Legs-deload, Push-deload…), and they'd fall out of date whenever a routine changed. Setting routines by hand for every session fits one-off changes, which dated overrides already handle, but not 12 weeks of a slowly rising load. Week types plus one progression list covers "recur or develop through the phase" with two small additions to the plan.

## The suggestion: rates and sources

`suggestProgression({ exercise, startKg, reps, weeks, deloadWeeks, level, equipment, targetKg?, cycle?, trendKgPerWeek? })` in `src/lib/progression.ts` (pure, tested). It returns the reasonable weekly gain, the target that gain reaches by the phase's last week, whether the user's target is too fast, and how many weeks the target would take at the reasonable rate.

| Level | Rate per training week | Source |
| --- | --- | --- |
| Beginner | 2.5 kg upper-body barbell/machine, 5 kg lower body; dumbbells, kettlebells and added bodyweight 1 / 2 kg; falls linearly to half over 12 progression weeks | Rippetoe, *Starting Strength* 3rd ed.; Rippetoe & Baker, *Practical Programming for Strength Training* 3rd ed. (novice linear progression, per session; we use the weekly figure because two or three sessions a week of one lift aren't guaranteed) |
| Intermediate | 0.75 % of the load (the range is 0.5–1 %, or 2–4 % a month) | *Practical Programming* (intermediate); NSCA *Essentials of Strength Training and Conditioning* 4th ed. ch. 17 (the 2-for-2 rule); ACSM position stand "Progression Models in Resistance Training for Healthy Adults", MSSE 2009 (2–10 % jumps when the reps are met, smaller for trained lifters) |
| Experienced | 0.375 % of the load (the range is 0.25–0.5 %) | *Practical Programming* (advanced); Israetel, Hoffmann & Smith, *Scientific Principles of Strength Training* (2015) |

The rates also take into account:

- **Lower body**: Legs or Glutes as the main or another category, so Deadlift counts. This only changes beginner rates.
- **High reps** (more than 12) progress at three quarters of the rate.
- **The lift's own trend**: the slope of each session's heaviest working set over the last six weeks, the same least-squares helper the goals use. A "beginner" lift that has stalled doesn't get the beginner rate. It gets its trend instead, but never less than the intermediate rate. (In the smoke data, Romanian Deadlift had stayed at 70 kg for ten weeks and would otherwise have been planned to rise 50 %.)
- **Deload weeks** add nothing. Their planned weight is the week before, made lighter by the plan's deload load.
- **The cap**: no week adds more than 5 kg, or more than 5 % of the load (7.5 % for beginners).
- **Rounding to the equipment's step** (`loadIncrement`): barbell and Smith 2.5 kg; dumbbell 2 kg (1 kg under 10 kg); kettlebell 4 kg; machine, cable or band 2.5 kg (5 kg from 100 kg); added bodyweight 1.25 kg. Custom exercises use their equipment, or count as a barbell.
- **The level** comes from the log (`detectLevel`). It is beginner under six months or 24 workouts, experienced from two years and 150 workouts, and intermediate in between. The sheet says "From your log (2 months, 40 workouts): Beginner. Change it if you trained before."
- **The start weight** comes from history (`estimateStartLoad`). It is the heaviest checked working set done for at least the planned reps in the last four weeks. Without one, it's the best estimated one-rep max (Epley) converted to those reps and rounded down to the step. If the last four weeks are empty it looks back twelve, then falls back to the routine's planned weight, and finally asks the user to enter it. The sheet names the set it used ("From your log: 82.5 kg × 6 on 28 Oct"), with "Use it" when the field holds something else.
- **The warning**: a target that needs more than 1.2× the reasonable gain, and more than one step past the suggested target, or more than the weekly cap. It reads "That's faster than usual for your level — about 27 weeks is more realistic." "Use suggested timeline" then sets the target to the suggestion. The phase's length is shared by every lift, so it stays as it is.

The planned weeks (`plannedWeeks`) climb in equal steps from the start in week 1 to the target in the last training week, each rounded to the step and never past the target. A deload week holds the week before, made lighter. A typed week replaces only that week.

"**Also add as a goal**" (a switch in the lift's sheet, for 1–10 reps, as goals allow) creates an ordinary lift goal when the plan is saved: the exercise, the target × reps, due on the phase's last day. It is linked through the plan's `goalIds` and the row's `goalId`.

## Data and compatibility

The plan payload gains optional fields, validated on load. Unknown fields are kept, as before.

- `weekKinds?: string[]`: one entry per cycle week, `"deload"` or `"normal"`. Anything else, a missing entry or a list of the wrong length (an older app that changed the cycle) reads as normal (`weekKindsOf`).
- `deload?: { loadPct: 0–50, setsPct: 10–100 }`, defaulting to 10 / 50.
- `progression?: { exerciseId, name, reps, startKg, targetKg, level, overrides?: { "<week>": kg }, goalId? }[]` (at most 40). An unknown `level` reads as intermediate instead of refusing the plan. Typed weeks past a shortened phase are dropped on save.

The workout payload gains an optional `plan: { planId, week, weeks, deload?, loads?: { exerciseId: kg } }`.

None of these change what existing fields mean, so **SCHEMA_VERSION stays 2**. Older apps keep the new fields when they save, and they ignore them otherwise: a deload week trains as a normal week there. **No migration**: the server trigger (`20261029090000_plans_goals_library_cardio_sharing.sql`) checks only the plan's dates, cycle, template shape, overrides object and goal list, and the known workout fields. It allows extra keys on purpose.

## Code

- `src/lib/progression.ts`: rates, steps, `suggestProgression`, `plannedWeeks`, % ↔ kg.
- `src/data/phase.ts`: phase weeks, week kinds, presets, `progressionWeeks`, `planStartFor`, `applyPlanStart`, `keepWorkingSets`.
- `src/data/progression.ts`: `exerciseInfo`, `detectLevel`, `estimateStartLoad`, `recentTrend`, `defaultReps`, `newProgressionItem`.
- `withPlan()` in `src/data/start.ts`, called by `newWorkout()`. `planNote()` and the label helpers live in `src/lib/plan-note.ts`.
- UI: `PlanCycle`, `PlanProgression`, `ProgressionSheet`, and changes to `PlanEditor`, `PlanPeriodPicker`, `PlanTemplateGrid`, `CellSheet` and `PlanPanel`.
- Tests: `tests/progression.test.ts` and `tests/phase.test.ts`.
