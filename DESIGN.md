---
name: Gain Train
description: Quiet — a calm light-grey ground, white cards and one blue accent, in light and dark themes.
colors:
  ground: "#f4f5f7"
  ground-dark: "#0f1115"
  surface: "#ffffff"
  surface-dark: "#181b21"
  surface-2: "#f0f2f5"
  surface-2-dark: "#22262e"
  line: "#e6e8ec"
  line-dark: "#2a2f38"
  line-strong: "#dde1e7"
  line-strong-dark: "#343a45"
  ink: "#14161a"
  ink-dark: "#f2f4f7"
  ink-2: "#5b6270"
  ink-2-dark: "#a3acba"
  ink-3: "#8a93a3"
  ink-3-dark: "#7d8696"
  accent: "#2f5bea"
  accent-dark: "#7c9bff"
  accent-soft: "#eef3ff"
  accent-soft-dark: "#1c2540"
  done: "#1e7a4c"
  done-dark: "#3cc985"
  done-soft: "#eef7f2"
  done-soft-dark: "#13261d"
  warm-up: "#8a5300"
  warm-up-bg: "#fff1db"
  cool-down: "#1f4f9e"
  cool-down-bg: "#e4eeff"
  danger: "#b42318"
  danger-dark: "#ff8a80"
  danger-bg: "#fdecec"
  danger-bg-dark: "#3a1715"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  scale:
    fontSize: "12 / 13 / 15 / 17 / 20 / 28px"
    fontWeight: "400 / 600 / 700"
  set-value:
    fontSize: "17px"
    fontWeight: 600
rounded:
  input: "10px"
  button: "12px"
  card: "18px"
  sheet: "22px"
  theme-switch: "28px"
  chip: "50px"
spacing:
  scale: "4 / 8 / 12 / 16 / 24 / 32px"
  narrow-phone-gutter: "12px"
  phone-gutter: "18px"
  desktop-gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "48px"
  set-field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    height: "44px"
  exercise-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 8px 8px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  set-drag-handle:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.input}"
    height: "44px"
---

# Design System: Gain Train

## Overview

**Creative North Star: "Quiet"**

Gain Train should feel calm and uncluttered: a light-grey ground, white cards, one blue accent and nothing that is not needed right now. Rare actions sit behind sheets instead of on the card. The owner chose this look on 28 October 2026, replacing the original palette restored on 9 October; the [workout screen design](docs/superpowers/specs/2026-10-28-workout-screen-design.md) holds the reasoning. The fixed bottom navigation, day/night switch and the identity assets stay. On the same day the look reached every page: four tabs (Train, History, Progress, Library), a top bar on each page in place of the global header, and grouped lists; the [app pages design](docs/superpowers/specs/2026-10-28-app-pages-design.md) holds the reasoning.

