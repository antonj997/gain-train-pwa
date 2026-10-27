# Gain Train: creative direction review

Review and proposal only. No application code, settings, workout records, commits, pushes or deployments changed by this review. The sample names and sessions below are illustrative, not training advice or claims about the owner's progress.

## Verdict

Gain Train already has the right product skeleton: a small phone app, three labeled destinations, local saving, resumable drafts, real previous-set values, explicit set completion and repeatable routines. Keep that. Its visual identity is competent but interchangeable: dark navy, electric blue, a stock dumbbell, soft rounded boxes, and the same card treatment for actions, exercises, history and statistics. The most authored control is the sun/moon theme switch. Bring comparable care into entering and completing a set, which is the product's defining interaction.

The largest opportunity is not a new dashboard. It is a more satisfying training ledger: open it, identify the next exercise, read the last performance, enter the actual result, check it, and put the phone down. A lifter should recognize that rhythm in the first screen.

## Evidence and boundaries

- Read Home, Layout, SetRow, ActiveWorkout, History, Progress, model/analytics, App, ThemeContext, CSS, README and the icon asset.
- Personally inspected the live dark Home, a populated QA Active Workout, History, Progress and expanded Progress details at localhost. Those records were created by the functional reviewer; I only read them.
- Visually inspected the UX reviewer's 390 px dark Home, populated Active Workout, exercise options, History, Progress and expanded Progress captures, plus light Home, Active Workout, History and Progress. Shared local review records were changing while the reviewers worked, so screenshot values are snapshots of disposable review data.
- Impeccable context and its Operate, critique and new-work references informed this independent creative pass. No PRODUCT.md or DESIGN.md exists. This report is a proposal, not an approved replacement design system, a complete technical accessibility audit or an implementation.
- This pass cannot prove sweaty-hand ergonomics, glare performance, haptics, mobile keyboard behavior or whether a lifter prefers the proposed visual identity. A short real-phone session should decide those points.

## The priorities the screenshots reveal

1. **The active workout spends too much of the first screen on administration.** At 390 px, the brand header, sync line, workout heading, centered Abandon command and Workout details disclosure push Bench Press's first input roughly halfway down the screen. Put the exercise sooner while preserving a directly reachable abandon action.
2. **The set row gives frequent and rare actions similar visual weight.** Every row combines inputs, check, remove, previous-value copy and a Working set label. A three-set exercise becomes a stack of repeated metadata. The 32 px remove column also consumes width that could serve the numeric inputs and 48 px completion target.
3. **Home promotes starting another workout over resuming the current one.** The draft has a quiet outlined box while Start workout is the broad saturated button. When a draft exists, Resume should be the leading action. Keep starting another session available.
4. **History makes a report precede the log.** Period picker, date range, three metric cards and a comparison disclosure appear before the first workout. This is costly on a phone. Make finding a session the first task; put aggregate interpretation behind a named Summary disclosure.
5. **Progress repeats a large card for a small amount of information.** The current strongest content is the actual set, such as 50 kg × 8 or BW × 6. Let that lead a compact exercise row. A generic first-session encouragement does not need its own line in every card. Details can contain estimates, charts and the exact session ledger.

## Three viable art directions

| Direction | Visual world | Signature behavior | Benefit and tradeoff |
| --- | --- | --- | --- |
| **Training Ledger — recommended** | Warm bone paper, green graphite ink, clay actions, crisp horizontal rules, 8 px control corners. A tuned system sans with large tabular set numbers. | The next set has a narrow clay margin mark; checking it leaves a clean, readable completed entry and advances that mark without moving the user's screen. | Distinctive through composition and rhythm, calm in both themes, minimal asset or runtime work. Thin rules must remain visible and tactile cues must not become ornamental paper textures. |
| **Rack Instrument** | Near-black #121714, dark surface #1E2821, ivory #EEF2E9, signal lime #C1E766, muted sage #A6B3A7. 6 px corners, labels in system sans, tabular numerals. | A precise completion key and small literal set counter make the log feel like reliable gym equipment. | Strong visibility in a dim gym and a decisive action color. Lime/black is familiar in fitness, so the distinctive layout must carry the identity; a convincing light theme takes more care. |
| **Club Programme** | Clear white #FAFAF6, ink #15243A, vermilion #BA3E2D, a bold condensed masthead and large numbered routine list separated by rules. Controls and data stay in a familiar sans. | Routines read like a printed training programme; sessions finish with a crisp dated record. | More expressive and sporting, especially on Home and History. Long exercise names and large text can overpower the working screen; it would need firm restraint in Active Workout. |

Choose Training Ledger. Rack Instrument is the fallback if the owner explicitly wants a darker, harder gym feel. Club Programme is useful inspiration for the brand masthead, but less persuasive as the whole operating interface.

