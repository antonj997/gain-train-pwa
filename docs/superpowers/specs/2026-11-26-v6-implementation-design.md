# Mockup v6 in the app: design

Date: 26 November 2026. The reference is `docs/superpowers/mockups/2026-11-v6/`: `mockup.html` (frames A–H and the settings), `changes.md` (rounds 1–8), `presentation.html`, the owner's comments (`owner-comments-round7.md`, `owner-comments-round8.md`) and `decisions.md`.

## Precedence

1. `decisions.md` (26 November) overrides everything else.
2. The owner's fixed design decisions stand:
   - the Quiet design system;
   - the red muscle map with the black figure;
   - block-figure exercise icons, with a dumbbell as the default icon for your own exercises;
   - four tabs;
   - the v5 set row, plus an RIR field when RIR is on;
   - 44 px touch targets;
   - type sizes 12/13/15/17/20/28 at weights 400/600/700;
   - motion only through the `--gt-dur-*` / `--gt-ease-*` tokens and `MOTION`, `EASE` and `SPRING` in `src/lib/motion.ts`.
3. Round 8 overrides round 7, which overrides rounds 1–6.
4. The mockup is a picture of the target. Where its demo data or markup differs from the app's data model, the app's model and primitives win: `Sheet`, `Segmented`, `ChoiceSheet`, `ListRow`, `Switch`, `Reveal`, `MessageSlot`, `DayCell`, `MOTION` and the tokens in `src/styles/tokens.css`. No new primitive is made where one of these fits.

Swedish copy below is exact and goes into `src/i18n/sv.ts`. `src/i18n/en.ts` is the source of truth for keys, so every new key gets an English string with the same meaning. A few English strings are given here; implementers write the rest plainly.

## Owner decisions for this release (decisions.md)

| # | Decision | Where it lands |
|---|---|---|
| 1 | Plan sharing (E2s, E2r, "Delat med dig", "Sara följer med") is **not built**. It needs a server change and is a later step. Workouts and routines are shared as today. | Not in any phase. E2 lists plans without the share button, the "Delat med dig" group or the "Följer med" status. |
| 2 | The fatigue suggestion (B13) defaults to **Föreslå**, set in Inställningar → Coach (Av / Föreslå / Automatiskt). | §D10, §G1 |
| 3 | **RIR is off by default** ("Fråga efter RIR" off, as today). The RIR box in the set row and the RIR slider show only when it is on. | §D3, §B12 |
| 4 | **The rest timer is off for new users.** Anyone with a saved rest time keeps it. | §D7 |
| 5 | **The RIR pad is exactly as tall as the kg/reps number pad**, so nothing jumps when the field changes. | §B12 |
| Sport | **A new feature (decisions.md, "Ny funktion: Sport"):**<ul><li>sports are exercises in category Sport, logged as cardio sets with fields each sport chooses;</li><li>the app ships standard sports;</li><li>a quick "Logga sport" flow, also from a planned day;</li><li>a sport counts as training in Kalender and in plan adherence;</li><li>its muscles show on the map but are not counted as hard sets.</li></ul> | §D13, §S |

## Not built

These are marked rejected (*Tas inte*), skipped or deferred in `changes.md`, or deferred by `decisions.md`:

- **E2s / E2r plan sharing** and everything that depends on it ("Dela schema", "Låt andra följa med dig", "Följ med Erik", "Delat med dig", "Aktivt · Sara följer med"). Decision 1.
- **E-P3 blue scale or light figure, neutral small map, a neutral scale for minor muscles.** The red scale and the black figure stay (owner).
- **E-P9 half figure, and R3-Ikon 1, the block figure with an equipment badge for your own exercises.** The block figure in one view and equipment glyphs for your own exercises stay (owner).
- **F-P3.26, a body icon as the default for your own exercises.** The dumbbell stays the default (owner).
- **F-P3.29 theme as an ordinary switch.** The day/night switch stays an identity piece. It moves into the row (§G1).
- **E-A6 and E-A10** (Standing Calf Raise and Dumbbell Pullover mappings stay as they are).
- **Deferred in "Skjuts upp":**
  - the mapping fixes E-A1–A4, A7 and A9 in `exercise-muscles.ts`;
  - superset;
  - Swedish names for the whole catalogue (only the names listed in §D2 are built);
  - the date format on a real device;
  - RIR-weighted volume (E-B3). Because E-B3 is not built, the B12 sentences for RIR 4 and 5+ and the F3 footnote leave out the volume claims. See §B12 and §F3.
- **The rotator cuff, gluteus minimus, serratus anterior and the neck** as map muscles. D3b rejects them.
- **The "Mål RIR 1–2" line on the pad (B12).** The app has no RIR target anywhere: routines and plans store none. The pad shows no RIR goal.
- **The RIR-0 lowering mentioned in B13's caption** ("Med RIR på kan också nästa set få ett lägre mål …"). No frame draws it and it has no copy.

## Server and Supabase

**Nothing in this release changes the server.** Every new value lives in fields the server trigger (`supabase/migrations/20261112090000_rir_no_load_hold_weight_note.sql`, `validate_gain_record`) does not check, the same way `muscles`, `icon`, `folder`, `weightUnits` and `repHold` were added:

| Data | Where it lives | Why no migration |
|---|---|---|
| RIR 4 and 5+ | `rir` stays 0–3 (3 = "3 or more", what the trigger allows); a new optional set field `rirHigh: 4 \| 5` holds the finer value when `rir` is 3 (§D3) | The trigger checks only `rir`. Unknown set fields pass, and older apps read "RIR 3+", which is still true. |
| Exercise note, weight step and rest per exercise | new optional library fields `exerciseNotes`, `weightSteps` and `restSeconds`, keyed by exercise id (§D5) | The trigger checks only `hiddenExerciseIds`, `cardioFields` and `repHold` on the library. |
| A target lowered for fatigue | new optional workout-exercise field `fatigue: "lowered"` (§D4) | Unknown exercise fields pass. |
| Equipment of your own exercise | the existing optional `equipment` field on `customSchema` (§D6) | Already allowed. |
| Category of your own exercise, derived from its muscles | the existing `category` | Already checked as a string of at most 50 characters. |
| Standard programmes | static data in the app (§D8). Adding one writes ordinary routine records. | Nothing new is stored. |
| Sports (§D13) | A catalogue row or custom exercise with `category: "Sport"` and `measure: "cardio"`. The sport's fields go in the library's existing `cardioFields`, and its muscles in `muscles`. A sport workout is an ordinary completed workout with one cardio set. | Checked in the trigger:<ul><li>`category` is any string of at most 50 characters, on records and in `shared_exercises`;</li><li>`measure` is any string;</li><li>a cardio set may carry `durationSec`, `distanceM`, `level`, `calories`, `inclinePct` and `heartRate` within their limits;</li><li>a completed cardio set needs `durationSec > 0`, and the quick flow always requires a time;</li><li>a workout needs one completed set, which the sport set is.</li></ul>No new set field is added: "höjdmeter" is not an existing cardio field, so it is left out (see Owner questions). |

**Needs the owner's approval, and is not in any phase:**

- Raising the trigger's RIR cap from 3 to 5, so `rir` could hold 0–5 directly instead of `rir` + `rirHigh`. Optional; the `rirHigh` design works without it.
- Plan sharing (decision 1).

## Data model

### D1. Muscles

- **New muscle `hipFlexors`** (iliopsoas). It is appended last to `MUSCLES` in `src/data/muscles.ts`, because ids are stored and never reordered, with `MUSCLE_GROUP.hipFlexors = "Legs"`. There are now 24 muscles.
- **Main and minor muscles per group** (new `VOLUME_GROUPS` in `src/data/muscles.ts`). The order follows the mockup's `GROUPS`; the card sorts groups itself.

  | Group | Main (judged against 10–20) | Minor (drawn, never judged) |
  |---|---|---|
  | Chest | chest | upperChest |
  | Back | lats, upperBack | traps, lowerBack |
  | Shoulders | frontDelts, sideDelts, rearDelts | — |
  | Arms | biceps, triceps | brachialis, forearms |
  | Legs | quads, hamstrings, calves | adductors, soleus, tibialis, hipFlexors |
  | Glutes | glutes | abductors |
  | Core | — | abs, obliques |

  There are twelve main muscles (`JUDGED_MUSCLES`). Tibialis is drawn grey and never appears in "Släpar" (E-A8).

- **Three names per muscle**, all in `src/i18n/sv.ts` and `en.ts`:
  - `muscleName.<id>` is the short name. It is used in the picker, on the exercise page, in coach lines and in programmes.
  - `muscleLatin.<id>` is the Latin name. It is the subtitle in the advanced picker.
  - `muscleAnatomy.<id>` is the anatomical name. It is used in the volume fold-out (R8-9).

  | id | muscleName (sv) | muscleLatin | muscleAnatomy (sv) |
  |---|---|---|---|
  | chest | Bröstmuskel | pectoralis major | Stora bröstmuskeln |
  | upperChest | Övre bröst | pectoralis major, pars clavicularis | Stora bröstmuskelns övre del |
  | frontDelts | Främre axel | deltoideus, pars anterior | Främre deltamuskeln |
  | sideDelts | Sidoaxel | deltoideus, pars lateralis | Mellersta deltamuskeln |
  | rearDelts | Bakre axel | deltoideus, pars posterior | Bakre deltamuskeln |
  | biceps | Biceps | biceps brachii | Tvåhövdade armmuskeln |
  | brachialis | Armbågsböjaren | brachialis | Armbågsböjaren |
  | triceps | Triceps | triceps brachii | Trehövdade armmuskeln |
  | forearms | Underarmar | flexores antebrachii | Underarmens böjare |
  | abs | Raka magmuskler | rectus abdominis | Raka bukmuskeln |
  | obliques | Sneda magmuskler | obliquus externus et internus | Sneda bukmusklerna |
  | traps | Övre trapezius | trapezius, pars descendens | Kappmuskelns övre del |
  | upperBack | Mellersta rygg | rhomboidei, trapezius pars transversa | Romboiderna och kappmuskelns mittdel |
  | lats | Breda ryggmuskeln | latissimus dorsi | Breda ryggmuskeln |
  | lowerBack | Ländrygg | erector spinae | Ryggresarna (ländrygg) |
  | glutes | Stora sätesmuskeln | gluteus maximus | Stora sätesmuskeln |
  | abductors | Utsida höft | gluteus medius | Mellersta sätesmuskeln |
  | quads | Framsida lår | quadriceps femoris | Fyrhövdade lårmuskeln |
  | hamstrings | Baksida lår | biceps femoris m.fl. | Bakre lårmusklerna |
  | adductors | Insida lår | adductores | Lårets adduktorer |
  | calves | Vadmuskel | gastrocnemius | Tvåhövdade vadmuskeln |
  | soleus | Djupa vadmuskeln | soleus | Flundremuskeln |
  | tibialis | Främre skenben | tibialis anterior | Främre skenbensmuskeln |
  | hipFlexors | Höftböjare | iliopsoas | Höftböjarna (iliopsoas) |

  English: the short names stay as they are in `en.ts` (Chest, Upper chest, …), with "Hip flexors" added. The anatomical English names are the common anatomy names (Pectoralis major, …, Iliopsoas).

