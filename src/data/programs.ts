// The standard programmes in Library → Rutiner → Upptäck (v6 §D8, E6, E6b):
// five science-based programmes, each a few routines, a weekly rhythm and a
// plan template. Static data; adding one writes ordinary routine records
// (src/lib/program-actions.ts). Tested in tests/programs.test.ts.
//
// Titles and routine names are stored on the routines ("+" writes the title
// as their folder and the routine names as their names), so they are fixed
// text and not translated. The level, the days and the why text are shown
// through i18n (`discover.program.<id>.*`).
import type { MessageKey } from "../i18n";
import type { MusclesOf } from "./exercise-muscles";
import type { Muscle } from "./muscles";

/**
 * The twelve main muscles judged against 10–20 hard sets a week (v6 §D1).
 * P3's JUDGED_MUSCLES (src/data/muscles.ts) is the same list; this one
 * stands in until it lands.
 */
export const PROGRAM_JUDGED: readonly Muscle[] = [
  "chest",
  "lats",
  "upperBack",
  "frontDelts",
  "sideDelts",
  "rearDelts",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "calves",
  "glutes",
];

/** The Upptäck chips' categories, in their order after "Alla". */
export const PROGRAM_CATEGORIES = [
  "full",
  "upperLower",
  "ppl",
  "strength",
  "home",
] as const;
export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];

export type ProgramExercise = {
  exerciseId: string;
  sets: number;
  repRange: { min: number; max: number };
};

export type ProgramRoutine = { name: string; exercises: ProgramExercise[] };

export type Program = {
  id: string;
  /** Fixed text: the folder its routines are added to. */
  title: string;
  category: ProgramCategory;
  /** "Nybörjare", "Van", "Nybörjare–van". */
  level: MessageKey;
  /** "3 dagar, A B A och sedan B A B". */
  daysText: MessageKey;
  /** Training days in a week, for the row's "4 dagar". */
  days: number;
  /** About how long a workout takes. */
  minutes: number;
  why: MessageKey;
  routines: ProgramRoutine[];
  /** How often each routine is done in an average week. */
  week: { routine: string; perWeek: number }[];
  /** The plan template: one row of seven (Monday first) per cycle week, routine names or null. */
  schedule: (string | null)[][];
};

const ex = (
  exerciseId: string,
  sets: number,
  min: number,
  max: number,
): ProgramExercise => ({
  exerciseId: "builtin:" + exerciseId,
  sets,
  repRange: { min, max },
});

/** A, B, A and then B, A, B on Monday, Wednesday and Friday. */
const abSchedule = (a: string, b: string) => [
  [a, null, b, null, a, null, null],
  [b, null, a, null, b, null, null],
];
const abWeek = (a: string, b: string) => [
  { routine: a, perWeek: 1.5 },
  { routine: b, perWeek: 1.5 },
];

