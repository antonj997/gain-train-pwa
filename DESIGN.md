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

The exercise picker is a full-height sheet below 640px (the visual viewport minus 32px and the top safe area) and a centred panel up to 480px wide and 760px high from 640px up. The result list is the sheet's only scroller (the sheet itself does not scroll) and starts at the top for each new query or filter; rows size to their two lines. While searching (focused or a query), the title and description fold away (kept for screen readers), both chip rows fold away with a quick height and opacity ease (`--gt-motion`, 0ms under reduced motion) and a compact “Filter” chip with an accent count badge sits at the search row's right edge to bring them back; the footer hides until something is chosen, and “New exercise” becomes the last row, “Create “E”…”. The footer is slimmer and shows “Add N exercises” only once something is chosen. The sheet follows the visual viewport (`useVisualViewport`), so the results fill the room above the keyboard. Group titles (Favourites, a category, Also trains…, Recently used, A–Z) use `.group-title`. History's inline calendar uses seven equal columns. Detailed day controls are at least 44px high; Simple uses 12px squares in 32px rows, increased to 36px on coarse pointers, with 2px row gaps and 8px card padding. Its two icon toggles are 44px square on one line; compact From/To buttons share two columns. Date ranges have no horizontal cell gaps and use joined top/bottom borders, an accent tint and rounded visible segment ends.

## Elevation & Depth

Cards are flat: neutral surface contrast and a one-pixel border. Only sheets, the rest bar and the next-set chip have shadows (translucent neutrals that read the same in both themes), plus the original day/night switch's inset track, raised orb and sun/horizon glow. A sheet dims the page by about 38%; the Set sheet dims it by about 8% so the card stays readable. No gradients and no general card-shadow system.

## Shapes

Inputs, badges, small buttons and the done control are 10px; buttons are 12px; cards are 18px; a sheet's top corners are 22px. Chips are pill-shaped. The theme switch keeps its 28px track radius and circular orb. The shared `--radius` token is 1rem.

## Components