## Recommended system: Training Ledger

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| Background | #F4F1E9 | #171C18 | App plane |
| Surface | #FFFCF5 | #202721 | Inputs and bounded overlays |
| Ink | #20231F | #F4F1E9 | Main text and numbers |
| Secondary text | #656A60 | #ADB5AA | Dates and prior reference |
| Rule | #C9CCBF | #434B43 | Grouping and structure |
| Input boundary | #80877D | #737E74 | Stronger than decorative grouping rules |
| Action | #A83D1A | #EF9A67 | Leading action, active selection and focus |
| Action text | #FFF7EE | #171C18 | Solid buttons |
| Completed | #246448 | #9DBCA3 | Check and status text |

Calculated contrast for these exact solid pairs: main text/background 14.08:1 light and 15.30:1 dark; secondary text/background 4.92:1 and 8.20:1; action text/action 5.91:1 and 7.80:1. These pair checks are not a whole-interface accessibility pass. Focus borders, rule contrast, disabled states and all rendered combinations still need checking.

Use one familiar sans throughout the working UI: system UI is already available and keeps the PWA fast. Set `font-variant-numeric: tabular-nums` for weights, reps, duration and counters. Brand 22 px/750; page title 26 px/700; exercise title 20 px/700; set values 22 px/650; body 16 px; secondary 14 px; compact column labels 13 px. Restrict uppercase to occasional 12 px identifiers, not every exercise/section label. If the brand later needs more personality, trial one self-hosted condensed heading face; do not impose it on inputs or buttons.

Use a 4 px spacing unit, 16 px phone gutters, 24 px between exercise groups, 12 px inside grouping, and 48–52 px controls. At 390 px, prefer full-width rows over card-within-card nesting. Surfaces should be structurally different because they do different jobs: Home has one dominant action area, Active is a ledger, History is chronology, Progress is a comparable-performance list. Light mode is warm without simulated paper grain; dark mode is green graphite without glow or gradients. The incumbent light screenshots expose how pale card/input outlines blend together; grouping rules can be quiet, but editable-field boundaries must use the stronger token.

## Home: a launch point with memory

First screen order: compact Gain Train header and settings; brief saved-on-phone status; localized date; **Workout** heading; the current draft or the start action; routines; one previous-session entry. Replace the motivational headline with a task title. The date is useful context and should not consume its own tall hero.

With a draft, make **Resume Upper A** the 52 px solid action and display a small factual line immediately above it, such as `In progress · 6 of 12 sets`. Keep Start a new workout as a quiet 48 px secondary action and Log a past workout as a simple visible row. With no draft, Start workout is the solid leading action. With multiple drafts, show the most recent first and expose the others as a short labeled list; never silently hide or discard them.

Render routines as a list on the app plane, with a rule between rows: name, exercise count, and a concise exercise preview when it fits. Example: `Upper A` then `Bench Press · Row · Press · 4 exercises`. A right-aligned Play icon reinforces the existing instant-start behavior. This preserves one-tap routine launch; it does not add a confirmation that makes the common path slower. Manage remains adjacent to the section heading.

The last workout becomes a single dated log entry with real set count and optional duration. Avoid summary tiles, streaks, points, random quotations or a decorative trend line. Starting and resuming are the entire purpose of this screen.

## Active Workout: the signature screen

**Toolbar.** Use one compact contextual workout header: back/save-and-leave, workout name, and an explicit Workout options affordance. The saved-on-phone state sits directly beneath the name. Preserve **Abandon workout** before finish: either visible as a quiet top-toolbar text action where width permits, or as the first plainly labeled item in the one-tap Workout options menu. Do not place it behind a submenu or only after completion. Keep its existing confirmation and immediate Undo. Workout details is a compact adjacent disclosure for name/date/duration. Settings remains available through the contextual controls.

**Exercise heading.** Show `Bench Press` and a compact load label once. The set count can appear as `1 of 3 completed`. Remove the oversized outer exercise card; a strong rule and 24 px gap separate exercises. Preserve the familiar exercise options menu, including up/down ordering. Do not substitute drag-only ordering.

**Set columns.** Set index, kg or explicit Assist kg, reps, and a 48–52 px completion key. Moving Remove set into explicit set options can recover width; offer an accessible menu for every row and immediate Undo. No gesture is the sole deletion path. Bodyweight shows a stable `BW` token where weight would be, with a genuine editable reps input. Warm-up and Cool-down get a small readable type label; Working set is the default and does not need repeating on every row.