- **Catalogue mapping** (`src/data/exercise-muscles.ts`):
  - Hanging Leg Raise and Leg Raise: `hipFlexors: 1, abs: 1` (Hanging Leg Raise keeps `forearms: 0.5`).
  - Sit Up, Mountain Climber and V-Up get `hipFlexors: 0.5`.
  - Dead Bug is unchanged.
  - `MUSCLES_BY_NAME` still covers all 170 entries.
- **Icon zones** (`src/lib/muscle-figure.ts`): `ICON_ZONES.thighs` gains `hipFlexors`, and `VIEW_SIDE.hipFlexors = 1` (front).
- **RDL family in Legs** (E-A, D3): in `src/data/catalogue.ts`, Romanian Deadlift, Stiff Leg Deadlift and Dumbbell Romanian Deadlift get `category: "Legs"`. Ids are unchanged. Back moves to `categories` where it was the main category.

### D2. Exercise names in Swedish (F-P2.4, H2)

- Records keep the stored English `name`. The display name is new: `exerciseDisplayName(exerciseId, storedName)` in `src/lib/exercise-name.ts`. In Swedish it returns the name below for a built-in exercise, and otherwise the stored name. Your own exercises are always shown as typed.
- The English name is searchable. `exercise-search.ts` matches the Swedish name, the English name and the aliases.
- **The subtitle, everywhere an exercise row has one** (picker, Bibliotek, exercise page, D3):
  - a built-in exercise reads `utrustning · English name` ("skivstång · Bench Press");
  - your own exercise reads `utrustning · Kategori · egen` ("kabel · Bål · egen").

  This is `exerciseSubtitle(exercise)` in the same file.
- **Swedish names** (the name rule in H2: established gym names stay as the base exercise; variants put the adjective first and the equipment last with "med" when it differs from the base exercise):

  | id | sv |
  |---|---|
  | builtin:squat | Knäböj |
  | builtin:bodyweight-squat | Knäböj med kroppsvikt |
  | builtin:front-squat | Frontböj |
  | builtin:bulgarian-split-squat | Bulgarisk utfallsböj |
  | builtin:leg-press | Benpress |
  | builtin:lying-leg-curl | Liggande lårcurl |
  | builtin:bench-press | Bänkpress |
  | builtin:dumbbell-press | Bänkpress med hantlar |
  | builtin:incline-dumbbell-press | Lutande bänkpress med hantlar |
  | builtin:overhead-press | Axelpress |
  | builtin:dumbbell-shoulder-press | Sittande axelpress med hantlar |
  | builtin:lateral-raise | Sidolyft |
  | builtin:romanian-deadlift | Rumänsk marklyft |
  | builtin:dumbbell-romanian-deadlift | Rumänsk marklyft med hantlar |
  | builtin:deadlift | Marklyft |
  | builtin:barbell-row | Framåtböjd rodd |
  | builtin:seated-cable-row | Sittande rodd med kabel |
  | builtin:single-arm-dumbbell-row | Enarmsrodd med hantel |
  | builtin:lat-pulldown | Latsdrag |
  | builtin:pull-up | Chins |
  | builtin:dumbbell-curl | Bicepscurl |
  | builtin:tricep-pushdown | Tricepsnedtryck med kabel |
  | builtin:hip-thrust | Höftlyft |
  | builtin:standing-calf-raise | Stående vadpress |
  | builtin:rear-delt-fly | Omvända flyes med hantlar |
  | builtin:hanging-leg-raise | Hängande benlyft |
  | builtin:push-up | Armhävningar |
  | builtin:pallof-press | Pallofpress |
  | builtin:kettlebell-swing | Sving med kettlebell |
  | builtin:exercise-bike | Cykel |

  The table lives in `src/data/exercise-names-sv.ts`. A test checks that every key is a catalogue id.

- **Long names** (R34, H2): an exercise name over 16 characters in a page title drops from 28 px to 20 px and wraps to at most two lines. Page titles that are not exercise names stay 28 px.

### D3. RIR in a set

- The scale is **0 (max), 1, 2, 3, 4, 5+ (lätt)**.
- Storage:
  - `rir` keeps its server-checked range 0–3.
  - The new optional `rirHigh` (`4 | 5`) is valid only when `rir === 3`.
  - `rirOf(set)` in `src/lib/rir.ts` returns 0–5: `rir === 3` with a valid `rirHigh` gives 4 or 5; otherwise it gives `rir`.
  - `withRir(set, value)` stores 0–3 as `rir`, and stores 4 or 5 as `rir: 3, rirHigh: value`. Null clears both.
  - `RIR_VALUES` becomes `[0, 1, 2, 3, 4, 5]`.
  - `rirValueText(5)` is `"5+"`, and `rirValueText(3)` is `"3"`. A legacy set with `rir: 3` and no `rirHigh` reads "3+".
- `setSchema` adds `rirHigh: z.union([z.literal(4), z.literal(5)]).nullish()`. `validSet` ignores it. No `SCHEMA_VERSION` bump: the field is optional, and older apps keep unknown fields.
- **The check-time RIR chooser goes away.** `RirAsk` in `SetLine.tsx`, the chips under a just-checked row, is replaced by the pad's RIR mode (§B12). The Set sheet keeps an RIR row showing the value (§B4).

### D4. A target lowered for fatigue

- `exerciseSchema` gains an optional `fatigue: z.literal("lowered").optional()`. It is set on the workout's exercise when its target was lowered by the fatigue rule (§D10), and removed by Ångra.
- `targetHistory` / `suggestTarget` in `src/data/targets.ts` skip an earlier session whose exercise carries `fatigue: "lowered"` as the basis for the next target. They use the session before it. The session still shows under Förra. So a lowered target never counts as a missed one ("räknas inte som ett missat mål").

### D5. Per-exercise settings in the library record

New optional fields on `librarySchema`, keyed by exercise id (built-in or your own), each capped at `MAX_CARDIO_SETTINGS` entries like `weightUnits`:

