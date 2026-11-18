# Muscle map: exercise icons, muscle picker and detailed maps

Date: 18 November 2026. Owner decisions from the icon and muscle-map rounds on the UX demo
(Step 14, "Övningsikoner och muskelkartor").

## What the owner asked for

1. Implement the muscle maps in the app.
2. A muscle icon with a heart for cardio exercises.
3. Map the existing (built-in) exercises to the map.
4. A muscle picker when creating or editing an exercise: users choose which muscles their own
   exercise trains and how much. This is the advanced choice; a simple choice by group
   ("Bröst", "Rygg", "Core", …) is still there, and a group chosen simply gives every muscle in
   it the same level.
5. Own exercises can show the small body icon or one of a few simple equipment icons. With no
   icon chosen, the icon is a dumbbell.
6. The detailed muscle map on the exercise page and on plans, showing what the week covered.
7. Icons use the app's style-guide colours; the large map uses the red gradient.

## Decisions

### Muscles and levels

- 23 muscles (`src/data/muscles.ts`): chest, upperChest, frontDelts, sideDelts, rearDelts, biceps,
  brachialis, triceps, forearms, abs, obliques, traps (upper trapezius), upperBack (mid/lower
  trapezius, rhomboids, infraspinatus, teres), lats, lowerBack, glutes, abductors (gluteus medius and
  TFL), quads, hamstrings, adductors, calves (gastrocnemius), soleus, tibialis. Each belongs to one
  of the app's muscle groups (`MUSCLE_GROUP`).
- Two levels: **1 = main muscle** ("Mycket"), **0.5 = helping muscle** ("Lite"). A set counts as
  one set for a main muscle and half a set for a helping muscle, the same rule as the existing
  sets-per-group card. Muscles not trained are left out.

### Built-in exercises

- Every catalogue exercise (170) gets a muscle mapping in `src/data/exercise-muscles.ts`, by name,
  like `MOVEMENT_BY_NAME`; a test checks that every catalogue entry is mapped and that every value
  is a valid muscle and level.
- Cardio machines get a light mapping (for example rower: lats, upperBack, quads, glutes as
  helping) so the exercise page can show what they work, but their icon is the heart figure.

### Custom exercises

- Two new optional fields on `customSchema` (no server change: the server only checks category,
  note and favourite):
  - `muscles`: muscle id → 1 | 0.5. Absent on older exercises.
  - `icon`: `"body"` or an equipment glyph id (`dumbbell`, `barbell`, `kettlebell`, `machine`,
    `cable`, `band`, `bodyweight`). Absent means dumbbell.
- Neither is shared (like `categories`), so shared copies keep working.
- The muscles of an exercise (`musclesOf`): the catalogue mapping; else the custom exercise's
  `muscles`; else derived from its categories (main category → every muscle of that group at 1,
  other categories → 0.5; Cardio, Full body and Other give nothing).

### Small icon (exercise avatar)

- The block figure from the demo, one view: the side where the main muscles sit (the demo's
  `miniView` rule). Front: two pecs, abs column and obliques; back: traps triangle, two lat wings
  parted at the spine, a small lower-back triangle; arms in shoulder/upper arm/forearm, legs in
  thigh/calf, glutes at the top of the legs from behind. Zones group muscles exactly as the demo's
  `SEG` table does.
- Colours follow the existing avatar: the circle keeps its category tint (`--tone-bg`); the figure
  is drawn in the category colour (`--tone-fg`): body at about 35 % of the tone, untrained zones
  at about 15 %, helping muscles at about 60 %, main muscles at 100 %, so it reads in both themes.
- Cardio exercises (category Cardio or measure cardio): the front figure with a heart on the chest
  in the tone colour.
- Own exercises show their chosen equipment glyph (default dumbbell) in the tone colour, or the
  body figure when `icon` is `"body"`.

### Detailed map

- The demo's detailed figure, front and back side by side, male and female. A setting in
  Settings ("Muskelkarta: Man / Kvinna", default Man) picks the figure; stored like the other
  preferences.
- Colours: black figure, grey untrained muscles, and the red gradient: on an exercise, main
  muscles red and helping muscles light pink; over a week, five steps (under 5, 5–9, 10–14, 15–19,
  20+ sets). New tokens `--gt-map-*` and `--gt-heat-1…5` in `tokens.css`, for both themes. The map
  sits on its own panel colour (light grey-blue / dark navy) as in the demo.

### Where it shows

- **Exercise page:** a "Muskler" card with the map, a legend (main, helping, untrained) and the
  muscles listed as main and helping.
- **Plan status page:** the existing volume card gets the map of the plan week that holds today
  (sets so far, per muscle, heat colours), with the five-step legend, above its group bars. After
  the plan has ended it shows the average week.

### Muscle picker (exercise editor)

- A "Muskler" section in the custom-exercise sheet with a small live preview map and a segmented
  control **Enkel / Avancerad**.
  - Enkel: the seven groups, each with a three-way control **– / Lite / Mycket**. Choosing a level
    sets every muscle of the group to it. A group whose muscles differ shows "Blandat" until
    changed.
  - Avancerad: the muscles under their group headings, each with the same control.
- Until the user changes anything, the preview shows the muscles derived from the categories.
- An "Ikon" row: the body icon (with the current selection) and the equipment glyphs; none chosen
  means dumbbell.

## Out of scope

- Sharing `muscles` and `icon` with shared exercises (needs a server change).
- Changing the sets-per-group bars (they keep using categories).