The identity assets come from [repository commit 3d2514862f7babecb964eb01b09230d804b86e77](https://github.com/antonj997/gain-train-pwa/tree/3d2514862f7babecb964eb01b09230d804b86e77): `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable.png`, `public/apple-touch-icon.png` and `public/favicon.ico`. That commit's 512px and maskable PNGs were corrupted, so on 27 October 2026 both were re-rendered from its `icon.svg` (the maskable glyph slightly smaller to sit inside the safe zone). The supplied `public/icon-license.txt` credits Lucide/Feather contributors. Preserve these assets and their license.

Implementation sources: `src/styles/tokens.css` (every colour, type size, space, radius and motion token), `src/styles/components.css` (buttons, icon button, card, banner, segmented control, switch, dashed add button), `src/styles/pages.css` (top bar, lists and rows, the Train week card, Settings, History, Progress, Library and the training plan), `src/styles/workout.css` (the workout screen, its sheets and the reorder handle) and `src/index.css` with `src/styles/usability.css` for the other screens, with the profile, history-calendar and progress-summary stylesheets, and `src/styles/reset.css` and `src/styles/primitives.css` (base reset, dialog and sheet shell) loading first. The older variables (`--blue`, `--ink`, `--soft`, `--line`, `--surface`, `--background`) are defined in terms of the tokens, so every screen follows the palette. Colours come only through the tokens.

**Key Characteristics:**

- One blue accent on a light or dark neutral ground.
- Flat white cards with hairline borders; shadows only on sheets, the rest bar and the next-set chip.
- Tap what you want to change: a badge, a column heading or ⋯ opens a bottom sheet.
- 44px targets everywhere, tabular numerals, no web fonts.

## Colors

Accent blue identifies actions, links, selected navigation, column headings that open a sheet and the next set. Green marks checked rows and the done control; amber (warm-up) and soft blue (cool-down) tint their set badges; danger red is for destructive actions and field errors. Each token has a light and a dark value (see the frontmatter and `tokens.css`, which is the source of truth) and every text pair meets WCAG AA. `ink-3` is 3.1:1 on white, so it is for disabled controls, icons and separators only; readable muted text (Previous, “Last: …”, hints, headings) uses `ink-2`.

Light mode is a cool light-grey ground with white surfaces; dark mode is a near-black ground with raised dark surfaces and a lighter blue. The theme follows the phone until chosen in Settings. There are no gradients: the Home resume card is a flat surface with an accent border.

## Typography

The system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`); no web font is downloaded. Sizes are 12 / 13 / 15 / 17 / 20 / 28px and weights 400 / 600 / 700; the base body is 16px with a 1.5 line height. Every number uses tabular figures, so set values, timers and results line up. Set values are 17px at weight 600.

## Layout

The app is phone-first with an 800px maximum shell width. At widths up to 479px, main content, the header and the sync line use 12px horizontal gutters, increased where a device safe-area inset requires it. Empty-state cards use 16px horizontal interior padding at these widths. Main content retains 18px gutters from 480px through 639px, then 36px at 640px. The 116px bottom reservation keeps the fixed navigation clear. The workout screen hides the navigation and instead reserves room for the rest bar and for an open Set sheet, so the last row can still be centred above it.

Below 360px, metric grids adapt to the available width and set rows hide the Previous column (the Set sheet still shows it), so rows never scroll sideways.

The original stack gap is 24px; Home, History and Progress use compact 14px page gaps. Every page starts with its top bar. Fixed controls and the top bar account for safe areas. Sheets use the visual viewport to fit above the keyboard; floating controls and the navigation hide while the keyboard is open.

A set is one grid line, every control 44px tall: badge, previous result (takes the remaining width and wraps rather than truncates), load (52px), count (48px) and done (a routine's planned set has badge, load and count; a drop has no done cell). The top bar is the only fixed element on the workout screen. The Set sheet is only as tall as its content (it scrolls inside beyond 70% of the viewport) and the page scrolls so the edited row sits midway between the top bar and the sheet. Profile's input and save button stack below 380px.

The exercise picker is a full-height sheet below 640px (the visual viewport minus 32px and the top safe area) and a centred panel up to 480px wide and 760px high from 640px up. A flexible, independently scrolling result list reserves room for search and footer actions; the dialog retains a scroll fallback when space is scarce. The description hides during focused mobile search. History's inline calendar uses seven equal columns. Detailed day controls are at least 44px high; Simple uses 12px squares in 32px rows, increased to 36px on coarse pointers, with 2px row gaps and 8px card padding. Its two icon toggles are 44px square on one line; compact From/To buttons share two columns. Date ranges have no horizontal cell gaps and use joined top/bottom borders, an accent tint and rounded visible segment ends.

## Elevation & Depth

Cards are flat: neutral surface contrast and a one-pixel border. Only sheets, the rest bar and the next-set chip have shadows (translucent neutrals that read the same in both themes), plus the original day/night switch's inset track, raised orb and sun/horizon glow. A sheet dims the page by about 38%; the Set sheet dims it by about 8% so the card stays readable. No gradients and no general card-shadow system.

## Shapes

Inputs, badges, small buttons and the done control are 10px; buttons are 12px; cards are 18px; a sheet's top corners are 22px. Chips are pill-shaped. The theme switch keeps its 28px track radius and circular orb. The shared `--radius` token is 1rem.

## Components

- **Buttons:** Button (primary accent with white text, secondary surface with a strong line border, quiet accent text, danger tinted) is 48px high, or 40px with `.btn-sm`, which keeps a 44px hit area through an invisible extension. IconButton is 44px. Text actions use accent blue. Hover darkens primary blue or applies a soft tint. Bordered controls keep a 3px accent keyboard-focus outline with a 3px offset. Borderless text actions, Back links and navigation use an underline with a 4px offset; icon buttons use accent colour and a heavier SVG stroke (3px) without an outline.
- **Cards:** flat surfaces with a hairline border and 18px corners; the exercise card, Library routine cards and the Train resume card share them. The resume card of a running workout has a 2px accent border that turns slowly (a `conic-gradient` on an animated `@property` angle) and a pulsing live dot; a past workout keeps the plain accent border, and with reduced motion or no `@property` support the border is static. Warnings, Banner and save-state messages reuse the same surfaces, ink and borders. Banner is one component for save errors, “changed in another tab or device” (Load latest / Keep mine) and sync notices, under the top bar.
- **Inputs:** set values are 44px single-line `type="text"` fields on `surface-2`, centred, with decimal keyboards for kg and numeric keyboards for reps/seconds. Set and routine-plan inputs select their existing value on focus and repeated click; selection uses white text on the accent. Custom pointer capture bounds selection within the field and prevents native selection dragging from requesting page auto-scroll. Handle-only reordering and scrolling that starts outside the field remain separate. Keyboard copy, select-all and browser find shortcuts remain available. This behavior has automated coverage; native browser gestures have not been verified. Incomplete raw input stays in local editor recovery until corrected, with actual validation visible; blank unfinished fields omit the two empty-value prompts. Other fields are rounded, bordered and on the ground colour, with 16px base text, and keep the single custom select arrow. A set that differs from the exercise's load shows its marker inside the field and the value sits against it (“+10”, “−25”, “40 kg”); plain bodyweight is the text “BW”, not a field.
- **Navigation:** four tabs, fixed and centred within the shell, with muted labels and icons: Train (Dumbbell), History, Progress (TrendingUp) and Library. The active destination uses accent text on a transparent background. Menus and exercise actions are borderless. Auth uses an inline Back link; phone-only logging remains available without a separate Continue on phone button. The workout screen hides it.
- **Workout:** a sticky top bar (back, the name that opens Workout details, one status line, Finish or Save) over exercise cards and a dashed “+ Add exercise” button; with no exercises there is one large “Add your first exercise”. A card has the exercise name, “Last: 19 Oct”, ⋯, accent column headings with a chevron (Set · Previous · load · count · Done) and the set lines. Badges number working sets 1, 2, 3… (drops are not counted); warm-up shows W in amber, cool-down C in soft blue and a drop ↓ with no number. The next set has an accent border; a checked row is tinted `done-soft`, its values are read-only and an input attempt shows “Uncheck this set to edit its values.” in danger red and highlights that row's ✓. Drops have no ✓ and take their set's state. The load heading shows the exercise default (kg, BW, +kg, Assist) and the count heading Reps, Sec or Reps/sec. Add set copies the last non-drop set. The next-set chip (“Next set ↓”) floats bottom centre only while that row is off screen; tapping it scrolls the row to the centre. The rest bar floats there too (time left, +30 s, Skip; then “Rest done” and Dismiss). Drag handles show a grip and index, use accent tint while moving and keep visible keyboard focus; Space/Enter grabs and drops, arrows move, Escape cancels the move while keeping the sheet open, and dragging auto-scrolls the nearest scrollable container. The same sorter serves routine planning. Historical edits retain Save/Discard. Removed in the redesign: the “Edit sets” switch, compact mode, the per-row type select and remove button, the top-bar Abandon, the footer and the “Go to active set” link.
- **Sheets:** every dialog is a bottom sheet on phones (22px top corners, a handle that closes it, a tap outside or Escape) and a centred panel at most 480px wide from 640px up. The workout sheets: Set (type, load for this set, Add drop, Delete set; it dims the page only lightly), Load and count (with the “Applies to the sets you haven't checked yet.” note and a Done button), ⋯ (a menu list), Reorder sets, Finish (summary, “Save as a routine”, Save workout, Keep logging, then the danger Abandon workout) and Workout details. Confirmations, the exercise picker (full height), History details, the History date picker, the routine and exercise editors and account deletion use the same Sheet. The long routine and plan editors keep Save in a `.sheet-footer` stuck to the sheet's bottom edge (top hairline, surface fill, safe-area padding, 44px button); the sheet itself already rides above the keyboard. Changes in a sheet apply immediately. Segmented controls use radio-group semantics; Switch uses `role="switch"` with `aria-checked`.
- **Profile and BW:** Settings includes a Profile card with decimal bodyweight in kg, a save action, inline validation and truthful local/pending/synced/error status. A registered BW value appears with the small “kg BW” label next to “BW”; absent values show “BW” only. Bodyweight exercises offer an “Add extra weight” switch in the Load and count sheet; the load heading then reads “+kg” and the value shows the “+” marker. Completed BW sets retain their captured bodyweight after a profile change. The added load never replaces that snapshot.
- **History:** show one calendar/date controller followed by workouts, defaulting to the current month. Two icon-only buttons replace segmented mode controls: a calendar with connected start/end markers offers From/To selection and a plain calendar offers return to month; CalendarDays/Grid3X3 show detailed/simple. Keep pressed states, descriptive titles and accessible labels. Detailed retains the Monday-first grid, completed-day dots, blue today border and solid-blue single-day selection. Simple shows one compact square per actual day with full accessible date/workout-count labels. Date ranges appear as one joined tinted band per visible row, with continuous top/bottom borders and only segment ends rounded. Month/year selects and previous/next remain in the same controller. A single “Show current month” footer action is absent when already at the default period; the small legend reads “Workout day”. Month mode supports a selected day; range chooses inclusive From/To bounds across months. Browsing preserves bounds; future dates are disabled. History has no statistics, “More periods” or second date picker. Workout details list only checked sets; a drop appears as a muted “↳ 80 kg × 4” on the value side under its set. The calendar sits in a card under the title (Simple by default) and the workouts follow in week groups of `.list` rows with a chevron; a row that set a best estimate shows a warm “New best” badge.
- **Progress:** a 4 weeks / 3 months / Year `Segmented` drives a 2×2 grid of tiles (workouts per week over finished weeks only, working sets, volume, time trained), each with its change against the previous period (↑ in the done colour, → muted). Recent bests are up to four cards with the exercise as a warm badge. The exercise list shows name, “Best … · N sessions” and a 64×28 accent sparkline (`aria-hidden`); a row opens the exercise detail in a sheet.
- **Top bar and lists:** `PageHeader` is a muted 13px eyebrow over a 28px bold title, with an optional leading back button or trailing icon button; the sync, sign-in and conflict notices render as `.banner` under it. Groups are a 13px semibold `ink-2` title over a `.list` (18px corners, hairline separators); rows are at least 56px with a title, a muted second line, an optional value and a chevron. Settings, plans and goals use rows and cards that open sheets.
- **Train:** the title rotates through about 25 short lines. The This week card has Monday-to-Sunday dots (done-coloured when a workout was logged, an accent ring for today), a chip and a muted totals line. Start a routine rows end in a round accent-soft play button.
- **Library:** a `Segmented` Routines | Exercises | Plan under the title, kept in the URL. Routine cards have the name, a muted summary, the exercise names, a Start and an Edit button and a ⋯ icon button that opens a sheet. A dashed `btn-dashed` button adds a routine or exercise. Exercises has a search field, pill filter chips and Recently used / A–Z groups; custom rows carry a “Yours” chip and open an editor sheet.
- **Plan tab and goals:** the Plan tab is a Plans list (name, period and cycle, a status value), a dashed “New plan”, a Groups list and a dashed “New group”. Plans and groups edit in `size="full"` sheets. The plan template is seven 48px day buttons per week (a muted “Week n” caption above each when the cycle is longer than one): a set day is accent-soft with accent text, Rest is `surface-2`, an empty day is a plain outline. A day opens a choice sheet (Use the template for dates, Nothing planned, Rest, Day types, Groups, Routines) with a check on the current one. The Upcoming month grid reuses the History calendar's day cells with a marker under the date (accent dot planned, ring for rest, accent-soft background for a dated change). Overlap errors use `field-error`. On Train, “Today: <name>” is a card (a small Start, or Start with suggestions) followed by a group's routines as rows; planned days are rings in the week strip and This week has a Plan text link. Progress → Goals is a section head with a “+ Add goal” text link above a card per goal: title, a date chip (done-coloured “Reached”), an 8px bar (accent, done colour when met), “Now … · Target …” and days left.
- **Sharing:** Library → Exercises has a fifth pill chip, Shared. Its rows reuse `.exercise-row`: name, a muted “category · equipment” line and a 44px bordered Add button; there is no star or ⋯. Signed out or offline, a muted `.empty` note replaces the list. A custom exercise's ⋯ sheet adds a secondary button (Share2 icon): Share to library, Stop sharing or, signed out, a link “Sign in to share”. A shared exercise carries a small “Shared” stat chip next to “Yours”.
- **Exercise search:** search and clear controls, category chips and footer actions keep their styles inside a full-height sheet. Clearing returns focus to the search input. Use the responsive result-list scrolling described in Layout.
- **Theme switch:** retain the original day/night orb, horizon and decorative night stars. Decorative stars remain hidden from assistive technology.
- **Feedback:** top, mobile-wide toasts use the current surface, ink and border. The next set has an accent border and green marks the checked state. A check settles over the 180ms motion token (150–200ms ease-out for every transition); the theme transition takes 650ms. Reduced motion removes all of it. Timers and haptics remain opt-in.

## Do's and Don'ts

- **Do** take every colour from `tokens.css`, and keep `ink-3` for disabled controls, icons and separators.
- **Do** keep the navigation, theme switch and identity assets, and give every page a top bar.
- **Do** put rarely used controls in a sheet and keep the card to the values, ✓ and one-tap headings.
- **Do** keep targets at 44px, tabular numerals and motion of 150–200ms.
- **Do** retain clear save status, planned-routine fields and readable completed data.
- **Do** write every visible string, aria-label and toast through `t()` from `src/i18n`, and check new copy in Swedish at 360px: its words run longer (Uppvärmning, Nedvarvning, Assisterad), so segmented controls, chips and buttons must fit or wrap, never scroll sideways. Swedish copy is casual du-form: pass, set, rutin, övning, vila, uppvärmning.
- **Don't** add gradients, a general card shadow, web fonts or a second accent colour.
- **Don't** bring back the “Edit sets” mode, compact rows, per-row type selects or remove buttons, or the top-bar Abandon.
- **Don't** reintroduce the Training Ledger palette, flattened exercise layout or restrained-corner redesign; the owner rejected that visual direction.
- **Don't** replace the identity assets or add a new visual identity without a new user request.
- **Don't** let any control hide real field errors or replace historical Save/Discard behavior.