- `exerciseNotes: Record<id, string ≤ 300>` holds the "Anteckning för övningen" (B7). It is shown under the exercise's heading in every workout (B3). Empty text removes the entry.
- `weightSteps: Record<id, number>`, where the number is one of `0.5, 1, 1.25, 2, 2.5, 4, 5` (kg).
  - Absent means the equipment default (`defaultWeightStep`):

    | Equipment | Default step (kg) |
    |---|---|
    | barbell, smith, cable | 2.5 |
    | dumbbell | 2 |
    | machine | 5 |
    | kettlebell | 4 |
    | bodyweight (added weight) | 1.25 |
    | band, or unknown | 2.5 |

  - The step drives the pad's −/+, the drop's −20 % rounding, the fatigue lowering, the targets (`LOAD_STEP` becomes the exercise's step in kg; lb keeps 5 lb) and the "±2,5" in the exercise heading.
- `restSeconds: Record<id, number>` holds the exercise's own rest time, 0–600. **0 means the timer is off for this exercise.** Absent means the exercise follows the rest preference (§D7).
- Helpers sit with `src/lib/exercise-units.ts`'s pattern in `src/lib/exercise-settings.ts`: `exerciseNote`, `withExerciseNote`, `weightStepOf`, `withWeightStep`, `restOf`, `withRest`.

### D6. Your own exercise: equipment, icon and category

- **Equipment is a real choice** (E3, F-P2.9). It is stored in the existing `equipment` field as one of `dumbbell` (default), `barbell`, `kettlebell`, `machine`, `cable`, `band` or `bodyweight`. The labels are "Hantel, Skivstång, Kettlebell, Maskin, Kabel, Gummiband, Kroppsvikt".
- Equipment sets:
  - the icon (`icon` = the equipment glyph id);
  - the filter;
  - the default weight step (§D5).
- The editor no longer offers a separate icon row. An existing exercise whose `icon` is `"body"` keeps the body figure until its equipment is changed.
- **The category is derived from the muscles** (E-§3, E-P6). The main category is the group with the most main muscles. A tie goes to the first group in `MUSCLE_GROUPS` order. With no main muscle, the group with the most helping muscles wins. With no muscles at all, the category is `"Other"`.
- The other groups with a main or helping muscle become `categories`. The "Tränar även" (Also trains) and Kategori fields leave the editor. The line under the map reads:
  - "Visas under **{grupp}**", plus " · även {grupper}" when there are others;
  - before anything is chosen: "Välj muskler. Övningen visas under den grupp som har flest huvudmuskler."
- **Duplicates** (F-P2.10). When the typed name matches a catalogue exercise (the existing `editor.twin` check), a message row under the name reads "Det finns redan **{namn}** i biblioteket." with two 44 px links:
  - "Öppna den" goes to the exercise page;
  - "Använd dess muskler" copies the catalogue exercise's muscles and equipment.

### D7. Preferences and their defaults

Preferences live on the device (`src/lib/preferences.ts`, `storageKeys`).

| Preference | Stored | Default | Notes |
|---|---|---|---|
| Rest timer on | new key `gt-rest-on` (`"true"` / absent) | **off** | Migration on read: no `gt-rest-on` key and a saved `restSeconds > 0` reads as **on**, with that time kept as the "all exercises" time (decision 4). |
| Rest time for all exercises | `restSeconds` (existing) | 0 = **use the tier per exercise** | A positive value is a fixed time for every exercise without its own. |
| Sound at rest end | `restSound` (existing) | on | Shown under the rest timer only while it is on. |
| Vibrate | `haptics` (existing) | off | Shown under the rest timer as "Vibrera". It vibrates when a rest ends and when a set is checked (`trainingHaptic`). |
| Ask for RIR | `askRir` (existing) | **off** | Decision 3. |
| Workout tips | new key `gt-workout-tips` | on | "Tips i passet": the warm-up and drop rows in the Set sheet. |
| Tired muscle late in the workout | new key `gt-fatigue-mode`: `off` / `suggest` / `auto` | **`suggest`** | Decision 2. |

**Rest time per exercise** is `effectiveRest(exerciseId) → seconds` (0 = no timer):

1. the exercise's own `restSeconds` from the library, if any (0 turns it off even when the timer is on);
2. otherwise 0 while the timer is off;
3. otherwise the "all exercises" time when it is positive;
4. otherwise the exercise's tier.

**Tiers** (`restTier` in `src/data/rest-tiers.ts`):

| Tier | Rest | Which exercises |
|---|---|---|
| Barbell compound | 2:30 (150 s) | Compound lifts whose equipment is barbell or smith |
| Other compound | 2:00 (120 s) | Other compound lifts |
| Isolation | 1:30 (90 s) | Exercises in `ISOLATION_EXERCISES`, a by-name set in that file covering the catalogue's single-joint lifts; for your own exercises, exactly one main muscle |

The default rest copy is "Förval: flerled med skivstång 2:30 (3:00 eller mer om du går ned mot 3–5 reps), annan flerled 2:00, isolering 1:30." Pinned by tests:

| Rest | Exercises |
|---|---|
| 150 s | Squat, Bench Press, Deadlift |
| 120 s | Bulgarian Split Squat, Leg Press, Pull Up |
| 90 s | Standing Calf Raise, Lateral Raise, Dumbbell Curl, Tricep Pushdown, Lying Leg Curl |

**Language follows the phone** (F-P1.3):

- New users (no stored language, no user data) get Swedish when `navigator.languages` starts with `sv`, and English otherwise. Nothing is stored until they choose in Settings.
- `languageOnLaunch` returns `"phone"` instead of `"default"`.
- The existing one-time prompt for devices that already hold a log stays.
- The language row's value is:
  - "Svenska, som telefonen" / "English, like the phone" while unchosen;
  - the language name once chosen.

### D8. Standard programmes (E6, E6b)

Static data lives in `src/data/programs.ts`: `PROGRAMS: Program[]`, with `Program = { id, title, category, level, daysText, minutes, why, routines: { name, exercises: { exerciseId, sets, repRange }[] }[], week: { routine: string, perWeek: number }[], schedule: (string | null)[][] }`.

`schedule` is the plan template: one array of 7 per cycle week, Monday first, holding a routine name or null.

| id | Title | Category chip | Level | Days | ~min | Weekly schedule (plan template) |
|---|---|---|---|---|---|---|
| hk | Helkropp A/B | Helkropp | Nybörjare | 3 dagar, A B A och sedan B A B | ~50 min | 2-week cycle: wk1 mån A, ons B, fre A; wk2 mån B, ons A, fre B |
| ou | Över/under 4 dagar | Över/under | Van | 4 dagar: mån, tis, tor, fre | ~60 min | mån Överkropp A, tis Underkropp A, tor Överkropp B, fre Underkropp B |
| tdb | Tryck/drag/ben | Tryck/drag/ben | Van | 6 dagar, eller 3 dagar med halva volymen | ~55 min | mån Tryck, tis Drag, ons Ben, tor Tryck, fre Drag, lör Ben |
| gs | Grundstyrka 3 dagar | Styrka | Van | 3 dagar, A B A och sedan B A B | ~60 min | as hk with Styrka A/B |
| hm | Hemma med hantlar | Hemma | Nybörjare–van | 3 dagar, A B A och sedan B A B | ~40 min | as hk with Hemma A/B |

`perWeek` per routine is 1.5 for the A/B programmes, 1 for Över/under and 2 for Tryck/drag/ben.

**"Why" texts:**

- hk: "Hela kroppen två gånger i veckan; de flesta huvudmuskler får 5–13 hårda set i veckan, nog de första månaderna. Flerledsövningar först, 1–3 reps kvar i tanken, dubbel progression."
- ou: "Varje muskel två gånger i veckan och de flesta huvudmuskler 10–18 hårda set, tunga flerled (5–8 reps) först och lättare isolering (10–20) sist."
- tdb: "Tryck, drag och ben två varv i veckan: 10–16 hårda set per huvudmuskel. Kör ett varv (3 dagar) om tiden inte räcker; då halveras volymen."
- gs: "Knäböj, bänkpress, axelpress och marklyft i 3–5 reps med längre vila (3–5 min). Fokus är styrka; mindre muskler får avsiktligt lite volym."
- hm: "Bara hantlar och kroppsvikt, utan vader. Hela kroppen två gånger i veckan; reps upp till 15–20 när hantlarna blir för lätta."

**Routines** (sets × rep range; names as in §D2):

- **Helkropp A:** Knäböj 3 × 5–8, Bänkpress 3 × 6–10, Sittande rodd med kabel 3 × 8–12, Rumänsk marklyft 2 × 8–10, Sidolyft 2 × 12–15
- **Helkropp B:** Benpress 3 × 8–12, Bänkpress med hantlar 2 × 8–12, Axelpress 3 × 6–10, Latsdrag 3 × 8–12, Höftlyft 2 × 8–12, Bicepscurl 2 × 10–15, Tricepsnedtryck med kabel 2 × 10–15, Stående vadpress 2 × 10–15
- **Överkropp A:** Bänkpress 5 × 5–8, Framåtböjd rodd 4 × 6–10, Axelpress 3 × 6–10, Sidolyft 3 × 12–20, Latsdrag 3 × 8–12, Bicepscurl 2 × 10–15, Tricepsnedtryck med kabel 2 × 10–15
- **Underkropp A:** Knäböj 4 × 5–8, Rumänsk marklyft 3 × 6–10, Bulgarisk utfallsböj 3 × 8–12, Liggande lårcurl 2 × 10–15, Stående vadpress 4 × 10–15
- **Överkropp B:** Lutande bänkpress med hantlar 3 × 8–12, Bänkpress med hantlar 4 × 8–12, Chins 3 × 6–10, Sittande rodd med kabel 3 × 10–12, Sidolyft 4 × 12–20, Omvända flyes med hantlar 3 × 12–20, Bicepscurl 2 × 10–15, Tricepsnedtryck med kabel 2 × 10–15
- **Underkropp B:** Marklyft 3 × 3–5, Benpress 3 × 10–15, Höftlyft 3 × 8–12, Liggande lårcurl 3 × 10–15, Stående vadpress 4 × 10–15, Hängande benlyft 3 × 8–15
- **Tryck:** Bänkpress 4 × 6–8, Lutande bänkpress med hantlar 3 × 8–12, Axelpress 2 × 8–10, Sidolyft 4 × 12–20, Tricepsnedtryck med kabel 3 × 10–15
- **Drag:** Chins 3 × 6–10, Framåtböjd rodd 3 × 8–10, Sittande rodd med kabel 2 × 10–12, Omvända flyes med hantlar 3 × 12–20, Bicepscurl 3 × 10–15
- **Ben:** Knäböj 3 × 5–8, Rumänsk marklyft 3 × 8–10, Benpress 2 × 10–15, Liggande lårcurl 2 × 10–15, Stående vadpress 4 × 10–15
- **Styrka A:** Knäböj 5 × 3–5, Bänkpress 5 × 3–5, Framåtböjd rodd 4 × 5–8, Tricepsnedtryck med kabel 2 × 8–12
- **Styrka B:** Knäböj 3 × 5–8, Axelpress 5 × 3–5, Marklyft 3 × 3–5, Chins 3 × 5–8
- **Hemma A:** Bulgarisk utfallsböj 4 × 8–12, Bänkpress med hantlar 3 × 8–12, Enarmsrodd med hantel 3 × 8–12, Sittande axelpress med hantlar 2 × 8–12, Sidolyft 2 × 12–20
- **Hemma B:** Rumänsk marklyft med hantlar 3 × 8–12, Armhävningar 3 × 8–20, Enarmsrodd med hantel 3 × 10–15, Höftlyft 3 × 10–15, Bicepscurl 2 × 10–15

**Weekly hard sets per main muscle** (E6b) are computed, never hard-coded: `programWeeklySets(program, musclesOf) = Σ over routines of perWeek × sets × level`, for the twelve `JUDGED_MUSCLES`. The range line is min–max over those twelve. With the app's mapping, Över/under 4 dagar gives **6,5–17,5** (rear delts 6.5, glutes 17.5), which matches the mockup. Per-muscle values may differ slightly from the mockup's demo map; the app's mapping wins.

**Routine names in the programme are the routine names stored on "+".** Routine names are free text and are not translated.

**Adding a programme ("+", or "Lägg till {n} rutiner"):**

- It writes one routine record per programme routine. Each record has:
  - `folder: program title`;
  - each exercise's `repRange`;
  - working sets (`newSet()`, section working) without weights.
- The row's + becomes ✓ (`aria-pressed`). A second tap removes the routines it added (those still in that folder and unchanged since).
- The confirmation is in the Upptäck message slot:
  - adding: "{n} rutiner från {titel} tillagda i Mina";
  - removing: "{titel} borttaget från Mina".
- "Added" is derived: a programme counts as added while a routine with `folder === title` exists for each of its routine names.

**"Gör det till ett schema"** adds the routines if needed, then opens Nytt schema (F1) with:

- the template set to the programme's `schedule`, with cells pointing at the new routine ids;
- the cycle set to the schedule's length.

### D9. Week matching: done, missed, moved (E-C5, A2, F2)

This is a pure function `matchWeek(plan, doneWorkouts, weekStartDate, today)` in `src/data/week-match.ts`. It returns, per date, `{ planned?: cell, done?: workoutIds[], state: "done" | "moved" | "missed" | "planned" | "today" | "rest", movedFrom?: date }`, plus `fulfilled: boolean` and `extras: number`.

**Matching.** The finished workouts in the week, in date order, are each matched to at most one of the week's planned workout days (cells that are workouts, after overrides) not matched yet, trying these in turn:

1. the planned day on the same date;
2. the planned day whose cell resolves to the workout's `routineId` (nearest date first);
3. the earliest unmatched planned day on or before the workout's date.

A workout matched to another date is **moved from** that date. A done workout that matches nothing is an **extra**.

**States:**

- A past planned day with no match is **missed**.
- Today's planned day with no match is **planned today**.
- A later planned day is **planned**.
- A week is **fulfilled** when every planned day in it is matched.

**Adherence** (F2) counts finished weeks of the plan (weeks before the week holding today): "{f} av {n} veckor fullföljda".

**Status word:**

- "I fas" when every finished week is fulfilled;
- otherwise "Efter schemat";
- "Före schemat" when every finished week is fulfilled and this week already has more matched workouts than planned days up to today.

The line under it is "{extras} extrapass · {total} pass totalt · den här veckan {matched} av {planned}". The total is all finished workouts in the period.

The ⓘ sheet has the title "Fullföljd vecka" and the text "En vecka är fullföljd när veckans planerade rutiner körts någon dag samma vecka. Extrapass räknas för sig och gör inte följsamheten högre."

`planAdherence` keeps its signature for its other callers but gains `weeksFulfilled`, `weeksFinished` and `extras`. The percent bands stay for the Calendar plan card.

### D10. The fatigue rule (B13)

`fatigueNote(workout, exerciseIndex, previous, musclesOf, step) → { muscle, today, before, from: SetTarget, to: SetTarget } | null` in `src/data/fatigue.ts`. Pure.

**Hard sets before the exercise.** For each main muscle (level 1) of the exercise:

- **today** is the hard sets (`isHardSet`, so checked working sets) that the exercises before it in today's workout credited to that muscle, at each exercise's level (1 or 0.5);
- **before** is the same count in the last finished workout that holds this exercise, counting the exercises before it there.

**When it shows.** A note appears when, for some main muscle, `today − before ≥ 3`. The muscle shown is the one with the largest difference; a tie goes to `MUSCLES` order. It shows only while:

- no working set of the exercise is checked;
- there is a last time;
- the exercise has a weighted target;
- the mode is not `off`.

**The lowered target** is one weight step (§D5) below the target weight, with the same reps: "22 × 8" becomes "20 × 8". It is never below 0.

**The note (mode `suggest`).** A quiet row under the exercise heading, in ink-2 with an info glyph and no coloured box:

- text: "{Muskel} har redan fått {today} hårda set i dag (förra gången {before} före den här övningen). Målet {from} kan bli tungt." The muscle is `muscleName`, capitalised ("Framsida lår");
- two 44 px links: "Sänk till {to}" and "Behåll målet".

**After a choice** the row folds away (row-out, `--gt-ease-collapse`):

- "Sänk till …" sets the weight and target of every unchecked working set of the exercise to `to`, and sets `fatigue: "lowered"` on the exercise. A toast at the workout's foot (the locked-set toast's slot) says "Målet sänkt till {to} för i dag. Räknas inte som missat." with Ångra for 5 s. Ångra puts the weights, the targets and the row back.
- "Behåll målet" only folds the row. The dismissal is kept for this workout in the draft's session state (`useRetainedDraft` / drafts), not synced.

**Mode `auto`.** The target is lowered at once, and the row reads "Målet sänkt till {to} för i dag. Räknas inte som ett missat mål." with Ångra. Ångra restores, and the row folds.

**Mode `off`.** Nothing shows.

