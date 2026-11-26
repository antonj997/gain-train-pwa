// Swedish display names for the built-in exercises v6 names (spec §D2, H2).
// Records keep the stored English name; only the display follows the language
// (exercise-name.ts). The name rule: established gym names stay as the base
// exercise; variants put the adjective first and the equipment last with
// "med" when it differs from the base exercise. A test checks that every key
// is a catalogue id. The rest of the catalogue is deferred ("Skjuts upp").
export const SV_NAMES: Readonly<Record<string, string>> = {
  "builtin:squat": "Knäböj",
  "builtin:bodyweight-squat": "Knäböj med kroppsvikt",
  "builtin:front-squat": "Frontböj",
  "builtin:bulgarian-split-squat": "Bulgarisk utfallsböj",
  "builtin:leg-press": "Benpress",
  "builtin:lying-leg-curl": "Liggande lårcurl",
  "builtin:bench-press": "Bänkpress",
  "builtin:dumbbell-press": "Bänkpress med hantlar",
  "builtin:incline-dumbbell-press": "Lutande bänkpress med hantlar",
  "builtin:overhead-press": "Axelpress",
  "builtin:dumbbell-shoulder-press": "Sittande axelpress med hantlar",
  "builtin:lateral-raise": "Sidolyft",
  "builtin:romanian-deadlift": "Rumänsk marklyft",
  "builtin:dumbbell-romanian-deadlift": "Rumänsk marklyft med hantlar",
  "builtin:deadlift": "Marklyft",
  "builtin:barbell-row": "Framåtböjd rodd",
  "builtin:seated-cable-row": "Sittande rodd med kabel",
  "builtin:single-arm-dumbbell-row": "Enarmsrodd med hantel",
  "builtin:lat-pulldown": "Latsdrag",
  "builtin:pull-up": "Chins",
  "builtin:dumbbell-curl": "Bicepscurl",
  "builtin:tricep-pushdown": "Tricepsnedtryck med kabel",
  "builtin:hip-thrust": "Höftlyft",
  "builtin:standing-calf-raise": "Stående vadpress",
  "builtin:rear-delt-fly": "Omvända flyes med hantlar",
  "builtin:hanging-leg-raise": "Hängande benlyft",
  "builtin:push-up": "Armhävningar",
  "builtin:pallof-press": "Pallofpress",
  "builtin:kettlebell-swing": "Sving med kettlebell",
  "builtin:exercise-bike": "Cykel",
};
