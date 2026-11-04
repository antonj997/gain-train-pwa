# Progress and Library rework, one exercise page and a design pass — design

Date: 4 November 2026 · Status: implemented (step 5, the last of the owner's notes)

## The owner's notes

- Progress and Library have unclear roles and content. Group things more logically and make it obvious where things and functions are. Tapping something like a recent record should take you to that workout or that exercise. Look at what other apps do; Hevy is an example of good design.
- Do a general design pass so elements look and behave the same across the app. The nav bar (redone in step 3, so kept) and the historical workout view use the older design. The home page, the active workout and History show the newer design to follow.

## What Hevy and Strong do

- **One exercise screen, reachable from everywhere.** In Hevy, tapping an exercise in the exercise list, in a workout in the feed or history, or on a record opens the same exercise detail screen. It has a summary with a chart (heaviest weight, one-rep max, best set volume, session volume over time), the exercise's **History** (each workout's sets, newest first, where tapping a session opens that workout) and its **Records** (heaviest weight, best 1RM, best set volume, best session volume, and a "set records" table of the best weight per rep count). Strong has the same screen with About, History, Charts and Records tabs.
- **Routines live with training.** Both apps keep routines and folders next to the Start workout button, not with the statistics.
- **Profile / Statistics holds the aggregates**: workouts per week, volume, muscle split, and the charts across all exercises.
- **Records always point back.** A PR badge in a workout, or a record on the exercise screen, opens the workout it came from. A finished workout's screen shows a header (name, date, duration, volume, records), the exercises with their sets read-only (warm-up and drop sets marked), and the actions behind a menu.

## Decision

| Before | After | Why |
| --- | --- | --- |
| Progress → an exercise opened a sheet with the latest set, tiles, chart and session list. Library → Exercises rows did nothing for built-ins and opened the editor for custom ones. | **One exercise page at `/exercise/:id`**, a sub-page like Settings (it pushes in from the right; Back returns where you came from). Header: the name, categories (main, then the others muted), equipment, and Favourite, Hide, Edit (custom) and Share (custom). Segments **Overview · History · Records**, plus **Start workout with this exercise**. | One place for everything about an exercise, the same from every entry point, as in Hevy. A route rather than a sheet, so Back works, links can be shared within the app and a record link from inside a sheet (History details) can open it without stacking sheets. |
| — | **Overview** is the old Progress exercise sheet (latest working set, best e1RM, latest change, sessions, Heaviest lift, chart, notes); a cardio exercise shows the cardio detail. Never trained: a short empty state with Start. | Nothing removed, only moved. |
| Progress sheet had "Recorded sessions" as one-line rows. | **History**: the sessions newest first, each a card with the date, workout name and its sets in the done-row style (borderless values, a muted ×, warm-up/cool-down/drop badges). Tapping one opens that workout's details. | Hevy's History tab. Reading the sets, not just the best one, is what you want when choosing today's weights. |
| — | **Records**: best estimated 1RM, heaviest weight, most reps, best set volume and best session volume, each with its date and a link to that workout with the set highlighted; and **Most reps at each weight** (heaviest first). | Hevy's records and set-records table, adapted: reps at a weight reads more naturally for a log that thinks in "80 kg × 5". |
| Recent bests cards on Progress were static. | A card opens **that workout's details with the record set highlighted**; the exercise name on the card is a second link to the exercise page. | "If you tap a recent record you might expect to get to that workout or that exercise": both, with the workout first, because the record happened there. |
| Progress exercise rows opened the sheet. | They open the exercise page. Goal cards (lift goals) and History workout details' exercise headers do too. Library → Exercises rows open it for built-ins and custom ones alike; the star and ⋯ menu stay on the row. | Every exercise name that looks tappable goes to the same place. |
| Progress mixed stats with per-exercise detail. | **Progress = statistics and goals**: Stats (period, tiles, Recent bests, Exercises sorted by sessions) and Goals as before. | Hevy's Statistics: the aggregates, with drill-down into the exercise page. |
| Library intro and section helpers were vague. | **Library = your training setup**: Routines (the workouts you repeat), Exercises (the catalogue plus yours), Plan (phases). One short helper line under the segments says what the chosen section is for. | Hevy keeps routines next to training; ours already sit one tap from Train's routine list, so Library is the place to set them up. |
| History workout details: plain "Set 1 … 125 kg × 5" rows, actions as three big buttons at the very bottom. | **New details view**: a header with name, date, duration and sets; tiles (Sets, Volume, Time, Records); each exercise as a read-only card like the active workout's (name links to the exercise page; done rows with badges and ×); sets that set a record carry a "PR" chip; actions in a sticky footer (Repeat, Edit, Delete). A record link highlights its set. | The "historical workout view" the owner named; now the same parts as the active workout. |
| Settings/Admin had the chevron back; Auth had a text "← Back" link; 404 and "Workout not found" had no page header. | **One page header**: eyebrow + big title, with the icon-button chevron for Back where there is one. | One back style everywhere. |
| Full-size sheets had only the grab handle to close. | **Full sheets get a Close (×) icon button** in their sticky header; short sheets keep the handle and their Done buttons; long editors keep the sticky footer. | A visible, consistent way out of every big sheet. |

### Records: definitions

`exerciseRecords()` and `exerciseSessions()` in `src/data/exercise-records.ts` (pure, tested):

- Only checked, valid sets count. **Warm-ups never count.**
- **Best estimated 1RM**: Epley (`estimate`, the same as Progress), working sets, drops excluded (a drop continues its set, as in `progressFor`).
- **Heaviest weight**: the existing `heaviestLift` rule (drops count; a tie goes to more reps, then the most recent; weighted and added-weight bodyweight are not compared). `heaviestLift` now uses this module, so the Overview tile and Records agree.
- **Most reps**: reps-counted working sets, drops excluded; a tie goes to the heavier weight.
- **Most reps at each weight**: for weighted working sets, drops excluded, the most reps per weight, heaviest first (at most eight).
- **Best set volume**: weight × reps of one weighted working set, drops excluded.
- **Best session volume**: weight × reps of every weighted working set of the exercise in one workout, drops included (as the Progress volume tile counts them).
- A tie keeps the **first** time it was reached, except Heaviest weight (above). A record set in a workout is marked there only when an earlier session existed and the workout beat it, the same "first session is a starting point" rule as Recent bests.

## What moved where

- Progress exercise sheet → exercise page, Overview (unchanged content) and History (the session list, now with sets).
- Library exercise ⋯ menu actions → also on the exercise page header (the row menu stays).
- Custom exercise editing → still the Library editor; the exercise page's Edit opens it via `/library?tab=exercises&edit=<id>`.
- History details actions → sticky footer.
- Auth's text back link → the page header's chevron.

Nothing was removed.