### D11. Volume (D1, F3, F1, E6b)

`muscleVolume(workouts | plannedWeek, musclesOf)` in `src/data/muscle-volume.ts` returns sets per muscle (the `hardSetsPerMuscle` rule: level-weighted hard sets) and per-group rows built from `VOLUME_GROUPS`.

**A group row:**

- **value:** the sum of the main muscles' hard sets ("Axlar 12,5");
- **"{k} av {n} inom":** the main muscles at 10–20 ("0 av 3 inom"). A one-muscle group reads "inom" or "av 10";
- **bar:** the sum against 20 × n, with the guide band from 50 % to 100 %, the planned sum as an outline bar behind the done fill, and a ✓ mark when all are inside;
- **Core:** "bedöms inte" and "–".

**Order:** judged groups by planned sets per muscle (lowest first), then by done; then Core. Only groups where every main muscle has 0 done and 0 planned fold into one collapsed row (R5-1).

**The fold-out** lists every muscle of the group (main, then minor) in a 28 px row:

- the `muscleAnatomy` name, a thin bar, the value and "plan {p}" on one line;
- minor muscles in ink-3 with the note "Grått namn: syns på kartan, bedöms inte mot 10–20." (Core: "Bålen syns på kartan men bedöms inte mot 10–20.").

**Planned volume** (`plannedWeekVolume(plan, routines, week, musclesOf)`) comes from the working sets of the routines the plan week's cells resolve to (group and day-type cells count nothing). The same model feeds E6b.

### D12. Plan period calendar

The compact calendar's cell (12 px, 3 px gap; F1: 2 px between rows) is reused for a plan's period:

- one column per week, Monday first;
- weekday letters on the left ("M T O T F L S");
- month names above;
- under it, labels such as "v. 1", "nu" and "deload".

It is `PlanPeriodCalendar` in `src/components/plan/PlanPeriodCalendar.tsx`, built on the same grid code as Calendar's `ActivityHeatmap`, with `cell(date) → { done?, planned?, today?, deload? }`.

### D13. Sport (decisions.md, "Ny funktion: Sport")

The decisions file's choices are applied as stated; they are the coordinator's assumptions, so the owner may change them.

**The category.**

- `"Sport"` is added to `categories` in `src/data/catalogue.ts`, after `"Cardio"`. Labels: `category.Sport` "Sport" / "Sport".
- It is not a muscle group: it is not in `MUSCLE_GROUPS`.
- `isCardioExercise` and `initialSet` treat `category === "Sport"` like Cardio, so the first set is `{ measure: "cardio" }`.
- A new helper `isSport(exercise)` is true when the category is `"Sport"`, for built-in and custom exercises alike.

**Icons.**

- Sports use the cardio tint (`--gt-cat-cardio-*`), so no new tone tokens are needed.
- A new glyph `sport`, a ball with two seams, is added in `src/components/muscles/equipment-shapes.ts` in the equipment glyphs' build style (24 px, 1.8 line).
- Built-in sports show the `sport` glyph.
- Your own sport chooses `icon: "sport"` (default) or `icon: "heart"` (the cardio heart figure). Both are added to `CUSTOM_ICONS`; older apps show the dumbbell for an icon they do not know.

**Fields.**

- A sport logs one cardio set. Time is always a field.
- A sport chooses among Distans, Kalorier and Puls. These are `distance`, `calories` and `heartRate` in `CARDIO_METRICS`. Pace follows automatically when distance is on, as today. Level and incline are not offered for sports.
- A built-in sport's defaults live in `SPORT_FIELDS` in `src/lib/cardio.ts`, read by `defaultCardioFields`. Any other sport defaults to time only.
- Your own sport saves its choice in the library's `cardioFields[id]`, as cardio exercises do today.

**Standard sports.** New catalogue rows (category Sport, a new equipment value `"sport"` labelled "sport", `measure: "cardio"`). Swedish names go in `exercise-names-sv.ts`, and the muscles in `MUSCLES_BY_NAME`:

| Catalogue name (id) | sv | Fields | Muscles (1 = main, 0.5 = helping) |
|---|---|---|---|
| Alpine Skiing (`builtin:alpine-skiing`) | Alpin skidåkning | time | quads 1, glutes 1, hamstrings 0.5, adductors 0.5, abductors 0.5, abs 0.5, obliques 0.5 |
| Cross-Country Skiing (`builtin:cross-country-skiing`) | Längdskidåkning | time, distance (km) | lats 1, quads 1, glutes 1, triceps 0.5, hamstrings 0.5, calves 0.5, abs 0.5, obliques 0.5 |
| Football (`builtin:football`) | Fotboll | time, distance (km) | quads 1, hamstrings 1, glutes 0.5, calves 0.5, adductors 0.5, hipFlexors 0.5 |
| Floorball (`builtin:floorball`) | Innebandy | time | quads 1, glutes 0.5, hamstrings 0.5, calves 0.5, obliques 0.5, forearms 0.5 |
| Padel (`builtin:padel`) | Padel | time | quads 0.5, calves 0.5, frontDelts 0.5, sideDelts 0.5, forearms 0.5, obliques 0.5 |
| Tennis (`builtin:tennis`) | Tennis | time | quads 0.5, calves 0.5, frontDelts 0.5, sideDelts 0.5, forearms 0.5, obliques 0.5 |
| Swimming (`builtin:swimming`) | Simning | time, distance (m) | lats 1, upperBack 0.5, frontDelts 0.5, triceps 0.5, abs 0.5 |
| Climbing (`builtin:climbing`) | Klättring/bouldering | time | lats 1, forearms 1, biceps 1, brachialis 0.5, upperBack 0.5, abs 0.5 |
| Hiking (`builtin:hiking`) | Vandring | time, distance (km) | quads 1, glutes 1, hamstrings 0.5, calves 0.5 |
| Golf (`builtin:golf`) | Golf | time | obliques 0.5, forearms 0.5, glutes 0.5 |
| Yoga (`builtin:yoga`) | Yoga | time | abs 0.5, obliques 0.5, hamstrings 0.5, glutes 0.5 |

The aliases include the Swedish and common names ("skidor; utför; slalom", "längd; langlauf", "soccer", "floorball", "simma; sim", "bouldering; klättring; vägg", "fjäll; promenad", "padel tennis").

**Your own sport.**

- It is a custom exercise with `category: "Sport"` and `measure: "cardio"`.
- It has its fields (the `cardioFields` entry) and its muscles (`muscles`, chosen with the same Enkel/Avancerad picker as E3). Its `categories` are derived from the muscles' groups as in §D6, so filters and search still find it. Its main category stays Sport.
- It has no equipment row and no weight step.

**What counts.**

| Where | Rule |
|---|---|
| A finished sport workout | Counts as a workout everywhere workouts are counted:<ul><li>Kalender (the day is done, and the list shows it);</li><li>Train's week strip and weekly goal;</li><li>Framsteg's "Pass";</li><li>plan adherence.</li></ul> |
| Plan adherence (§D9) | It matches a planned day like any workout, by the same date first. The matched day carries `other: true` when every exercise in the workout is a sport, and shows as done. The day sheet and the F2 list say "Annan träning: {sport}". The week can be fulfilled by it. |
| Hard sets and volume | A sport set is a cardio set, so `isHardSet` already excludes it. Sports add **nothing** to the volume card, to "Set" totals or to the fatigue rule. A test pins this. |
| The muscle map | `sportMuscles(workouts, musclesOf) → Set<Muscle>`, in `src/data/muscle-map.ts`, gives the muscles a sport in the period trains (main or helping). On the week map, a muscle's heat step is `max(heatStep(sets), sportMuscles.has(m) ? 1 : 0)`, so a sport muscle shows as trained (step 1) without changing any number. When the week holds a sport, a note under "Veckans karta" reads "Sport syns på kartan men räknas inte som set." An exercise page for a sport shows its main and helping muscles like any exercise. |
| Set counts in lists | Calendar week headings ("{p} pass · {s} set") and workout rows leave sport sets out of `s`. A sport-only workout's row reads "{tid}" + " · {distans}" when one is logged, instead of "{min} min · {n} set". |

## Screens

Each item says what changes against the app today, the exact copy and where it lands. Items already in the app are marked **(in app)** and need no work beyond what is stated.

### A · Träna

**A1, first start (new user, no user data).** `src/pages/Home.tsx`, `src/components/home/TodayCard.tsx`, and a new `src/components/home/GetStarted.tsx`.

- The Today card:
  - "I dag · inget planerat";
  - the heading "Kör ditt första pass";
  - the text "Lägg till övningar medan du tränar. Allt sparas på mobilen, även utan konto.";
  - the primary button "Starta tomt pass".
- The dashed "Tomt pass" at the end of Train is hidden in this state, so it appears once (F-P3.34).
- "Kom igång" is a list of three rows with Lucide glyphs (no muscle figure):

  | Row | Subtitle | Goes to |
  |---|---|---|
  | Välj en färdig rutin | Bibliotek → Upptäck | Library → Rutiner → Upptäck |
  | Bygg en egen rutin | Övningar och set du kör ofta | the new-routine editor |
  | Lägg upp ett schema | Veckor, deload och mål | Nytt schema |

- A 56 px row "Språk · Language" with the value "Svenska, som telefonen" opens the language sheet.

**A2, the week strip** (`src/components/home/WeekCard.tsx`, `src/components/items/DayCell.tsx`, `day-cell.ts`, `items.css`):

- The heading reads "Den här veckan · {done} av {planned} pass" (one week reference; the ISO week number leaves this card).
- Day states come from `matchWeek` (§D9). The `DayCell` gains `missed` and `movedFrom: "left" | "right"`:

  | State | Look |
  |---|---|
  | Done | Filled `done` |
  | Today | 2 px accent ring |
  | Planned | **2 px `--gt-line-control` ring** (was done green) |
  | Planned today | Accent ring plus a 4 px dot under the number (no second ring) |
  | Missed | Dashed 1.5 px `--gt-line-control` ring |
  | Moved | A 20 px round `ink` corner badge with an arrow in a 3 px line |

  The moved badge sits in the corner on the side the workout came from and points the way it moved (R8-1). A workout moved later in the week has the badge top-left with the arrow pointing right; a workout moved earlier has it top-right pointing left. The badge uses the count badge's shape.

- The legend under the strip reads "Gjort · Planerat · I dag", plus "Flyttat hit från {kort veckodag}" (e.g. "Flyttat hit från mån") when the week holds a moved day.
- All days stay at least 44 × 44 px.
- The Today card reads "I dag · {plan}, vecka {n} av {N}", the routine name, and "{k} övningar · ~{min} min · senast {datum}".
- The routine badge loses its exercise count (R8-2; `RoutineBadge` no count).
- The routine rows' play button is secondary: `accent-soft` fill, accent icon, at least 3:1 (R3-1).

**A3, a workout is already running** (`src/hooks/useStartWorkout.tsx`, the start dialog):

- the title "Du har ett pass igång";
- the subline "{namn} · {k} övningar · {d} av {n} set";
- the text "Startar du ett nytt tomt pass slängs {namn} med sina övningar.";
- the buttons:
  1. primary "Fortsätt {namn}";
  2. secondary "Spara som rutin och avsluta";
  3. danger text "Släng och starta nytt", which needs a second tap: "Tryck igen för att slänga".

