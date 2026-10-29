# Planning, goals, cardio, catalogue, sharing and calendar — design

Date: 29 October 2026 · Status: directions chosen by the owner (cardio fields, sharing model, sync, order A → B → D → C)

The owner's requests (in Swedish, summarised) and the decisions taken. Same working style as before: batches, pure helpers tested, one check pass per batch.

## A. Calendar and full-screen editors

- **Simple calendar:** a day with a workout is a fully filled cell (done colour, white date). With two or more workouts that day, the cell shows the count as a small number in its corner (e.g. "2").
- **View switch:** the simple/detailed selector becomes a compact icon toggle (44 px `icon-btn`) in the month header, not a full-width segmented control.
- **Clear selection:** "Show current month" becomes "Clear selection" with a suitable icon (lucide `X` or `RotateCcw`). It clears the selected day or range and returns to the current month.
- **Range selection** (from–to) is only available in the detailed calendar.
- **Full-screen editors:** screens where people spend time open as a near full-screen panel instead of a short bottom sheet. They cover the whole width and the height from the safe area + 8 px down, with a top radius of 22, a header (title + Close or Done) and their own scroll.
  - This applies to: the routine editor, the custom-exercise editor, the exercise picker, the exercise progress detail, the History workout details, and later the plan and goal editors.
  - It is a `size="full"` variant of the shared `Sheet` / `DialogContent`. Drag-to-close keeps working.
  - Short confirmations and pickers stay normal sheets.

## B. Exercises: catalogue, search, hiding, cardio

- **Catalogue:**
  - About 150 common gym exercises.
  - Each entry has `name`, `category` (Chest, Back, Shoulders, Arms, Legs, Glutes, Core, Cardio, Full body), `equipment` (barbell, dumbbell, machine, cable, bodyweight, kettlebell, band, smith, cardio machine), `aliases` (common short names such as "RDL" or "OHP", and Swedish names such as "bänkpress" or "knäböj"), and a default load/measure.
  - Existing built-in ids stay stable.
- **Search:**
  - Case-, accent- and punctuation-insensitive.
  - Every typed word must match the name, an alias, the category or the equipment.
  - Ranking: exact or prefix name matches first, then alias, then category or equipment.
  - Filter chips for category and equipment in the picker and in Library → Exercises.
  - All of this lives in a pure, tested helper.
- **Hiding:** any exercise, built-in or custom, can be hidden from the user's catalogue.
  - Hidden ones disappear from the picker and lists. A "Hidden" filter in Library shows them and can unhide them.
  - The hidden list is stored in a synced `library` record (one per user).
- **Cardio exercises** (gym machines: treadmill, rower, cross-trainer, bike, stair climber, ski erg):
  - A set with `measure: "cardio"` stores `durationSec` (required to complete), `distanceM`, `level` and `calories`. The last three are optional. Its `weight` and `reps` stay null.
  - The card for a cardio exercise uses a cardio row: badge · Time (mm:ss) · Distance (km, with decimals) · Level · kcal · ✓. The Previous column is hidden. The card header shows "Last: 20:00 · 3.2 km".
  - The Load and count sheet is not offered for cardio. The Set sheet offers type, add drop (hidden for cardio) and delete.
  - Cardio never counts in strength bests or volume.
  - Progress shows cardio time and distance per period. A cardio exercise's detail shows time and distance per session.
  - Cardio sets count as sets in "N of M sets".
- **Compatibility:**
  - `SCHEMA_VERSION` goes to 2, so older cached app versions open records containing cardio read-only instead of rejecting them.
  - The server's record validation (Supabase trigger) accepts the new measure and fields.

## D. Planning and goals

- **Placement:**
  - Library gets a third section: Routines | Exercises | **Plan**. It is always visible and nothing requires using it.
  - Train's This week card shows a small "Plan" link.
  - Progress shows a **Goals** section with "+ Add goal".
- **Day types:**
  - Built-in day types: Legs, Push, Pull, Upper, Lower, Full body, Cardio. Each maps to catalogue categories.
  - **Custom groups:** a named group (e.g. "Legday") containing chosen routines and, optionally, categories for suggestions.
  - Planning a day with a day type or group: Train shows "Today: Legday". Start offers the group's routines, or "Start with suggestions", which opens a new workout plus a picker filtered to the day type's categories.
- **Plans** (synced `plan` records):
  - A plan has a name, an exact period (start and end dates chosen as a range in the detailed calendar) and a cycle length of 1–6 weeks.
  - The template is a grid of cycle-weeks × 7 days. Each cell is a routine, a group or day type, Rest, or empty.
  - The template loops from the start date. Dated overrides take precedence.
  - Only one plan is active per date; overlapping periods are refused with a message.
  - The pure helper `plannedFor(plans, date)` is tested.
- **Goals** (synced `goal` records), independent of plans; a plan may link to goals:
  - **Bodyweight goal:** a target in kg by a date. Progress comes from bodyweight entries in the profile.
  - **Lift goal:** an exercise, a weight × reps (or an estimated 1RM) by a date, for example "Bench Press 110 kg × 1 by 1 Jan 2027". Progress is the best estimate so far against the target.
  - Shown on Progress as cards: progress bar, current best versus target, days left. When a goal is reached, the card shows "Reached on <date>".
- **Migration:** the existing local-only plan (from the previous release) is imported once into a synced `plan` record.

## C. Sharing custom exercises

- A Supabase table `shared_exercises` (owner, name, category, equipment, aliases, default load/measure, created_at).
  - Row-level security: any signed-in user can read; the owner can insert and delete their own rows.
- From a custom exercise: "Share to library" publishes it, and "Stop sharing" removes it.
- Library → Exercises gets a **Shared** filter listing others' shared exercises with "Add". Adding copies the exercise into the user's own custom exercises with `sharedFrom` set, so it keeps working if the original is unshared.
- Anything added can be hidden like any other exercise.

## Server

One migration, applied with the owner's approval, covers:
- the record kind check gaining `plan`, `goal` and `library`, plus their payload validation;
- workout and routine set validation accepting `measure = 'cardio'` and the new fields;
- the `shared_exercises` table and its policies.

## Order and batches

A (calendar + full-screen) → B (catalogue/search/hide, cardio, migration) → D (plans, groups, goals) → C (sharing). Each batch is merged after a passing check run.
