---
name: Gain Train
description: The original blue, navy and light-grey workout tracker.
colors:
  blue: "#365de9"
  blue-dark: "#819bff"
  primary: "hsl(225 80% 56%)"
  button-hover: "#284bc4"
  background: "hsl(220 25% 97%)"
  background-dark: "hsl(225 25% 7%)"
  surface: "#fff"
  surface-dark: "#171c28"
  ink: "#172033"
  ink-dark: "#f0f3fa"
  soft: "#596273"
  soft-dark: "#a3aec0"
  line: "#dce1eb"
  line-dark: "#30384a"
  completed: "#167d58"
  completed-ink: "#fff"
  destructive: "hsl(0 70% 44%)"
  destructive-dark: "hsl(0 85% 72%)"
typography:
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  title:
    fontSize: "1.65rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  home-title:
    fontSize: "clamp(23px, 5vw, 30px)"
  headline:
    fontSize: "1.2rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  label:
    fontSize: "14px"
    fontWeight: 600
  set-value:
    fontSize: "19px"
    fontWeight: 650
rounded:
  input: "10px"
  button: "12px"
  list-card: "15px"
  card: "16px"
  exercise-card: "17px"
  theme-switch: "28px"
  chip: "50px"
spacing:
  compact: "4px"
  small: "8px"
  medium: "12px"
  control: "16px"
  narrow-phone-gutter: "12px"
  phone-gutter: "18px"
  section: "24px"
  desktop-gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "var(--surface)"
    textColor: "var(--ink)"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  input:
    backgroundColor: "hsl(var(--background))"
    textColor: "var(--ink)"
    rounded: "{rounded.input}"
    padding: "10px 12px"
  list-card:
    backgroundColor: "var(--surface)"
    textColor: "var(--ink)"
    rounded: "{rounded.list-card}"
    padding: "17px 18px"
  exercise-card:
    backgroundColor: "var(--surface)"
    textColor: "var(--ink)"
    rounded: "{rounded.exercise-card}"
    padding: "18px 12px"
---

# Design System: Gain Train

## Overview

**Creative North Star: "Original Gain Train"**

The owner prefers the original Gain Train visual system and requested its restoration while retaining quality-of-life improvements and bug fixes. Blue actions, navy text, light-grey backgrounds, rounded cards and the Gain Train header define that system. Home retains its original heading and date treatment.