The Home resume card reads "Pass pågår · {tid}", the name, "{k} övningar · {d} av {n} set" and "Fortsätt passet".

### B · Passet (the workout screen)

**B1, logging a set** (`ExerciseCard.tsx`, `SetLine.tsx`, `NumberPad.tsx`, `src/lib/number-pad.ts`, `RestDock.tsx`):

- **Exercise heading:** the name, then one meta line. Line 1 is "{Utrustning} ±{steg}", plus " · kg per hand" for dumbbells and " · per ben" for single-leg exercises (Bulgarian Split Squat, Split Squat, Pistol Squat, Single Leg …). The sizes on this line are inside the type scale. Line 2 is "{min}–{max} reps · {n} set", with the working-set count live (R5-17) and no rep range when none is set. "Senast: …" and the "förra gången {n}" set-change note leave the heading (R8-3). Last time's values stay under the "Förra" column.
- **The exercise note** (§D5) shows under the heading with a note glyph: "Stånghöjd: hål 4 · skor med klack".
- The column headings are Set, Förra, the arrow column, "kg ⌄", "Reps ⌄", then RIR when on, then Klar.
  - "kg ⌄" opens Viktenhet (in app): "Gäller bara {namn}. Standardenheten för alla övningar väljer du i Inställningar."
  - "Reps ⌄" opens the rep-range sheet (§B7).
- **Fields are prefilled with the target** (F-P3.21). Only the next set shows "Mål {kg} × {reps}" under Förra (in app). With the pad open, the next row is dimmed so only the edited field carries a ring (`.set.next.dim`, R4-6, R5-15).
- **↑** is in the accent. It shows on a checked set whose Epley e1RM beats last time's (in app; check the colour token is `accent`).
- A weight raised in a set carries to the later unchecked sets of the exercise, and their targets follow (R4-17; check against `set-editing.ts`).
- **The pad header** (R11):
  - the exercise name (20/600);
  - under it, "Set {n} · Förra {värde}" (drop: "Drop efter set {n} · {note}");
  - a target chip "Mål {kg} × {reps} ({min}–{max})";
  - on the right, the field segment: "kg | Reps", or "kg | Reps | RIR" when RIR is on.
- **Pad keys:** 1 2 3 −{steg} / 4 5 6 +{steg} / 7 8 9 "Som förra passet" / , 0 ⌫ and the action key.
  - The step on −/+ is the exercise's step on kg and 1 on Reps.
  - On a drop, "Som förra passet" becomes "−20 %".
  - The action key is "Nästa ›" on kg, and on Reps when RIR is on. It is "Klar ✓" on the last field, which checks the set.
  - Copy changes: `pad.same` → "Som förra passet"; `pad.check` → "Klar"; `pad.previous` → "Förra {value}".
  - A key that cannot change the value replaces the subline for a moment with a hint: "Reps är hela tal", "Fältet är redan tomt" or "Högst fem siffror".
- **The rest dock** shows "Nästa: {övning} · set {n} · **Mål {kg} × {reps} ({intervall})**". The time left is a 3 px bar along the dock's top edge, not a fill behind the text (R6-9). When everything is checked, "Avsluta pass" has "Alla {N} set klara · {tid}" under it (in app).
- **The rest chip** shows the exercise's effective rest (§D7) or "Vila av".

**B2, swipe and a locked set:**

- A swipe deletes a set at once and the row folds, **with no Undo** (owner, round 7). The undo slot after a set swipe is removed (`SetSwipeRow` / `UndoPlaceholder` used for sets). "Lägg till set" gives a set back.
- The first tap on a checked set shakes the row (±4 px, `--gt-dur-pop`) and shows a toast at the workout's foot: "Setet är klart. Kryssa ur ✓ för att ändra värdena." The rows do not move (R5-16).
- A checked field's accessible name is "Låst – kryssa ur för att ändra".

**B3, dark theme mid-rest:** covered by B1 and tokens. The dock shows the next set's target.

**B4, the Set sheet** (`SetSheet.tsx`):

- The title is "Set {n} · {övning}", with the subline "Förra {värde} · mål {mål}".
- The first group:
  - "Lägg till uppvärmning" with the subline "Före första arbetssetet". It shows only on the first working set while unchecked, and only when "Tips i passet" is on. It opens B6.
  - "Lägg till drop" with the subline "Passar bäst på maskin och isolering · plattan öppnas på reps". It shows when "Tips i passet" is on; otherwise the row keeps the plain title only.
- Then rows "Typ" (Arbetsset), "RIR" ("{n} reps kvar i tanken" / "Välj"; only when RIR is on; it opens the pad in RIR mode) and "Belastning" (Vikt).
- Then "Radera set" in danger.
- RIR reads "2 reps kvar i tanken" (F-P3.20).
- The set shown has a thin neutral line and no blue.

**B12, RIR on the pad** (only when "Fråga efter RIR" is on):

- The set row gets a fourth box, **RIR**, after Reps. It shows "–" until filled. A tap opens the pad on RIR. A checked set's RIR box can be changed (RIR is picked after the set).
- **RIR mode** has the same header and segment. Its body is a slider (`role="slider"`, `aria-valuemin=0`, `aria-valuemax=5`, `aria-label="RIR, reps kvar i tanken"`):
  - a track with ticks at 0, 1, 2, 3, 4 and 5;
  - a 44 px thumb showing the value ("–" unset);
  - labels "0 max · 1 · 2 · 3 · 4 · 5+ lätt".
- Interaction: drag, tap the track, or the arrow keys, Home and End. It steps at each whole number. `aria-valuetext` is one of "Inte valt", "0, max", "1 rep kvar", "2 reps kvar", "3 reps kvar", "4 reps kvar" or "5 eller fler, lätt".
- The thumb moves with `--gt-dur-quick` / `--gt-ease-out`, and stands still under reduced motion.
- The description line (`aria-live="polite"`):
  - unset: "Dra reglaget eller tryck på ett värde. RIR är valfritt.";
  - 0: "Inga reps kvar: setet gick till max (≈ RPE 10).";
  - 1: "1 rep kvar i tanken (≈ RPE 9).";
  - 2: "2 reps kvar i tanken (≈ RPE 8).";
  - 3: "3 reps kvar i tanken (≈ RPE 7).";
  - 4: "4 reps kvar (≈ RPE 6).";
  - 5: "5 eller fler kvar (≈ RPE 5 eller lägre)."

  The mockup's "Räknas som ett hårt set." / "Räknas som ett halvt set i volymen." are left out because E-B3 is deferred.
- Two keys, each two columns wide: "Hoppa över" checks the set without RIR, and "Klar ✓" checks it with the value.
- **Height:** RIR mode is exactly as tall as the kg/reps pad (decision 5). The pad body has a fixed height equal to the key grid's four rows, and the slider block is laid out inside that height. A test measures both modes in Chromium and WebKit to the pixel.
- The pad's field order is kg → Reps → RIR → check. `nextPadField` in `number-pad.ts` gains RIR.

**B13, a tired muscle late in the workout:** §D10. The row sits under the heading and the note, above the column headings, and folds with `MOTION.rowOut` / `EASE.collapse`.

**B5, drops:**

- "Lägg till drop" adds the drop with the weight prefilled at −20 % of the parent, rounded to the exercise's step (60 → 50 kg on a 5 kg step). It opens the pad on reps (in app for opening; the rounding to the step is new). The drop badge is "↓" (in app).
- **Once an exercise has a drop**, its foot shows a "+ Drop" button (`aria-label` "Lägg till en drop till") beside "Lägg till set". A tap adds the next drop after the last drop at −20 % of it, rounded to the step (50 → 40). If the rounded value equals the last drop, it goes one step lower. It opens the pad on reps.
- The pad subline for a drop is "Drop {n} efter set {k} · {kg} kg förifyllt (−20 % av {förra}, steget {steg})". For the first drop: "Drop efter set {k} · {kg} kg förifyllt (−20 % avrundat till steget {steg})".

**B6, warm-up ladder** (new `src/components/workout/WarmupSheet.tsx`, `src/lib/warmup.ts`):

- The title is "Uppvärmning · {övning}", with the subline "Första arbetsset {kg} kg × {reps}".
- Four rows, each a warm-up badge "U", "{kg} kg × {reps}" and a subline:

  | Set | Load | Reps | Subline |
  |---|---|---|---|
  | 1 | Empty bar | 10 | "Tom stång" |
  | 2 | 40 % | 8 | "Per sida: {plates}" |
  | 3 | 60 % | 5 | "Per sida: {plates}" |
  | 4 | 80 % | 2 | "Per sida: {plates}" |

  Each percentage is of the first working set's weight, rounded to the exercise's step and never below the bar.
- A "Stång" segment offers 20 kg, 15 kg and 10 kg (default 20).
- The note reads "Skivor: 25, 20, 15, 10, 5, 2,5, 1,25. Uppvärmningsset räknas inte som hårda set."
- The primary button "Lägg till 4 uppvärmningsset" inserts them as warm-up sets before set 1.
- Plates per side are greedy from 25, 20, 15, 10, 5, 2.5 and 1.25, written "25 + 5".
- The bar weight and plates are stored on the device (new keys `gt-bar-kg`, `gt-plates`). "Ändra skivor" opens a ChoiceSheet of the seven plates as toggles.
- For non-barbell equipment the sheet has no Stång or plates: the rows show only "{kg} kg × {reps}", with the empty-bar row replaced by 40 %.

**B7, the exercise menu** (`ExerciseMenuSheet.tsx`). Its title is the exercise name. Top to bottom:

1. **"Anteckning för övningen"**: a text area (placeholder "Grepp, inställning, utförande"), with the hint "Visas under rubriken i varje pass." It saves to `exerciseNotes` on blur.
2. **"Repintervall"** with the subline "Rutinens intervall; annars schemats" and its value. It opens the rep-range sheet:
   - title "Repintervall";
   - subline "{övning} · dubbel progression";
   - a segment "3–5, 5–7, 6–8, 8–10, 8–12, 10–15";
   - the note "Reps upp till toppen i alla set, sedan nästa viktsteg. Ett intervall här gäller rutinen; annars gäller schemats.";
   - "Klar".
3. **"Viktsteg (kg)"**: a segment "0,5 · 1 · 1,25 · 2 · 2,5 · 4 · 5", with the note "Förval: skivstång 2,5, hantel 2, maskin 5, kettlebell 4. ±2,5 i övningshuvudet betyder att plattans − och + ändrar vikten 2,5 kg. När alla set når toppen av repintervallet går vikten upp ett steg. Har du mikroplattor, välj 0,5 eller 1." The "2,5" in that sentence is the chosen step.
4. **"Vilotid {m:ss}"**, which opens B8; then "Byt övning", "Ändra ordning" (in app) and **"Ta bort övningen"** in danger.

The existing "Fält…", "Ändra ordning på set" and other app items stay below "Ändra ordning".

**B8, the rest sheet** (`RestControl.tsx`; the rest chip opens it). Its title is "Vilotimer", with the exercise name as the subline.

- A full-row switch "Använd vilotimer". Its sub-text is "Av från start; på för den här övningen" when on only for this exercise, and otherwise "Av från start".
- "Vilotid": a one-row `Segmented` with "1:00 1:30 2:00 2:30 3:00 4:00 5:00" (R7: one row). Below it a row "Egen tid ›" opens the existing − / + `RestControl` in a nested step, in 15 s steps up to 10:00. Then the default rest note (§D7).
- "Gäller": a segment "Bara {övning i gemener} | Alla övningar".
  - "Bara …" writes `restSeconds[id]`.
  - "Alla övningar" sets the preference (timer on, the all-exercises time) and removes the exercise's own entry.