export const PROGRAMS: readonly Program[] = [
  {
    id: "hk",
    title: "Helkropp A/B",
    category: "full",
    level: "discover.level.beginner",
    daysText: "discover.days.ab",
    days: 3,
    minutes: 50,
    why: "discover.program.hk.why",
    routines: [
      {
        name: "Helkropp A",
        exercises: [
          ex("squat", 3, 5, 8),
          ex("bench-press", 3, 6, 10),
          ex("seated-cable-row", 3, 8, 12),
          ex("romanian-deadlift", 2, 8, 10),
          ex("lateral-raise", 2, 12, 15),
        ],
      },
      {
        name: "Helkropp B",
        exercises: [
          ex("leg-press", 3, 8, 12),
          ex("dumbbell-press", 2, 8, 12),
          ex("overhead-press", 3, 6, 10),
          ex("lat-pulldown", 3, 8, 12),
          ex("hip-thrust", 2, 8, 12),
          ex("dumbbell-curl", 2, 10, 15),
          ex("tricep-pushdown", 2, 10, 15),
          ex("standing-calf-raise", 2, 10, 15),
        ],
      },
    ],
    week: abWeek("Helkropp A", "Helkropp B"),
    schedule: abSchedule("Helkropp A", "Helkropp B"),
  },
  {
    id: "ou",
    title: "Över/under 4 dagar",
    category: "upperLower",
    level: "discover.level.experienced",
    daysText: "discover.days.ou",
    days: 4,
    minutes: 60,
    why: "discover.program.ou.why",
    routines: [
      {
        name: "Överkropp A",
        exercises: [
          ex("bench-press", 5, 5, 8),
          ex("barbell-row", 4, 6, 10),
          ex("overhead-press", 3, 6, 10),
          ex("lateral-raise", 3, 12, 20),
          ex("lat-pulldown", 3, 8, 12),
          ex("dumbbell-curl", 2, 10, 15),
          ex("tricep-pushdown", 2, 10, 15),
        ],
      },
      {
        name: "Underkropp A",
        exercises: [
          ex("squat", 4, 5, 8),
          ex("romanian-deadlift", 3, 6, 10),
          ex("bulgarian-split-squat", 3, 8, 12),
          ex("lying-leg-curl", 2, 10, 15),
          ex("standing-calf-raise", 4, 10, 15),
        ],
      },
      {
        name: "Överkropp B",
        exercises: [
          ex("incline-dumbbell-press", 3, 8, 12),
          ex("dumbbell-press", 4, 8, 12),
          ex("pull-up", 3, 6, 10),
          ex("seated-cable-row", 3, 10, 12),
          ex("lateral-raise", 4, 12, 20),
          ex("rear-delt-fly", 3, 12, 20),
          ex("dumbbell-curl", 2, 10, 15),
          ex("tricep-pushdown", 2, 10, 15),
        ],
      },
      {
        name: "Underkropp B",
        exercises: [
          ex("deadlift", 3, 3, 5),
          ex("leg-press", 3, 10, 15),
          ex("hip-thrust", 3, 8, 12),
          ex("lying-leg-curl", 3, 10, 15),
          ex("standing-calf-raise", 4, 10, 15),
          ex("hanging-leg-raise", 3, 8, 15),
        ],
      },
    ],
    week: [
      { routine: "Överkropp A", perWeek: 1 },
      { routine: "Underkropp A", perWeek: 1 },
      { routine: "Överkropp B", perWeek: 1 },
      { routine: "Underkropp B", perWeek: 1 },
    ],
    schedule: [
      [
        "Överkropp A",
        "Underkropp A",
        null,
        "Överkropp B",
        "Underkropp B",
        null,
        null,
      ],
    ],
  },
  {
    id: "tdb",
    title: "Tryck/drag/ben",
    category: "ppl",
    level: "discover.level.experienced",
    daysText: "discover.days.tdb",
    days: 6,
    minutes: 55,
    why: "discover.program.tdb.why",
    routines: [
      {
        name: "Tryck",
        exercises: [
          ex("bench-press", 4, 6, 8),
          ex("incline-dumbbell-press", 3, 8, 12),
          ex("overhead-press", 2, 8, 10),
          ex("lateral-raise", 4, 12, 20),
          ex("tricep-pushdown", 3, 10, 15),
        ],
      },
      {
        name: "Drag",
        exercises: [
          ex("pull-up", 3, 6, 10),
          ex("barbell-row", 3, 8, 10),
          ex("seated-cable-row", 2, 10, 12),
          ex("rear-delt-fly", 3, 12, 20),
          ex("dumbbell-curl", 3, 10, 15),
        ],
      },
      {
        name: "Ben",
        exercises: [
          ex("squat", 3, 5, 8),
          ex("romanian-deadlift", 3, 8, 10),
          ex("leg-press", 2, 10, 15),
          ex("lying-leg-curl", 2, 10, 15),
          ex("standing-calf-raise", 4, 10, 15),
        ],
      },
    ],
    week: [
      { routine: "Tryck", perWeek: 2 },
      { routine: "Drag", perWeek: 2 },
      { routine: "Ben", perWeek: 2 },
    ],
    schedule: [["Tryck", "Drag", "Ben", "Tryck", "Drag", "Ben", null]],
  },
  {
    id: "gs",
    title: "Grundstyrka 3 dagar",
    category: "strength",
    level: "discover.level.experienced",
    daysText: "discover.days.ab",
    days: 3,
    minutes: 60,
    why: "discover.program.gs.why",
    routines: [
      {
        name: "Styrka A",
        exercises: [
          ex("squat", 5, 3, 5),
          ex("bench-press", 5, 3, 5),
          ex("barbell-row", 4, 5, 8),
          ex("tricep-pushdown", 2, 8, 12),
        ],
      },
      {
        name: "Styrka B",
        exercises: [
          ex("squat", 3, 5, 8),
          ex("overhead-press", 5, 3, 5),
          ex("deadlift", 3, 3, 5),
          ex("pull-up", 3, 5, 8),
        ],
      },
    ],
    week: abWeek("Styrka A", "Styrka B"),
    schedule: abSchedule("Styrka A", "Styrka B"),
  },
  {
    id: "hm",
    title: "Hemma med hantlar",
    category: "home",
    level: "discover.level.beginnerToExperienced",
    daysText: "discover.days.ab",
    days: 3,
    minutes: 40,
    why: "discover.program.hm.why",
    routines: [
      {
        name: "Hemma A",
        exercises: [
          ex("bulgarian-split-squat", 4, 8, 12),
          ex("dumbbell-press", 3, 8, 12),
          ex("single-arm-dumbbell-row", 3, 8, 12),
          ex("dumbbell-shoulder-press", 2, 8, 12),
          ex("lateral-raise", 2, 12, 20),
        ],
      },
      {
        name: "Hemma B",
        exercises: [
          ex("dumbbell-romanian-deadlift", 3, 8, 12),
          ex("push-up", 3, 8, 20),
          ex("single-arm-dumbbell-row", 3, 10, 15),
          ex("hip-thrust", 3, 10, 15),
          ex("dumbbell-curl", 2, 10, 15),
        ],
      },
    ],
    week: abWeek("Hemma A", "Hemma B"),
    schedule: abSchedule("Hemma A", "Hemma B"),
  },
];