- **Buttons:** Button (primary accent with white text, secondary surface with a strong line border, quiet accent text, danger tinted) is 48px high, or 40px with `.btn-sm`, which keeps a 44px hit area through an invisible extension. IconButton is 44px. Text actions use accent blue. Hover darkens primary blue or applies a soft tint. Bordered controls keep a 3px accent keyboard-focus outline with a 3px offset. Borderless text actions, Back links and navigation use an underline with a 4px offset; icon buttons use accent colour and a heavier SVG stroke (3px) without an outline. The old `.primary`/`.secondary` classes are gone; every button uses `.btn-*`. Empty states are `.empty-card`: a dashed `line-strong` border, 18px corners, 24px padding, an `ink-2` icon, a 17px semibold title, a 15px `ink-2` line and one action.
- **Cards:** flat surfaces with a hairline border and 18px corners; the exercise card, Library routine cards and the Train resume card share them. The resume card of a running workout has a 2px accent border that turns slowly (a `conic-gradient` on an animated `@property` angle) and a pulsing live dot; a past workout keeps the plain accent border, and with reduced motion or no `@property` support the border is static. Warnings, Banner and save-state messages reuse the same surfaces, ink and borders. Banner is one component for save errors, “changed in another tab or device” (Load latest / Keep mine) and sync notices, under the top bar.
- **Inputs:** set values are 44px single-line `type="text"` fields on `surface-2`, centred, with decimal keyboards for kg and numeric keyboards for reps/seconds. Set and routine-plan inputs select their existing value on focus and repeated click; selection uses white text on the accent. Custom pointer capture bounds selection within the field and prevents native selection dragging from requesting page auto-scroll. Handle-only reordering and scrolling that starts outside the field remain separate. Keyboard copy, select-all and browser find shortcuts remain available. This behavior has automated coverage; native browser gestures have not been verified. Incomplete raw input stays in local editor recovery until corrected, with actual validation visible; blank unfinished fields omit the two empty-value prompts. Other fields are rounded, bordered and on the ground colour, with 16px base text, and keep the single custom select arrow. A set that differs from the exercise's load shows its marker inside the field and the value sits against it (“40 kg”); “+10” and “−25” always carry their marker; plain bodyweight is the text “BW”, not a field. A checked (read-only) field keeps native scrolling (`touch-action: manipulation`, no preventDefault) and warns only on a real tap. A set field's focus ring is drawn inside it (2px accent outline at −2px offset, with an accent border), so a neighbouring field never covers or clips it however tight the row. Cardio time uses the number pad (`inputmode="numeric"`, `pattern="[0-9]*"`) with timer-style entry; distance in km or mi uses the decimal pad, metres, level, calories and heart rate the number pad.
- **Navigation:** four icon tabs, fixed and centred within the shell (the tabs at most 480px across): Train (Dumbbell), History, Progress (TrendingUp) and Library. Inactive tabs are `ink-3` icons; the current tab also shows its name (13px semibold) in an `accent-soft` pill with accent text and icon. The current tab is 1.7 times as wide as the others, so Swedish “Framsteg” and “Bibliotek” fit at 360px, and on a change the pill slides across while the tabs make room and the name fades in. Every tab is at least 44px with its name as `aria-label` and `aria-current="page"` on the current one; keyboard focus is an accent ring. The bar is the Quiet surface at 88% with a 16px backdrop blur where supported (solid elsewhere), a top hairline and safe-area padding. On Settings and Admin no tab is current and the pill fades out. Menus and exercise actions are borderless. Auth uses an inline Back link; phone-only logging remains available without a separate Continue on phone button. The workout screen hides it.
- **Page motion:** a tab slides in from its side of the bar: going to a tab on the right, the new page enters 32px from the right while the old one drifts 12px left and fades (going left mirrors it). Settings and Admin push in from the right and Back slides them out to the right. 260ms on the `--gt-ease-out` curve, transform and opacity only, and taps pass straight through to the new page. It runs as a view transition (`document.startViewTransition`, Safari 18 and Chrome; the bar has its own `view-transition-name` and stays still); without the API, and for back/forward or a navigation from code, the new page's `main` slides in with the Web Animations API instead. A page's first eight cards and groups rise 6px into place 15ms apart. The Segmented thumb slides between options. Reduced motion turns slides into a 120ms fade and drops the rest.
- **Reps + hold rows:** the count column widens from 48px to 84px and holds reps and a hold field side by side (4px apart, each 40px, 16px+ text, “s” inside the hold field; the placeholder is “s”). Previous gives up the room and wraps: about 84px at 390px in kg, 74px in lb, and still around 44px at 360px in lb. A checked row draws “·” in the gap like the “×”: “60 × 6 · 2 s”. The heading reads “Reps · hold” on one line.
- **Favourite star:** a 15px filled star in `warm-fg` after the name in Library and picker rows, `aria-hidden` with a visually hidden “Favourite”; not interactive.
- **Cardio rows:** badge, the exercise's chosen fields in their own grid, ✓. Up to four fields share one line (two lines of two under 380px), more go in lines of three; time is the widest column (at least 56px), every other at least 44px, gaps 4px (8px from 400px), fields 16px. The headings use the same grid, so each sits over its field: Time, the distance unit, min/km, Level, Incl. (Lutn.), kcal, HR (Puls). Pace is muted text, not a field. Fields… in the ⋯ menu lists the shown fields as its hint and opens a sheet of switches (each with a hint line where it helps) with the km / m / mi segmented control under Distance.
- **Workout:** a sticky top bar (back, the name that opens Workout details, one status line, Finish or Save) over exercise cards and a dashed “+ Add exercise” button; with no exercises there is one large “Add your first exercise”. A card has the exercise name, “Last: 19 Oct”, ⋯, accent column headings with a chevron (Set · Previous · load · count · Done) and the set lines. Badges number working sets 1, 2, 3… (drops are not counted); warm-up shows W in amber, cool-down C in soft blue and a drop ↓ with no number. The next set has an accent border; a checked row is tinted `done-soft`, its values are read-only and an input attempt shows “Uncheck this set to edit its values.” in danger red and highlights that row's ✓. Drops have no ✓ and take their set's state. The load heading shows the exercise default (kg or lb, BW, +kg, Assist) and opens the kg/lb choice sheet; the count heading (Reps, Sec or Reps/sec) opens Reps / Hold (seconds). A checked row's fields lose their outline and fill and read as text, with a muted 13px “×” drawn in the gap between load and reps (“s” after a hold); nothing moves when a set is checked. In pounds the load field is 62px (76px with a prefix). Finish is `btn-secondary` with an accent outline until every set is checked, then `btn-primary` with a 110° accent → cool → done gradient whose position drifts over 4 s (static under reduced motion). Add set copies the last non-drop set. The next-set chip (“Next set ↓”) floats bottom centre only while that row is off screen; tapping it scrolls the row to the centre. The rest bar floats there too (time left, +30 s, Skip; then “Rest done” and Dismiss). Drag handles show a grip and index, use accent tint while moving and keep visible keyboard focus; Space/Enter grabs and drops, arrows move, Escape cancels the move while keeping the sheet open, and dragging auto-scrolls the nearest scrollable container. The same sorter serves routine planning. Historical edits retain Save/Discard. Removed in the redesign: the “Edit sets” switch, compact mode, the per-row type select and remove button, the top-bar Abandon, the footer and the “Go to active set” link.
- **Sheets:** every dialog is a bottom sheet on phones (22px top corners, a handle that closes it, a tap outside or Escape) and a centred panel at most 480px wide from 640px up. A full sheet's sticky header is the title and muted line with a Close (×) `icon-btn` at the right; short sheets end with their own Done or actions; long editors and History details pin their actions in the sticky `.sheet-footer`. The workout sheets: Set (type, load for this set, Add drop, Delete set; it dims the page only lightly), ⋯ (a menu list: Swap exercise leads it in accent text and icon over a hairline, `.sheet-menu-item.is-lead`, then Fields… for cardio, Reorder sets, Reorder exercises, and the danger Remove exercise), Reorder sets and Reorder exercises (the same `SortableSetList` handles; exercise rows add 44px ↑ / ↓ icon buttons and the opening exercise gets the accent ring of an edited row; both end with a Done button), Finish (summary, “Save as a routine”, Save workout, Keep logging, then the danger Abandon workout) and Workout details. Confirmations, the exercise picker (full height), History details, the History date picker, the routine and exercise editors and account deletion use the same Sheet. The long routine and plan editors keep Save in a `.sheet-footer` pinned flush to the sheet's bottom edge (top hairline, surface fill, safe-area padding, 44px button): a sticky box stops at its scroller's padding, so a full sheet with a footer has no bottom padding and the footer carries it, and nothing shows beneath it. The sheet itself already rides above the keyboard. Choice sheets (`ChoiceSheet`: kg/lb, reps / reps + hold / hold, the Settings weight unit) are a `.sheet-menu` with an accent check on the current option. Changes in a sheet apply immediately. Segmented controls use radio-group semantics; Switch uses `role="switch"` with `aria-checked`.
- **Profile and BW:** Settings includes a Profile card with decimal bodyweight in kg, a save action, inline validation and truthful local/pending/synced/error status. A registered BW value appears with the small “kg BW” label next to “BW”; absent values show “BW” only. Bodyweight sets offer “BW + kg” in the Set sheet; the load heading then reads “+kg” and the value shows the “+” marker. Completed BW sets retain their captured bodyweight after a profile change. The added load never replaces that snapshot.
- **History:** show one calendar/date controller followed by workouts, defaulting to the current month. Two icon-only buttons replace segmented mode controls: a calendar with connected start/end markers offers From/To selection and a plain calendar offers return to month; CalendarDays/Grid3X3 show detailed/simple. Keep pressed states, descriptive titles and accessible labels. Detailed retains the Monday-first grid, completed-day dots, blue today border and solid-blue single-day selection. Simple shows one compact square per actual day with full accessible date/workout-count labels. Date ranges appear as one joined tinted band per visible row, with continuous top/bottom borders and only segment ends rounded. Month/year selects and previous/next remain in the same controller. A single “Show current month” footer action is absent when already at the default period; the small legend reads “Workout day”. Month mode supports a selected day; range chooses inclusive From/To bounds across months. Browsing preserves bounds; future dates are disabled. History has no statistics, “More periods” or second date picker. Workout details list only checked sets; a drop appears as a muted “↳ 80 kg × 4” on the value side under its set. The calendar sits in a card under the title (Simple by default) and the workouts follow in week groups of `.list` rows with a chevron; a row that set a best estimate shows a warm “New best” badge.
- **Progress:** a 4 weeks / 3 months / Year `Segmented` drives a 2×2 grid of tiles (workouts per week over finished weeks only, working sets, volume, time trained), each with its change against the previous period (↑ in the done colour, → muted). Recent bests are up to four cards: the exercise name as an accent link (to the exercise page), a warm “New best” badge, the set and the date; the rest of the card opens that workout's details with the set highlighted (a stretched link, so the two targets never nest). The exercise list shows name, “Best … · N sessions” and a 64×28 accent sparkline (`aria-hidden`); a row opens the exercise page. Lift goal cards end with the exercise as the same kind of accent link above the card's own button. The exercise page's Overview tiles are two per row: best and latest change, then Sessions · 30 days beside Heaviest lift (the set label at 20px over its date); for assisted, bodyweight-only, timed and cardio exercises there is no Heaviest lift and Sessions spans the row.
- **Exercise page and finished workouts:** the exercise page has the shared header (Back chevron, “Exercise” eyebrow, the name; a star and ⋯ at the right), a muted meta line (main category in ink, “also …”, equipment, Mine/Shared/Hidden stat chips) and a three-way `Segmented` Overview | History | Records. History cards (`.session-card`, a link) hold the workout name, date and set count over read-only checked rows. A checked row (`DoneSetList`, `.done-row`) is one 44px line: the workout screen's badge chip (number, W/U, C/N, ↓ for a drop, in the same tones) and the value at 17px semibold with a muted 13px “×”; a record set ends with a warm `stat-chip` “PR”; a highlighted row (from a record link) has the accent-soft fill and 2px accent ring of the row a Set sheet edits. Records are `.list` rows with the value at the right. History's workout details reuse it: four `surface-2` tiles (Sets, Volume, Time, Records in warm when any), then an `.ex-card` per exercise whose head is a link (name, set count, chevron), a warm “Record: Best session volume” line when that applies, and the rows; Repeat (primary), Edit (secondary) and Delete (a danger-tinted icon button) share one line in the sticky `.sheet-footer`. Styles in `src/styles/details.css`.
- **Top bar and lists:** `PageHeader` is a muted 13px eyebrow over a 28px bold title, with an optional leading back button (always `BackButton`: the 44px `icon-btn` chevron, on Settings, Admin, the exercise page, Auth, 404 and “Workout not found”) or trailing icon button; every page has an eyebrow except Train, whose title is the date; the sync, sign-in and conflict notices render as `.banner` under it. Groups are a 13px semibold `ink-2` title over a `.list` (18px corners, hairline separators); rows are at least 56px with a title, a muted second line, an optional value and a chevron. Settings, plans and goals use rows and cards that open sheets.
- **Train:** the title is today's date (28px bold, no eyebrow); the gear centres on its first line (`PageHeader align="first-line"`). The This week card has Monday-to-Sunday dots (done-coloured when a workout was logged, an accent ring for today), a chip and a muted totals line. Start a routine rows end in a round accent-soft play button.
- **Library:** the eyebrow “Your training setup”, a `Segmented` Routines | Exercises | Plan under the title, kept in the URL, and one muted helper line saying what the chosen section is for. Exercise rows open the exercise page (the name and line are the link; the star and ⋯ stay beside it). Routine cards have the name, a muted summary, the exercise names, a Start and an Edit button and a ⋯ icon button that opens a sheet. A dashed `btn-dashed` button adds a routine or exercise. Exercises has a search field, pill filter chips and Recently used / A–Z groups; custom rows carry a “Mine” chip (Swedish “Min”) and open an editor sheet, whose “Also trains” row is pill chips (`.filters`, pressed = ink). An exercise card's header can carry a second muted 13px line under “Last:”, “3 working sets · last time 4”.
- **Plan tab and goals:** the Plan tab is a Plans list (name, period and cycle, a status value, and a pause/play `icon-btn` beside the row; a paused plan's name turns `ink-2` and its status reads an italic “Paused”), a dashed “New plan”, and a `details.plan-advanced` row (“Advanced”, “Groups · N”, a rotating chevron) folding the Groups list, its one-line explanation and a dashed “New group”. A plan row's muted line reads “4 Nov – 24 Jan · Week 3 of 12 · 3 + 1 deload · 3 progressions”. Plans and groups edit in `size="full"` sheets. The plan template is seven 48px day buttons per week (a muted “Week n” caption above each when the cycle is longer than one): a set day is accent-soft with accent text, Rest is `surface-2`, an empty day is a plain outline. A day opens a choice sheet (Use the template for dates, Nothing planned, Rest, Routines, Day types, Groups) with a check on the current one. With a longer cycle each “Week n” caption has a Normal/Deload pill (`.week-kind`, 28px with a 44px target, pressed = `surface-2` with ink text); a deload week's set days turn `surface-2`/ink-2. Under Repeats every sit the preset `filter-chip`s (3 + 1 deload, 5 + 1 deload, No deload) and, with a deload week, the rule in a muted line over two selects (load, working sets). The Length select sits under From/To. Progression is a horizontally scrolling `.prog-table` (sticky lift column with “82.5 → 100 kg × 5”, 52px week cells, deload columns on `surface-2` with a small “D”, typed weeks in accent with a dotted underline) over two dashed buttons; a lift opens a full sheet: Reps and Start fields, a muted history line with a “Use it” text link, a % / kg target `Segmented`, a level `Segmented` with the detected level, a “Suggested timeline” card (the rate, a muted basis line, a warm `.prog-warning` box with a TriangleAlert icon and a primary “Use suggested timeline”), the week-by-week list (`.prog-week` rows: name, a Deload pill, a reset icon when typed over, an 84px right-aligned field and “kg”), the “Also add as a goal” Switch and a danger-text Remove. A workout card's plan line reuses the muted `.ex-last` style (`.ex-plan-note`). The Upcoming month grid reuses the History calendar's day cells with a marker under the date (accent dot planned, ring for rest, accent-soft background for a dated change). Overlap errors use `field-error` (or an error toast from the row's resume button). The plan editor shows a paused plan's note as a `surface-2` box under the name and has a secondary Pause plan / Resume plan button above Delete. On Train, “Today: <name>” is a card (its eyebrow reads “Week 3 of 12 · Deload” inside a phase, else “From your plan”) (a small Start, or Start with suggestions) followed by a group's routines as rows; planned days are rings in the week strip and This week has a Plan text link. Progress opens with a Stats | Goals `Segmented` under the header; the Goals tab's header is “N active goals” over “Goals” with a “+ Add goal” text link as the action, and Stats starts with `.goals-chip-link`, a 44px one-line surface row (accent target icon, ellipsised text, chevron). The weekly card holds “2 of 3 workouts” (17px semibold) with a soft chip (days left, done colour when met), the 8px `.goal-bar`, a 56px `.week-strip` of 12 bars (done colour met, accent for the running week, ink-3 missed, surface-2 before the first workout) under a dashed ink-2 goal line, dates under it in 12px ink-2, an sr-only summary, and two 13px ink-2 fact lines. A goal card is a button: title with a pace chip (done-soft On track/Ahead, warm Behind, muted Not enough data), the bar, Start/Now/Target in three columns (12px labels, Now bold) with a 64×28 sparkline, then muted lines for the due date (danger, bold, when overdue), the rate needed against the trend and the projected date. Reached goals are a `details` with the `session-summary` chevron over a `.list` of rows.
- **Sharing:** Library → Exercises has a Shared pill chip, right after Mine in the single sideways-scrolling row All, Mine, Shared, Recently used, Hidden (`.facet-chips`, like the category and equipment rows). Its rows reuse `.exercise-row`: name, a muted “category · equipment” line and a 44px bordered Add button; there is no star or ⋯. Signed out or offline, a muted `.empty` note replaces the list. A custom exercise's ⋯ sheet adds a secondary button (Share2 icon): Share to library, Stop sharing or, signed out, a link “Sign in to share”. A shared exercise carries a small “Shared” stat chip next to “Mine”.
- **Shared routines and names:** Library → Routines starts with two pill chips, Mine and Shared. Shared rows reuse `.exercise-row`: the routine name (with a “Mine” stat chip on your own), a muted “by <name>” line, a muted “N exercises · first three names” line, and the 44px Add button, or a muted “Added”. A shared routine's card carries a “Shared” stat chip after its name. The routine ⋯ sheet lists Share to library / Stop sharing (Share2 icon) above Delete, with a muted note under the list. Shared exercise rows add “by <name>” to their muted line when the sharer set one. Signed out, both Shared views show the muted note followed by a “Sign in” text link. Settings → Account has a Name row (value at the right, a muted one-line explanation) that opens a sheet with one text field, Save name and, when set, Remove name.
- **Feedback and admin:** Settings has a Help and feedback group (Send feedback, and for admins an Admin row with an accent “N open” stat chip). The feedback sheet is `size="full"`: a Bug | Feature idea `Segmented`, labelled title and description fields, a 4-column grid of square thumbnails with a 28px dark round remove button (44px target), a secondary “Add images” button, a `Switch` for technical details and a primary Send, then a My reports list whose rows end in a status `stat-chip` (Open accent, Planned warm, Done green, Won't fix muted). The Reports page reuses `PageHeader` with Back, two `.facet-chips` rows (status with a muted count, then kind) and `ListRow`s led by a 32px round kind icon (Bug on danger tint, Lightbulb on warm tint). The report sheet shows the text pre-wrapped, the same thumbnail grid, technical details in a `<details>` with a monospace block on `surface-2`, a four-option status `Segmented`, the note textarea, a danger Delete with confirm and a sticky Save footer; an image opens contained in its own full sheet.
- **Exercise search:** search and clear controls, category chips and footer actions keep their styles inside a full-height sheet. Clearing returns focus to the search input. Use the responsive result-list scrolling described in Layout.
- **Theme switch:** retain the original day/night orb, horizon and decorative night stars. Decorative stars remain hidden from assistive technology.
- **Feedback:** top, mobile-wide toasts use the current surface, ink and border. The next set has an accent border and green marks the checked state. A check settles over the 180ms motion token (150–200ms ease-out for state changes; things that move, such as page slides, the tab pill and the segmented thumb, take 260ms on `--gt-ease-out`); the theme transition takes 650ms. Reduced motion removes all of it. Timers and haptics remain opt-in.

## Do's and Don'ts

- **Do** take every colour from `tokens.css`, and keep `ink-3` for disabled controls, icons and separators.
- **Do** keep the navigation, theme switch and identity assets, and give every page a top bar.
- **Do** put rarely used controls in a sheet and keep the card to the values, ✓ and one-tap headings.
- **Do** keep targets at 44px, tabular numerals, state changes at 150–200ms and movement at 260ms on `--gt-ease-out`, on transform and opacity.
- **Do** retain clear save status, planned-routine fields and readable completed data.
- **Do** write every visible string, aria-label and toast through `t()` from `src/i18n`, and check new copy in Swedish at 360px: its words run longer (Uppvärmning, Nedvarvning, Assisterad), so segmented controls, chips and buttons must fit or wrap, never scroll sideways. Swedish copy is casual du-form: pass, set, rutin, övning, vila, uppvärmning.
- **Don't** add gradients, a general card shadow, web fonts or a second accent colour.
- **Don't** bring back the “Edit sets” mode, compact rows, per-row type selects or remove buttons, or the top-bar Abandon.
- **Don't** reintroduce the Training Ledger palette, flattened exercise layout or restrained-corner redesign; the owner rejected that visual direction.
- **Don't** replace the identity assets or add a new visual identity without a new user request.
- **Don't** let any control hide real field errors or replace historical Save/Discard behavior.