- "Ljud när vilan är slut" and "Vibrera" switches, shown while the timer is on.
- "Klar".

**B9 and B10, finishing** (`FinishSheet.tsx`, `ActiveWorkout.tsx`, `useWorkoutActions.ts`, and a new `RewardSheet.tsx`):

- **The top bar's "Avsluta"** is an outline button while any set is unchecked. Once all sets are checked it fills with the app's existing slow accent gradient (`finish-shift`, 4 s, still under reduced motion). Its colours change through the motion tokens (R8-4).
- **No checked set (mode 1):** the sheet "Inga set är ikryssade".
  - The subline is "{namn} · {k} övningar · 0 av {n} set".
  - The text is "Kryssa i de set du har gjort för att spara dem. Vill du ha övningarna till nästa gång kan du spara dem som rutin."
  - The buttons:
    1. primary "Fortsätt passet";
    2. secondary "Spara som rutin och avsluta";
    3. danger text "Släng passet", which needs a second tap ("Tryck igen för att slänga" fades in over 120 ms, red outline).
  - "Spara som rutin och avsluta" goes to Train with the message "Rutinen ”{namn}” sparad · passet avslutat" and Ångra. The routine shows under "Dina rutiner".
  - Discarding goes to Train with the message "Passet slängt" and Ångra (5 s).
- **With checked sets (mode 2):**
  - the title "Avsluta {namn}?";
  - the subline "{tid} · {d} av {n} set klara";
  - when the workout holds a record, one record row with a trophy: "**Nytt rekord · {övning} {kg} kg × {reps}**", with "Förra bästa {kg} kg × {reps}" under it. Only the strongest record is shown; more records add " · +{n} till";
  - three numbers: "{d} Set", "{volym} kg Volym" (a narrow space as the thousands separator, e.g. "6 252 kg"; one formatter everywhere) and "{tid} Tid";
  - when sets are unchecked, an info line "{n} set är inte ikryssade och sparas inte.";
  - "Anteckning (valfritt)" with the placeholder "Hur kändes det?";
  - primary "Spara passet", and danger text "Släng passet" (two taps).
  - The muscle lines, the "Spara som rutin" switch, and "Fortsätt logga" leave this sheet. "Spara som rutin" lives in mode 1 and in the workout's ⋯. Closing the sheet keeps logging.
- **Reward** (after Spara):
  - an icon pop: a trophy in `warm`, or a flag in the accent for the first workout ever (`--gt-dur-reward` 420, spring 400/22);
  - the title "Passet sparat" ("Första passet sparat!" for the first);
  - the subline "{r} rekord · {n}:a passet den här veckan" ("Nästa gång visar varje set ditt mål." for the first);
  - the same three numbers with a sheen (`--gt-dur-sheen` 600);
  - inside an active plan, a secondary button "Visa schemat {plan}" (calendar icon) going to the plan's status page;
  - primary "Klar", which goes to Train with "Passet sparat i Kalender".
  - The ordinal is "1:a, 2:a, 3:e, 4:e, 5:e, 6:e, 7:e" in Swedish and "1st, 2nd, …" in English.
  - No week row (round 7).
- The existing button animations (press, morph) stay (R8-4).

**B11, the picker** (`ExercisePickerBody.tsx`):

- Order numbers already exist **(in app)**. The number sits in a 24 px accent circle inside the 44 px target, in the order picked, and later numbers move up when one is unpicked.
- Names and subtitles follow §D2.
- The filter chips are one sideways-scrolling row: "Alla, Ben, Säte, Bröst, Rygg, Axlar, Armar, Bål, Mina". They are the same component in the picker and in Library → Övningar (R5-12), and filter together with the search.
- The first group is "Senast använda", ahead of A–Ö. Within the search results, exact matches come first, then prefix matches (check `exercise-search.ts`).
- The create row is "Skapa ”{namn}”…" (in app).

### C · Kalender

**C1** (`src/pages/History.tsx`, `src/components/HistoryCalendar.tsx`, `ActivityHeatmap.tsx`, `src/hooks/useDragSelect.ts`, `history-calendar.css`):

- **The compact calendar stays the app's** (round 7): 12 px squares, 3 px gaps, one column per week, weekday letters and months, every other month a faint tone on empty days. It scrolls sideways and starts at the latest week. Changes to it:
  - **A tap on a single day does nothing** (round 7). In the compact view `onClick` on a square is removed, and its accessible label drops "tryck för att öppna dagen". Zoom to the month view stays.
  - **Today is a 4 px accent dot in the middle of the square** (R8-8), and an `ink` dot on a done day. It is no longer a ring. The legend shows the dot.
  - **Hold-and-drag (in app)**:
    - hold 0.55 s (`LONG_PRESS_MS` = 550, in app);
    - the same column selects a week;
    - the same row selects a weekday across weeks;
    - otherwise a period.

    The selection bar reads "**{label}**", with "{n} pass" (plus " · {w} veckor" for a weekday) under it and "Rensa val" (in app). For example "Måndagar, 26 okt – 16 nov · 3 pass · 4 veckor".
- The card heading is "Senaste halvåret" with the count "{n} pass" of workouts in the map. The hint is "Håll in och dra för att välja en period, en vecka eller en veckodag över flera veckor." Under it is "{plan}: {n} pass sedan {startdatum}" when a plan is active.
- **The list** is a `Segmented` with "Gjort" (default) and "Planerat · {n}".
  - Gjort starts with this week. Week groups read "{datum–datum}" with "{p} pass · {s} set · {r} rekord". The current week is "Den här veckan", and weeks before the plan are labelled "· före schemat".
  - Weeks older than the last three fold under "Äldre veckor".
  - Planerat starts with today's planned workout.
  - A tap on a workout opens its day (in app). ‹ › step between workouts (44 px).
- **Search:** the header's search icon (`aria-label` "Sök pass") unfolds a field (placeholder "Sök pass, övning eller datum") that gets focus and filters the list as you type. The week headings count only the matches. With matches it reads "{n} pass matchar ”{q}”"; without any, "Inga pass matchar ”{q}”".

### D · Framsteg and the exercise page

**D1, Framsteg** (`src/pages/Progress.tsx`; a new `MuscleVolumeCard.tsx` replaces `MuscleSets.tsx`):

- The card "Set per muskel · den här veckan", with the subline "{veckodagar} · riktmärke 10–20 per huvudmuskel" ("mån–tor": Monday to today).
- The legend: "gjort, gruppens set · planerat · 10–20 per muskel".
- The group rows follow §D11, 44 px each, with no muscle named on the row (round 7).
- The footnote: "Siffran är gruppens set, huvudmusklerna summerade; "0 av 3 inom" räknar musklerna inom 10–20. Fäll ut en grupp för att se varje muskel."
- Planned values come from the active plan's week; without a plan, no planned bar.
- **"Nyckeltal"**: a card with the period segment "4 veckor | 12 veckor" inside the card (R-Hier 1), the line "Mot de 4 veckorna innan", and three stats "Pass ↑ n", "Set ↑ n" and "Rekord". The ↑ is in the accent.
- The header's period chip goes (it moved into the card).

**D2, the exercise page** (`src/pages/Exercise.tsx`, `src/components/exercise/ExerciseOverview.tsx`, `ExerciseHistory.tsx`):

- The header shows the 60 px avatar, the name (§D2 long-name rule) and the subtitle "{utrustning} · {English name}". The tabs Översikt / Historik / Rekord stay (in app). The tab bar marks Bibliotek (R4-2).
- **Översikt:**
  - **"Senast · {veckodag} {d} {mån}"**: two boxes side by side (R8-10):
    - "Nu · {datum}": "{sets} × {kg} kg × {reps}", "≈ {e1rm} kg 1RM";
    - "Förra · {datum}": the same for the session before.
    Under them, up to three chips for the difference: "+{n} rep", "−{x} kg", and "1RM lika" / "1RM +{x} kg". A chip with ↑ is in the accent; "lika" is neutral (E-C8, R3-9).
  - **"Nästa mål"** on an accent-soft row: "{kg} kg × {reps} ({min}–{max})".
  - "Uppskattat 1RM ≈ {x} kg." The estimate uses ink-2, normal weight and the "uppsk." marker where "Uppskattat" is not written (E-§1).
  - **The compact map row** (132 px map): the main muscles with a red dot, the helping muscles with a pink dot, and "Visa kartan". A tap opens the map in a sheet (in app as a card; it becomes a row).
  - **A small e1RM curve**: "Uppskattat 1RM", "{n} pass sedan {datum}", the curve with its start and end dates, and the final value.
  - A row at the foot: "Alla pass med {övning i gemener} finns under Historik", which switches to Historik.
  - The list of recent sessions leaves Översikt (round 7) and lives only under Historik.

**D3 and D3b, the map geometry** (`src/components/muscles/detailed-geometry.ts`, `FIGURES.m` and `FIGURES.f`). The mockup's `mockup.html` holds the target paths; port them.

- **hipFlexors:** a slim band from under the groin line (the lower edge of the obliques) running down and inwards between rectus femoris (`rFem`) and the adductors, drawn last on the front. It does not overlap them (R8-12).
- **gluteMed** (`abductors`) tucks under `gluteMax`, which is drawn after it, so the two meet in a 1.4 px line (round 7).
- **Front:**
  - abs1–abs3 as rounded tiles 0.9 units apart, abs4 wider;
  - vLat, rFem, vMed, adductors and tfl 10 % larger, obliques 4 %, pec 3 %;
  - calfFL removed, tibialis wider, calfF redrawn;
  - **soleusF removed**, leaving a gap of about 3 units (the shin bone) between tibialis and calfF (R8-11);
  - flexors, brachio and extensors 8 % larger, biceps 5 %.
- No ids change except that `soleusF` is gone. Soleus is still drawn on the back.
- Dark theme: `--gt-map-panel` #2f3746 and `--gt-map-halo` #6f7a8d as a thin outline around the figure (light: transparent).
- The exercise page's Muskler sheet shows the legend "Huvudmuskel · Hjälpmuskel · Inte tränad", then "Huvudmuskler" and "Hjälpmuskler" lists of `muscleName`.

**D4, goals** (`src/components/goals/GoalCard.tsx`). Each lift goal shows:

- "{övning} {kg} kg × {reps}", "Före {datum}", the progress bar with "{p} % av vägen", and an "Ambitiöst mål" flag when the required pace is over ≈ 1 % 1RM a week;
- "Uppskattat 1RM, kg", then three numbers in columns, each with its lift under it:
  - "Start ≈ {x}" ("{kg} kg × {r}");
  - "Nu ≈ {x}";
  - "Mål {x}";
- one line "Takt {x} kg i veckan · Krävs {y}";
- "Trolig nivå {datum} ≈ {lo}–{hi}", with ⓘ: title "Trolig nivå", text "Intervallet går från ungefär 1 % 1RM i veckan, realistiskt för en van lyftare, till din egen takt hittills, om den håller.";
- the link "Justera målet efter takten" (opens the goal editor with the projected target).

The long explanatory text box goes.

### E · Bibliotek and your own exercise

**E1, the tabs** (`src/pages/Library.tsx`):