export const programById = (id: string | null | undefined) =>
  PROGRAMS.find((p) => p.id === id);

/**
 * Hard sets per muscle in an average week of the programme: over its
 * routines, times a week × sets × the exercise's level for the muscle (1 for
 * a main muscle, 0.5 for a helping one), the volume card's rule.
 */
export function programWeeklySets(
  program: Program,
  musclesOf: MusclesOf,
): Partial<Record<Muscle, number>> {
  const sets: Partial<Record<Muscle, number>> = {};
  for (const { routine, perWeek } of program.week) {
    const found = program.routines.find((r) => r.name === routine);
    for (const e of found?.exercises ?? []) {
      const muscles = musclesOf(e.exerciseId);
      for (const [muscle, level] of Object.entries(muscles) as [
        Muscle,
        number,
      ][])
        sets[muscle] = (sets[muscle] ?? 0) + perWeek * e.sets * level;
    }
  }
  return sets;
}

/** The fewest and most weekly hard sets over the twelve main muscles. */
export function programRange(
  program: Program,
  musclesOf: MusclesOf,
): [number, number] {
  const sets = programWeeklySets(program, musclesOf);
  const values = PROGRAM_JUDGED.map((m) => sets[m] ?? 0);
  return [Math.min(...values), Math.max(...values)];
}

/** The twelve main muscles with their weekly hard sets, lowest first (ties in PROGRAM_JUDGED order). */
export function programMuscleRows(
  program: Program,
  musclesOf: MusclesOf,
): { muscle: Muscle; sets: number }[] {
  const sets = programWeeklySets(program, musclesOf);
  return PROGRAM_JUDGED.map((muscle) => ({ muscle, sets: sets[muscle] ?? 0 }))
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.sets - b.row.sets || a.index - b.index)
    .map(({ row }) => row);
}