Visual authority is the [original GitHub Pages app](https://antonj997.github.io/gain-train-pwa/) and [repository commit 3d2514862f7babecb964eb01b09230d804b86e77](https://github.com/antonj997/gain-train-pwa/tree/3d2514862f7babecb964eb01b09230d804b86e77). The restored `src/index.css` and six public icons come from that commit: `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable.png`, `public/apple-touch-icon.png` and `public/favicon.ico`. The supplied `public/icon-license.txt` credits Lucide/Feather contributors. Preserve these assets and their license.

Current implementation sources are `src/index.css`, `src/styles/usability.css` and `tailwind.config.ts`. The usability stylesheet loads after the original stylesheet and adapts retained controls to the original visual system.

**Key Characteristics:**

- Blue actions and links with light and dark neutral surfaces.
- Rounded, bordered cards and touch-friendly controls.
- Familiar brand header, fixed bottom navigation and animated day/night switch.
- Quality-of-life additions that inherit the original tokens.

## Colors

Blue identifies actions, links, selected navigation and the next set. The primary button keeps the original solid blue in both themes; theme-aware text and indicators use the `--blue` token. Primary HSL supplies the subtle resume-card gradient. Selected navigation keeps a transparent background.

Light mode uses a cool light-grey page, white surfaces, navy ink, muted blue-grey secondary text and pale divider lines. Dark mode uses a deep navy page, raised navy surfaces, pale ink, muted blue-grey text and brighter blue indicators. Green marks checked sets; destructive actions use the theme-aware destructive color. The frontmatter records the observed values; CSS remains the implementation source of truth.

## Typography

Use the existing Inter-first system sans stack. The base body is 16px with a 1.5 line height; labels are 14px and weight 600. Headings use the frontmatter hierarchy, with Home's responsive title and the editor's existing 1.45rem title. Keep readable completed values and tabular numerals for numeric inputs, timers and performance results.

## Layout

The app is phone-first with an 800px maximum shell width. At widths up to 479px, main content, the header, sync line and workout footer use 12px horizontal gutters, increased where a device safe-area inset requires it. Settings, routine and empty-state cards use 16px horizontal interior padding at these widths. Main content retains 18px gutters from 480px through 639px, then 36px at 640px, where workout detail fields form three columns. The 116px bottom reservation keeps fixed navigation or workout controls clear.

Below 360px, set rows and metric grids adapt to the available width. Set metadata keeps two columns at 320px: previous performance on the left, set type on the right. The locale-formatted numeric date uses a two-digit year on one line, with the intact previous result on a separate line; the date retains its full accessible label.

The original stack gap is 24px; Home, History and Progress use compact 14px page gaps. Keep the Gain Train header on every route. Fixed controls and the header account for safe areas. Dialogs use the visual viewport to fit above the keyboard; bottom controls hide while the keyboard is open.

## Elevation & Depth

Cards use neutral surface contrast and one-pixel borders. The resume card adds a restrained primary-color gradient. Shadows belong to the original day/night switch: the inset track, raised orb and sun/horizon glow. Do not add a general card-shadow system.

## Shapes

Preserve the varied rounded forms: inputs and completion controls (10px), buttons (12px), list cards (15px), general cards (16px) and exercise cards (17px). Chips are pill-shaped. The theme switch keeps its 28px track radius and circular orb. Tailwind's shared radius is 1rem, with medium and small variants derived by subtracting 2px and 4px.

## Components

- **Buttons:** primary blue with white text; secondary surface with a divider border; text actions use theme-aware blue. Standard primary/secondary controls are at least 46px high; text actions retain their 36px base height. Icon controls and retained set removal controls are at least 44px. Pointer hover darkens primary blue or applies a subtle primary tint. Bordered controls retain a 3px blue keyboard-focus outline with a 3px offset. Borderless text actions, set-type selects, Back links and navigation use an underline with a 4px offset; icon buttons use blue color and a heavier SVG stroke (3px) without an outline.
- **Cards:** retain the original rounded, bordered list and exercise containers. Compact Home and History card padding comes from the original stylesheet. Additional timers, routine plans and save-state controls inherit the same surfaces, ink and borders.
- **Inputs:** rounded bordered fields on the page background, with 16px base text. Set values are centered in 48px fields. Keep the single custom select arrow, visible field errors and readable disabled/completed values.
- **Navigation:** fixed, centered within the shell, with muted labels and icons. The active destination uses blue text on a transparent background. Menu and exercise actions remain borderless without a background option box. Auth uses an inline Back link; phone-only logging remains available without a separate Continue on phone button.
- **Workout and history:** the jump action reads “Go to active set”. History metrics remain visible above the explanatory “About these stats” disclosure. Preserve the previous-result layout described in Layout.
- **Theme switch:** retain the original day/night orb, horizon and decorative night stars. Decorative stars remain hidden from assistive technology.
- **Feedback:** retain top, mobile-wide toasts using the current surface, ink and border. Keep the next-set blue marker and green completion control. The retained check settles over 140ms; the original theme transition takes 650ms. Respect reduced motion. Timers and haptics remain opt-in.

## Do's and Don'ts

- **Do** preserve the original Gain Train palette, rounded containers, header, navigation, theme switch and identity assets.
- **Do** style retained and future quality-of-life controls in `src/styles/usability.css` using the incumbent tokens.
- **Do** retain clear save status, direct load/measurement controls, planned-routine fields and readable completed data.
- **Don't** reintroduce the Training Ledger palette, flattened exercise layout or restrained-corner redesign; the owner rejected that visual direction.
- **Don't** replace the restored identity assets or add a new visual identity without a new user request.
- **Don't** introduce record migrations or cloud changes during these visual refinements.