**Previous reference.** Keep previous data visible, but format it as `Last · 50 kg × 8 · 5 Oct` rather than vague background copy. When no prior log exists, say that once under the exercise name. In an exercise with several different prior sets, retain a row-specific hint in a smaller subline; do not compress it into a third tiny data column on a narrow phone. A future Use last affordance must only act on comparable prior sets, be optional, and remain unchecked until the lifter confirms the actual result.

**Data prerequisite.** Today's previous hint matches the last exercise's sets by array index, without confirming load type or section. Keep it a prior-log reference until matching is made explicit. Warm-up, working, bodyweight and assisted values must never be visually presented as equivalent targets. The app already copies prior values into new sets; distinguish supplied values from completed work through the unchecked completion state.

**Next set.** Mark the first unfinished row with a narrow clay left rule and the word `Next` only when it is useful. Focusing another row moves this cue; it is a helper, not an enforced sequence, so supersets and reordered exercise work remain possible. Keep native numeric inputs, their familiar keyboard and explicit validation. All values remain readable. The current row gets the strongest input border; pending rows remain recognizably editable.

**Check and retain.** A press gives immediate visual feedback. The check settles in 120–160 ms and the margin cue moves to the next row. Preserve the completed numbers at full text contrast, with a check/status label as well as color. Do not fade the whole row, spring it offscreen, auto-collapse the exercise or forcibly advance keyboard focus. Only reveal the next row by scrolling when the user explicitly requests Next and it is below the viewport. Editing an active-session checked value currently resets completion; surface `Edited · check to confirm` so this transition is understandable.

**Footer.** Keep the fixed footer and safe-area handling: a literal count such as `6 / 12 sets`, plus Finish workout. Finish gains the leading visual treatment once all planned sets are checked, as it does today. A count or a small thin count-derived rule is enough; no circular dashboard gauge. While the keyboard is open, keep completion in the row rather than adding a second floating control that may cover inputs.

**Optional rest rhythm.** Only after the ledger works, consider an opt-in compact rest strip that starts after a completed set and offers Skip/+30 s. It must preserve its end time across background/reload and show a quiet elapsed state. This is a new feature with extra behavior to test, not a prerequisite for the design refresh. No vibration-only or animated-only state.

## Completion: satisfaction through certainty

Keep the clear incomplete-set warning. List the unfinished count and offer Return to workout versus Finish with completed sets. Unchecked entries are not discarded invisibly. Keep the empty-workout protection.

After actual local save, show a simple dated session record: workout name, actual completed set count, duration only when recorded, and `Saved on this phone`. Retain the ability to save a routine and review the resulting History entry. This should feel like closing a notebook: one short state transition and a definite receipt of work, without confetti, medals or applause copy.

Top-center, mobile-wide toasts are an explicit product requirement and already exist. Keep their placement and safe-area offsets. Use short factual success text; keep Undo readable and operable. Saving/sync failures need a persistent inline state in addition to any toast. Local save and cloud sync must remain separate claims.

## History: chronology before interpretation

Keep the existing localized week grouping and period picker, but make the chosen period a compact labeled control in the page header. Immediately show the dated workout list. Each row has a narrow date column, name, then factual exercise/set count and optional duration; a rule separates rows. Use consistent localized dates such as `8 Oct` in visible text and full dates in accessible labels, rather than mixing localized Home with raw ISO strings in secondary UI.

Move the three aggregate metrics and their comparison explanation into **Period summary** after the first session rows or behind a disclosure. Workouts/week's current definition counts active weeks; label that exactly or reconsider the metric before presenting it as overall consistency. `Exercises improving` depends on comparability and a changing eligible set of exercises. It should not be the main emotional verdict on the log.

A workout detail opens with its actual exercise/set ledger, Repeat workout and Edit. Keep Repeat as the strongest action. Preserve Delete and Undo. A tall history detail should feel like a readable session record; use a phone sheet or full-height detail presentation only if close/back, focus return and keyboard handling remain reliable.

## Progress: answer what changed

Keep the separate Progress destination and exercise search. Its first screen should be a compact list of recently trained exercises, with `Bench Press`, `50 kg × 8`, and the last date. Show a direct prior result only when comparable. When a matching prior result exists, an example line is `Previously 50 kg × 7 · 5 Oct`; use a plain `+1 rep at 50 kg` only when that statement is literally supported. Label the represented result **Best working set**, since the current analytics picks a best set per session; it is not the entire workout.

Tap an exercise to reveal the exact session list first, then a chart of the selected comparable metric. Keep existing estimation limits: weighted working sets of 1–10 reps for estimated strength; bodyweight/assisted comparisons explicitly state their load condition. `Estimated 1RM` must be labeled as an estimate, distinct from a recorded lift. Do not merge kg, assisted kg and bodyweight reps into one strength score. Do not add red/green judgment to every fluctuation.