- **The three tabs are "Rutiner · Övningar · Scheman".** Upptäck moves into Rutiner as a `Segmented` "Mina | Upptäck" (E6).
- Old links redirect in `legacy-routes.ts`:
  - `?tab=discover` opens `?view=discover`;
  - `/library/plan` opens `?tab=plans`.
  - The plan status page (`/library/plan/:id`) stays, and its back goes to Scheman.
- Övningar has the search "Sök övning", the chip row (§B11), the "Mina övningar" group first, then "A–Ö" in Swedish collation (`localeCompare(..., "sv")`). Rows use §D2's subtitle.
- Your own exercises keep their equipment glyph (dumbbell default).
- Placeholders are in ink-2 (R4-Färg).

**E2, Scheman** (from `PlanPanel.tsx`; sharing is out):

- Each plan is a row:
  - the name in 15/600;
  - a status line, for example "Vecka 4 av 8 · 3 pass i veckan · deload v. 8", "Startar 21 dec · 8 veckor" or "Jun–aug · 11 av 12 veckor fullföljda";
  - a status word on its own line: "Aktivt" in the accent, "Kommande" or "Avslutat" in ink-2.
- The dashed "Nytt schema" button, with the note "Ett schema lägger rutiner på veckodagar under en period, med deload och mål. Bara ett schema är aktivt åt gången."
- The Library header's + on Scheman makes a plan.

**E3 and E4, a new exercise of your own** (`ExerciseEditorSheet.tsx`, `MusclePicker.tsx`, `src/lib/muscle-picker.ts`):

- It starts empty: no name, the dumbbell chosen, no muscles (R8). The name field has focus. The icon preview sits left of the name (R-Ikon 4). ✕ closes without saving, and "Spara övning" saves with a confirmation.
- "Utrustning": one sideways-scrolling chip row (§D6), with the note "Styr filtret, viktsteget och ikonen. Hantel är förval."
- The duplicate row (§D6).
- **"Muskler"** with the segment "Enkel | Avancerad" and the derived line (§D6). Then a two-column block:
  - **Left: the map.** One side at a time in **138 × 327 px**, with a "Fram | Bak" segment above it that flips the side. A tap on a muscle is a shortcut: it cycles Ingen → Mycket → Lite → Ingen for that muscle in Avancerad, or for its group in Enkel. The hint is "Tryck på en muskel som genväg." The column is **sticky**: it stays at the top while the list scrolls, in both Enkel and Avancerad (R8-13), with a hairline under it where the sheet's scroll passes.
  - **Right: the levels.**
    - Enkel: the seven groups (Bröst, Rygg, Axlar, Armar, Bål, Säte, Ben), each with a 44 px three-way `Segmented` "Ingen | Lite | Mycket". "Blandat" shows when a group's muscles differ (in app).
    - Avancerad: each muscle under its group heading, with `muscleName`, `muscleLatin` as the subtitle, and the same segment.
  - "Ingen" is selected-but-neutral: no accent. "Lite" and "Mycket" use the one selected look (`--gt-sel-*`).
- "Anteckning (valfritt)" with the placeholder "Grepp, inställning, utförande".
- "Spara övning".
- The machine glyph loses its lock pin (`src/components/muscles/equipment-shapes.ts`, H4).

**E5, a new routine** (`RoutinesPanel.tsx` editor):

- The name field has focus at once. There are no draft buttons before anything changes: the draft saves when the sheet closes, with the note "Stänger du bladet sparas ett utkast."
- New exercises get **3 working sets** (was 1), with the subline "3 set · mål från din historik".
- The card behind does not take a name until there is one.

**E6, Upptäck** (`DiscoverPanel.tsx`, `src/data/programs.ts`, a new `src/components/library/ProgramSheet.tsx`):

- At the top, the chips "Alla, Helkropp, Över/under, Tryck/drag/ben, Styrka, Hemma", which filter the programmes.
- The heading "Färdiga program från Gain Train", then a row per programme:
  - its avatar;
  - the title;
  - "{nivå} · {n} dagar · {k} rutiner". The mockup's "4 dagar: mån" is a cut of the days text; the row uses the day count only;
  - a round 44 px + (`aria-label` "Lägg till {titel} i Mina rutiner") that becomes ✓.
- The note: "Byggda på forskningen om volym (10–20 hårda set per muskel och vecka för den som är van), frekvens (varje muskel två gånger i veckan) och 1–3 reps kvar i tanken."
- Then the existing shared content. Signed out, it is one row: "Rutiner från andra lyftare" / "Logga in för att se delade rutiner", "Logga in", with ⓘ: "Med ett konto ser du rutiner som andra lyftare delat och kan dela dina egna. De färdiga programmen och dina pass fungerar utan konto."

**E6b, a programme** (a full-height `Sheet`):

- The subline "{nivå} · {dagar} · {min}" and the title.
- The why text.
- A card "Hårda set per huvudmuskel i veckan", with "{min}–{max} · riktmärke 10–20" and the twelve main muscles, lowest first, as `muscleName` and value.
- Each routine as a group: the exercise avatar and name, then "{sets} × {range}".
- At the foot, primary "Lägg till {n} rutiner" and secondary "Gör det till ett schema" (§D8).

### F · Schema

**F1, a new plan** (`PlanEditor.tsx`, `PlanPeriodPicker.tsx`, `PlanCycle.tsx`):

- The name placeholder is "t.ex. Vinterblock" in ink-2.
- **"Period"** is one row, "{n} veckor · {från} – {till}", that opens the existing period picker (F-P2.15). The note "Börjar dagen efter att {plan} slutar." appears when it follows another plan.
- **"Deload"** is a 44 px `Segmented` with three presets that follow the length. For 8 weeks: "Ingen | 7 + 1 | 3 + 1 två gånger".
  - The default follows the length: 6 → 5 + 1, 8 → 7 + 1 (deload in the last week), 12 → 5 + 1 twice (R-Coach 3).
  - The note: "Förval efter längden: 6 veckor 5 + 1, 8 veckor 7 + 1 (deload sista veckan), 12 veckor 5 + 1 två gånger. Lättare vikt och halva seten."
  - `withCyclePreset` and `CyclePreset` (`src/data/phase.ts`) gain the length-based presets.
- "Upprepas var": "Vecka | 2 veckor | 3 veckor".
- "Din vecka": seven 44 px day buttons (in app).
- **"Hela perioden"**: `PlanPeriodCalendar` (§D12) for the whole period, with the planned days as rings and the deload week in the deload tone. Under it, "v. 1" and "deload", the legend "Planerat · Deload", and the line "{från} – {till} · {n} pass och {d} lättare i deloadveckan". There are 2 px between rows, and the legend and lines sit closer (R8-14). It redraws when the template, period or deload changes.
- **"Planerad vecka"** (§D11 planned volume), with the subline "Hårda set per muskel från rutinernas arbetsset":
  - the map (170 px) with the legend "0 · under 5 · 5–9,5 · 10–14,5 · 15–19,5 · 20+ · set/vecka";
  - a warning box when a movement pattern has no exercise. For example "Inga dragövningar och ingen höftfällning." / "Breda ryggmuskeln, biceps och baksida lår får 0 set i veckan. Knäböj och utfallsböj tränar sätet men inte baksida lår.";
  - one or two 44 px actions, for example "Lägg till rumänsk marklyft i Benpass" and "Lägg till ett dragpass på onsdag".

  The rules for the warning live in `src/data/plan-gaps.ts`:
  - **Pull (drag)** is missing when `lats` and `upperBack` plan 0.
  - **Hip hinge (höftfällning)** is missing when `hamstrings` plans 0.
  - The muscle sentence lists the judged muscles with 0 planned, by `muscleName` (first lower-cased after the first).
  - The second sentence appears when the plan trains glutes but not hamstrings.

  The actions:
  - **hinge:** add Romanian Deadlift (3 sets, 8–10) to the routine of the plan's first lower-body day;
  - **pull:** fill the first empty weekday with a pull day type (`type:pull`), or add Seated Cable Row (3 sets) to the first routine when there is no free day.

  Each action applies to the plan and routine records, shows "✓ {done text}" in place of the link, and has Ångra in a toast.

**F2, plan status** (`src/pages/PlanStatus.tsx`, `PlanStatusCards.tsx`):

- The top card:
  - "{plan}";
  - "Vecka {n} av {N} · byggfas" or "· deload";
  - "Deload vecka {d} · slutar {datum}";
  - `PlanPeriodCalendar` for the period, with done workouts filled, today as the dot (inside the planned ring when planned today, R8-15), coming days as rings, the deload week in the deload tone, and "v. 1", "nu" and "deload" under it;
  - the legend "Gjort · Planerat · I dag · Deload".
  - **The phase bar and the week strip leave this card.**
- Adherence (§D9): "{f} av {n} veckor fullföljda" with ⓘ, the status word in the accent, and the line under it.
- **"Nästa pass · {i dag | i morgon | veckodag}"**: the routine and "{k} övningar · ~{min} min", sitting higher up than today.
- The warning row: "Planen saknar drag och höftfällning (baksida lår)." / "{muskler} får 0 planerade set i veckan.", with the link "Se volymen" scrolling to F3.

**F3, the volume card on plan status** (the same `MuscleVolumeCard` as D1):

