// Adding and removing a standard programme, and making a plan of it (v6
// §D8). Adding writes ordinary routine records in a folder named after the
// programme; "added" is derived from them, so nothing new is stored. Pure,
// so it is tested (tests/program-actions.test.ts).
import { catalogueById } from "../data/catalogue";
import type { Plan, Routine, WorkoutSet } from "../data/model";
import { shiftDate } from "./dates";
import { initialSet } from "../data/workouts";
import type { Program } from "../data/programs";

/** A routine record as the store hands it over. */
type RoutineRow = {
  id: string;
  payload: Pick<Routine, "name" | "exercises" | "folder">;
  deleted?: boolean;
};

/**
 * The programme's routines as they are saved on "+": one per programme
 * routine, in the programme's folder (its title), each exercise with its rep
 * range and that many working sets without weights or reps, with new ids.
 */
export function programRoutines(
  program: Program,
  newId: () => string = () => crypto.randomUUID(),
): Routine[] {
  return program.routines.map((routine) => ({
    name: routine.name,
    folder: program.title,
    exercises: routine.exercises.map((e) => ({
      id: newId(),
      exerciseId: e.exerciseId,
      name: catalogueById.get(e.exerciseId)?.name ?? e.exerciseId,
      repRange: { ...e.repRange },
      sets: Array.from({ length: e.sets }, () => ({
        ...initialSet(e.exerciseId),
        id: newId(),
      })),
    })),
  }));
}

const live = (rows: readonly RoutineRow[]) => rows.filter((r) => !r.deleted);

/** Whether a routine with the programme's folder exists for each of its routine names. */
export function isProgramAdded(
  program: Program,
  routines: readonly RoutineRow[],
): boolean {
  const inFolder = live(routines).filter(
    (r) => r.payload.folder === program.title,
  );
  return program.routines.every((routine) =>
    inFolder.some((r) => r.payload.name === routine.name),
  );
}

/** A set as "+" saves it, without its id and done flag; key order fixed. */
function setShape(set: WorkoutSet) {
  const { id: _id, done: _done, ...rest } = set;
  return Object.fromEntries(
    Object.entries(rest)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** What a routine holds, ids left out, to tell whether it changed. */
const shape = (routine: Pick<Routine, "name" | "exercises" | "folder">) =>
  JSON.stringify({
    name: routine.name,
    folder: routine.folder ?? null,
    exercises: routine.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      repRange: e.repRange ? [e.repRange.min, e.repRange.max] : null,
      sets: e.sets.map(setShape),
    })),
  });

/**
 * The routines a second tap on ✓ removes: those still in the programme's
 * folder, named as one of its routines and unchanged since they were added
 * (the same exercises, rep ranges and sets, ids aside). A routine the user
 * edited stays. `added` (routine id → programme routine name), when given,
 * narrows the choice to the routines that tap added.
 */
export function routinesToRemove(
  program: Program,
  routines: readonly RoutineRow[],
  added?: ReadonlyMap<string, string>,
): string[] {
  const fresh = new Map(
    programRoutines(program, () => "").map((r) => [r.name, shape(r)]),
  );
  return live(routines)
    .filter(
      (r) =>
        (!added || added.has(r.id)) &&
        r.payload.folder === program.title &&
        fresh.get(r.payload.name) === shape(r.payload),
    )
    .map((r) => r.id);
}

/**
 * Nytt schema from a programme: its title as the name, the cycle as long as
 * its schedule, and each scheduled day pointing at the routine of that name
 * (`routineIds`, name → id; a missing one leaves the day empty). The period
 * is `base`'s (the next free one, from defaultNewPlan), else eight weeks from
 * `today`.
 */
export function programPlanDraft(
  program: Program,
  routineIds: Readonly<Record<string, string>>,
  today: string,
  base?: Pick<Plan, "startDate" | "endDate">,
): Plan {
  const startDate = base?.startDate ?? today;
  return {
    name: program.title,
    startDate,
    endDate: base?.endDate ?? shiftDate(startDate, 8 * 7 - 1),
    cycleWeeks: program.schedule.length,
    template: program.schedule.map((week) =>
      week.map((name) => (name ? (routineIds[name] ?? null) : null)),
    ),
    overrides: {},
    goalIds: [],
  };
}