Retain the actual line chart where it answers a question. Name the axis and measure, avoid an automatically cropped y-axis that visually exaggerates small changes, and provide the session values in text. The observed dark detail capture showed 65.0 to 63.3 kg estimated strength spanning nearly the full chart height, with both x-axis labels reading 10-08. Separate same-day sessions with an ordinal or time where recorded; choose an explicit useful domain rather than suggesting a dramatic collapse. One meaningful chart in exercise detail is useful; a decorative sparkline on every Home routine is not.

For first sessions, use `First working set logged · 8 Oct`. With no comparable prior result, say `No comparable previous session`. Do not invent zero, a percentage gain, a record badge or a rising line.

## Motion, accessibility and sensory detail

- Most motion should be 120–200 ms and express a changed state. There is no page-entry choreography.
- Completion feedback can use a tiny check settling motion and a narrow active marker. Reduced motion uses an immediate state change. No bounce, flash or forced focus movement.
- Where vibration is available and the user enables it, one restrained tick on set completion is enough. Visual/text feedback works identically without it. Do not promise universal PWA haptics.
- Keep 48 px targets in the high-frequency row and at least 44 px elsewhere. Never make compact appearance depend on compact hit areas.
- Use color plus check/text for state; high-contrast numerals, durable focus indicators, semantic controls and accessible input names. Do not speak every character typed through a live region.
- Accommodate larger text, 320 px widths, long custom exercise names, missing duration and decimal weights. Density is earned by deleting duplicated information, not by shrinking labels.
- Preserve the current viewport/keyboard-aware dialogs, safe areas, offline-first local persistence and undo mechanisms. They are foundational product behavior.
- The existing theme switch has character and a reduced-motion fallback. Keep its intent; direct the next design investment toward set completion. A 650 ms theme change is low-frequency, while logging feedback must be much faster.

## Empty and error states

**First Home:** `Start a workout`, plus a short optional `Or create a routine` row. Do not make the routine empty card the largest element. **Empty active workout:** `Add exercises` is the direct action, with one line explaining prior-value reuse. **Empty History:** distinguish no history from no workouts in the chosen period; the latter offers Change period. **Empty Progress:** explain that the first completed working sets create the list and a comparable next session creates a comparison.

**Invalid row:** associate the useful instruction with the field: `Enter whole reps greater than 0`; do not rely on an unexplained dim check. **Save failure:** keep the draft visible and the values unchanged, show `Not saved on this phone` with retry/recovery context. **Offline:** `Saved on this phone · sync pending` is calm and truthful. **Conflict:** keep the actionable review link; avoid a celebratory Synced state while choices remain. **Missing workout:** provide a real return path, as the app does.

## What to preserve and change

Preserve Gain Train's name, three labeled bottom destinations, familiar dumbbell recognition, phone-local trust language, offline persistence, prior-value reuse, routines, bodyweight/assisted distinction, explicit completion, incomplete-finish warning, mobile-wide top toasts, abandon-before-finish, Undo, keyboard-aware dialogs and theme preference.

Change hierarchy before brand: stronger Resume, earlier exercise rows, less repeated Working set/No previous set copy, quieter administration, session list before aggregate metrics, and a more honest best-working-set Progress label. Replace broad rounded-card repetition with rules and distinct structural surfaces. Drop the decorative gradient on Resume; its importance should come from the action and its position.

The current home-screen icon is a recognized dumbbell against a blue night gradient. Keep it initially. After the direction is approved, simplify it into a flat ink/bone field with one clay detail and retain a safe maskable silhouette. A bespoke typographic wordmark can later give Gain Train identity without introducing a mascot or literal locomotive imagery.

## Incremental sequence

1. **Hierarchy and copy:** promote Resume, compact the active toolbar while retaining obvious Abandon, reduce repeated set metadata, label Progress's best-set truth, move History summary below the log. Existing records/routes/data remain usable.
2. **Visual grammar:** introduce the palette/type/spacing tokens, rules and 8 px controls across the three main screens. Keep the existing icon and theme control until the system proves itself. This phase is mostly CSS and markup, with no charting-library or animation dependency.
3. **Set-state craft:** implement next-row helper, clear edited/unchecked feedback, safe removal/Undo and lightweight completion feedback. Validate numeric keyboard, focus return, partial finishes, reload, offline save and accessible states on a real phone.
4. **Selective detail:** improve Progress's comparable session detail and chart semantics; refine the completion record. Add the optional rest timer only if actual usage warrants it. Refresh the icon/wordmark last.

The first meaningful prototype should be a 390 px active workout with three exercises, warm-up/working/bodyweight/assisted examples, long names, and both complete and incomplete sets—not a polished empty Home. Evaluate it one-handed during a real lifting session before rolling the design across every screen.