- The heading "Set per muskel · den här veckan" with "{dagar} · riktmärke 10–20 per huvudmuskel".
- **The coach box first:** one dense row per action, a bold sentence and a 44 px link (the links' hit areas may overlap the margin, R8-16).
  - "{Muskel} 0 av 10, i dag {rutin}" → "Lägg till {övning} och {övning} i dag": add 3 sets of Romanian Deadlift and 3 sets of Lying Leg Curl to today's routine. Done: "✓ Tillagt i dagens {rutin}".
  - "{Grupp} och {grupp} 0 i veckan" → "Lägg till rodd på {dag}": add 3 sets of Seated Cable Row to the routine planned on that day. Done: "✓ Tillagt i {dagens} {rutin}".
  - Each action writes the routine record, redraws the groups and the map sheet with the new plan, and shows a message with Ångra.
  - Suggestions come from `coachSuggestions(volume, plan, today)` in `src/data/coach.ts`:
    - at most two;
    - first, a judged muscle with 0 done and today's routine planned;
    - then a group pair with 0 done and 0 planned this week, on the next planned day.
- The groups (§D11), 44 px rows with tighter line height (R8-16).
- The footnote "Gruppens set, huvudmusklerna summerade; fäll ut för varje muskel." The mockup's RIR sentence is left out with E-B3.
- **"Veckans karta"**, with "Hårda set per muskel, {dagar}" and "Visa i stort". A tap opens the map and all muscles in a sheet (R4).

**F4, stalled lifts** (`PlanStatusCards.tsx` progression card → new `StalledLifts.tsx`, `src/data/plateau.ts`):

- **"Lyft som står still"**, with "3 pass eller fler utan förbättring".
- A lift is stalled when its best e1RM has not risen in its last 3 or more sessions. The row reads "{övning}", "{kg} kg × {reps} i {n} veckor" (or "i {n} pass" under 6 weeks).
- Actions:
  - **More than 4 sessions:** "Ta ned 10 % och bygg upp". It sets the next target to −10 %, rounded to the step (40 → 35 kg on 2.5).
  - **Otherwise:** "Kör till {sets} × {top}, sedan {kg + step} kg" as text, plus "Prova +1 rep nästa pass".
  - Also "Byt variant i 4 veckor", which opens Byt övning for that exercise in the plan's routines.
  - When a front/side delt or chest muscle plans over 20 sets, a note: "{Muskel} får {n} planerade set i veckan, över riktmärket; det kan förklara platån."
- **"Utveckling sedan start"**, with "vecka 1 → nu": "{övning}" and "{start} → {nu}" (reps on both sides, R41).
- The footnote "Progression: dubbel progression i alla övningar. Repintervall och steg står i övningens meny; schemat ger förvalet och rutinens val gäller före. Deload är planerad i vecka {d}."
- The "Lägg till dubbel progression" button is gone.

### G · Inställningar

**G1** (`src/pages/Settings.tsx`, `src/components/settings/PreferenceSheets.tsx`, `RestControl.tsx`, `ThemeContext`). The account row, Data, Hjälp and Konto stay as they are. The groups in between, in this order:

1. **Utseende**
   - **"Tema"**: a full-row button with the day/night switch inside the row, and the value "Följer telefonen (ljust nu)" / "Ljust" / "Mörkt". A tap toggles day and night (650 ms, `--gt-dur-theme`). After a manual choice, the row has a link "Följ telefonen igen" that clears it.
   - **"Muskelkarta"** with the sub-text "Figuren på övningens och schemats karta" and the segment "Man | Kvinna" (in app, as a segment in the row).
2. **Träning** (app items the mockup does not draw): "Kroppsvikt" and "Veckomål" as today.
3. **Vilotimer**
   - The switch "Vilotimer", with the sub-text "Av från start. Slå på här eller per övning i passet. Förval: flerled med stång 2:30 · annan flerled 2:00 · isolering 1:30".
   - While it is on: "Ljud när vilan är slut" and "Vibrera".
   - No time control here; times are per exercise (B8).
4. **Loggning**
   - "Viktenhet", with the sub-text "Standard för alla övningar" and the value "kg"; it opens a sheet.
   - The switch "Fråga efter RIR", with the sub-text "Plattan får ett RIR-läge efter reps".
5. **Coach**
   - The switch "Tips i passet", with the sub-text "Uppvärmning och drop i setbladet".
   - "Trött muskel sent i passet", with the sub-text "En rad under övningen, aldrig en ändring av sig själv" and a `Segmented` "Av | Föreslå | Automatiskt".
6. **Allmänt**
   - "Språk · Language" with the value "Svenska, som telefonen" / "Svenska" / "English"; it opens the sheet.
   - "Visa tips igen" with its confirmation (in app).

Switches are full rows with the app's blue `.switch`.

### H · System

**H1, the one selected look** (E-P5): soft accent, a 1.5 px accent line and accent text, at least 44 px high. The tokens are `--gt-sel-bg: var(--gt-accent-soft)`, `--gt-sel-line: var(--gt-accent)` and `--gt-sel-ink: var(--gt-accent)`. `Segmented`'s pressed option, `filter-chip[aria-pressed=true]` and the level segments use it, replacing black filled chips, a blue filled pill and a blue frame with a blue label. In a level picker, "Ingen" is selected but neutral.

Colour meanings:

| Colour | Means |
|---|---|
| Green | Done and inside only |
| Accent | Actions, selected, today, next set, switches, status words, and positive changes with an arrow |
| Ink | Shortfalls in lists |
| Red | Map amount and destructive actions only |

The date tile's weekday is 12/700 (was 10/800) and its number 17/700 (was 18/800).

**H2, type:** only 12/13/15/17/20/28 and 400/600/700. The verification script measures every text node.

**H3, map tokens:**

| Token | Value |
|---|---|
| `--gt-heat-1` … `--gt-heat-5` | #fde3df, #f4978c, #ea6658, #d63a2f, #9a1f17, in both themes |
| `--gt-map-panel` (dark) | #2f3746 |
| `--gt-map-halo` | transparent (light), #6f7a8d (dark) |
| `--gt-scrim` (dark) | `rgb(10 12 16 / .58)` |

**H4, icons:**

- avatars in dark theme get stronger mixes: the circle is the tone's background darkened by half, the body 65 %, untrained 50 %, helping 78 %, and the main muscle the tone plus 15 % white. Measured: body/circle ≥ 4:1 and untrained/circle ≥ 3:1 in all nine tones;
- the figure is 34 px in the 44 px circle;
- glyphs are 24 px at a 1.8 line weight;
- the redrawn kettlebell, cable and machine (no pin) glyphs;
- the four tab labels under every tab, 12/600, with an opaque bar.

**H5, motion:**

- New token names for numbers already in the table: `--gt-dur-dock-in` 240, `--gt-dur-dock-out` 200, `--gt-dur-settle` 320 and `--gt-ease-swipe` (`EASE.swipe`). They are mirrored in `MOTION` and kept equal by `tests/motion-tokens.test.ts`.
- `--gt-dur-reward` 420 and `--gt-dur-sheen` 600 (the latter equals `MOTION.sheen`).
- The set swipe: the row goes out (220 ms, ease-in) and folds (240 ms, collapse), with no undo slot.

### S · Sport

No mockup frame draws Sport. The copy below is proposed here, following the app's tone; the owner may change it.

**"Logga sport" on Train** (`src/pages/Home.tsx`, `TodayCard.tsx`, and a new `src/components/sport/LogSportSheet.tsx`):

- A quiet row-button "Logga sport" (the Lucide `Activity` glyph) sits under the dashed "Tomt pass".
- The same action appears in Today ⋯ as "Logga sport".
- On a planned day, the day sheet (`src/components/home/DaySheet.tsx`, `usePlanDaySheet.tsx`) and Today ⋯ offer "Gjorde en sport i stället", for today or a past planned day. It opens the same sheet with that date.

**The sheet "Logga sport":**

- **Step 1 (choose).** The title "Logga sport", and the date as a chip: "I dag" or "{veckodag} {d} {mån}". A tap on the chip opens the existing past-workout date picker. Then:
  - a search field "Sök sport";
  - the group "Senast", the sports logged before, most recent first, up to five;
  - the group "Alla sporter", built-in and your own in Swedish A–Ö;
  - a last row "Ny sport", which opens the editor in sport mode.

  A row is the exercise row with the sport glyph and the subline "{fält}", for example "Tid · distans".
- **Step 2 (log).** The sport's avatar and name, then:
  - the fields as the cardio card's inputs (the same field components and number pad as a cardio set): "Tid" is required, plus the sport's other fields;
  - the line "Tränar {grupper}" (the groups of its main and helping muscles in `categoryLabel`, lower case after the first, for example "Tränar ben, säte, bål"), which shows on the map but is not counted as set;
  - "Anteckning (valfritt)";
  - the primary "Spara", disabled until Tid is above 0. Its hint is "Fyll i tiden".
  - ‹ goes back to step 1.
- **Saving** writes a completed workout through `src/data/sport.ts` `sportWorkout(...)`:
  - name: the sport's display name;
  - the chosen date;
  - `duration`: the time in whole minutes;
  - `startedAt: null`;
  - `completedAt: now`;
  - one exercise with one `measure: "cardio"` working set, `done: true`, holding the values;
  - the note;
  - inside a running plan, the plan mark (`plan: { planId, week, weeks }`) like a planned start.

  Train shows the message "{sport} sparad i Kalender" with Ångra (5 s), which deletes the record.
- It never starts a live workout, so the rest timer, the pad and the finish sheet are not involved.

**Your own sport (the editor in sport mode,** `ExerciseEditorSheet.tsx` with `mode: "sport"`**):**

- the title "Ny sport";
- "Namn" with the placeholder "t.ex. Beachvolley";
- "Fält": "Tid" always on, plus toggle chips "Distans · Kalorier · Puls";
- "Ikon": a segment "Sport | Hjärta";
- "Muskler": the picker of E3 and E4 (Enkel/Avancerad, the flip map, sticky), with the note "Syns på kartan men räknas inte som set.";
- "Anteckning (valfritt)";
- "Spara sport".

It saves the category, measure, `cardioFields`, `muscles` and `icon`. An existing sport opens the same editor from its ⋯ in Library.

**Library and picker.**

- Övningar's chip row gains "Sport" after "Bål": Alla, Ben, Säte, Bröst, Rygg, Axlar, Armar, Bål, Sport, Mina.
- Sports stay pickable in a live workout, where they log as a cardio card.
- The Library header's + on Övningar keeps making exercises; "Ny sport" lives in the Logga sport sheet and in the Sport chip's empty state ("Inga sporter än. Ny sport").

**Kalender and history.**

- A sport-only workout's row shows the sport glyph avatar, the name and "{tid}" plus " · {distans}".
- Its details show the set as the cardio line it is today.
- In the week strip and the compact calendar the day is done.

## Owner questions

These are the only open choices. Everything else above is decided.

1. **Sport copy and assumptions.** The Sport decisions were made by the coordinator, and no frame draws them. The owner should confirm:
   - the proposed copy;
   - the eleven sports' fields and muscles;
   - that sports reuse the cardio tint;
   - that the "Sport syns på kartan men räknas inte som set." note is wanted.
2. **"Höjdmeter" for sports.** It is not an existing cardio field, so it is left out. Adding it would be a new optional set field (`elevationM`). The trigger passes unknown set fields unchecked, so no migration is needed, but it would be unvalidated on the server until a migration adds a limit. Building it is the owner's call.
3. **RIR-weighted volume (E-B3)** is deferred in changes.md, so the B12 and F3 copy leaves out its volume claims. If the owner wants the rule ("RIR 5 eller mer räknas som ett halvt set"), it is one function in `muscle-volume.ts` plus the two sentences.

## Phases

The plan (`docs/superpowers/plans/2026-11-26-v6-implementation.md`) splits the work into seven PRs:

| Phase | Covers |
|---|---|
| P0 Grunden | Tokens, motion, preferences and defaults, schema fields, Swedish display names, language follows the phone, avatars and tab labels (H4), the verify harness |
| P1 Passet | B1–B13 and the picker |
| P2 Kalender, Träna och schemats kalender | A1–A3, C1, F1's period calendar and deload presets, F2's top card and adherence |
| P3 Muskler, volym och Framsteg | D1–D4, D3b, F1's Planerad vecka, F2's warning, F3, F4, H3 |
| P4 Bibliotek och egen övning | E1–E6b and the machine glyph |
| P5 Inställningar | G1 |
| P6 Sport | §D13 and §S |

P0 merges first. P1, P2, P4 and P5 run in parallel. P3 rebases on P2 for the plan files. P6 comes last.

## Interaction and motion

- Every new control is at least 44 × 44 px. Every new text uses the type scale.
- Fold-outs use `Reveal`. Messages use `MessageSlot`. Sheets use `Sheet`; the pad keeps its own sheet motion.
- Reduced motion turns movement into the 120 ms fade, and the slider thumb jumps.
- Nothing is hover-only.

## Verification

Each phase runs:

- `npm run lint && npm run typecheck && npm test && npm run build`;
- the Playwright check script `scripts/verify/run.cjs <phase>` against `vite preview`:
  - in Chromium and WebKit;
  - at 360 and 390 px, plus 1100 px for the layout check;
  - in light and dark theme;
  - with a seeded IndexedDB fixture;
  - and these checks:
    - no interactive element under 44 × 44 px;
    - no text outside 12/13/15/17/20/28 and 400/600/700;
    - no horizontal scroll;
    - no console errors;
    - the phase's own checks, listed per task in the plan.
