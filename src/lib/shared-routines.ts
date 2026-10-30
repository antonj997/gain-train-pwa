import { catalogueById } from "../data/catalogue";
import { ownExercises } from "../data/exercises";
import {
  setSchema,
  type CustomExercise,
  type Exercise,
  type RecordDoc,
  type Routine,
  type WorkoutSet,
} from "../data/model";

type Records = Record<string, RecordDoc>;

/** A planned set as shared: the values without ids or done state. */
export type SharedSet = Partial<
  Pick<
    WorkoutSet,
    | "reps"
    | "weight"
    | "load"
    | "measure"
    | "extraWeight"
    | "section"
    | "drop"
    | "durationSec"
    | "distanceM"
    | "level"
    | "calories"
  >
>;

/** What the recipient needs to recreate one of the sharer's own exercises. */
export type SharedCustom = {
  name: string;
  category: string;
  equipment?: string;
  aliases?: string[];
  load?: CustomExercise["load"];
  measure?: string;
  note?: string;
  /** The shared exercise row this one is, or was copied from, when there is one. */
  sharedFrom?: string;
};

/** One exercise of a shared routine: a built-in by its stable id, or a custom one by definition. */
export type SharedRoutineExercise = {
  name: string;
  builtin?: string;
  custom?: SharedCustom;
  sets: SharedSet[];
};

export type SharedRoutinePayload = {
  version: 1;
  exercises: SharedRoutineExercise[];
};

/** One shared routine as the app reads it from `shared_routine_feed()`. */
export type SharedRoutineRow = {
  id: string;
  name: string;
  note: string | null;
  /** Written by anyone who can publish: read it with `parseSharedPayload`. */
  payload: unknown;
  created_at?: string;
  /** True for rows the signed-in user published. */
  mine: boolean;
  /** The sharer's display name, when they set one. */
  by_name?: string | null;
};

/** The server's limits on a shared routine (see the shared_routines migration). */
export const SHARED_ROUTINE_LIMITS = {
  exercises: 40,
  bytes: 60_000,
  name: 100,
  note: 500,
};

export class SharedRoutineError extends Error {
  constructor(readonly reason: "tooMany" | "tooBig" | "empty") {
    super(reason);
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUILTIN = /^builtin:[a-z0-9-]{1,190}$/;
const SET_FIELDS = [
  "reps",
  "weight",
  "load",
  "measure",
  "extraWeight",
  "section",
  "drop",
  "durationSec",
  "distanceM",
  "level",
  "calories",
] as const satisfies readonly (keyof SharedSet)[];

const sharedSet = (set: WorkoutSet): SharedSet => {
  const out: Record<string, unknown> = {};
  for (const key of SET_FIELDS)
    if (set[key] !== undefined) out[key] = set[key];
  return out as SharedSet;
};

const customOf = (exercise: CustomExercise): SharedCustom => {
  const sharedFrom = exercise.sharedId ?? exercise.sharedFrom;
  return {
    name: exercise.name.trim(),
    category: exercise.category,
    ...(exercise.equipment ? { equipment: exercise.equipment } : {}),
    ...(exercise.aliases?.length ? { aliases: exercise.aliases } : {}),
    ...(exercise.load ? { load: exercise.load } : {}),
    ...(exercise.measure ? { measure: exercise.measure } : {}),
    ...(exercise.note.trim() ? { note: exercise.note.trim() } : {}),
    ...(sharedFrom ? { sharedFrom } : {}),
  };
};

/**
 * What a routine publishes: each exercise with its planned sets. Built-in
 * exercises go by their stable id; the user's own carry their definition so
 * the recipient can recreate them. Throws a SharedRoutineError when the
 * routine is beyond what the server accepts.
 */
export function buildSharedPayload(
  routine: Routine,
  records: Records,
): SharedRoutinePayload {
  if (!routine.exercises.length) throw new SharedRoutineError("empty");
  if (routine.exercises.length > SHARED_ROUTINE_LIMITS.exercises)
    throw new SharedRoutineError("tooMany");
  const exercises = routine.exercises.map((ex): SharedRoutineExercise => {
    const sets = ex.sets.map(sharedSet);
    const name = ex.name.trim();
    if (catalogueById.has(ex.exerciseId))
      return { name, builtin: ex.exerciseId, sets };
    const record = records[ex.exerciseId];
    const custom =
      record?.kind === "exercise" && !record.deleted
        ? customOf(record.payload)
        : // A deleted exercise lives on in the routine under its name.
          { name, category: "Other" };
    return { name, custom, sets };
  });
  const payload: SharedRoutinePayload = { version: 1, exercises };
  if (
    new TextEncoder().encode(JSON.stringify(payload)).length >
    SHARED_ROUTINE_LIMITS.bytes
  )
    throw new SharedRoutineError("tooBig");
  return payload;
}

/** The row to insert or update for a routine. The owner defaults to the signed-in user. */
export function toSharedRoutineInsert(routine: Routine, records: Records) {
  return {
    name: routine.name.trim(),
    note: null,
    payload: buildSharedPayload(routine, records),
  };
}

/** True when a save changes what the shared copy shows. */
export function sharedRoutineChanged(
  before: Routine,
  after: Routine,
  records: Records,
) {
  try {
    return (
      JSON.stringify(toSharedRoutineInsert(before, records)) !==
      JSON.stringify(toSharedRoutineInsert(after, records))
    );
  } catch {
    return true;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const clip = (text: unknown, max: number) =>
  typeof text === "string" ? text.trim().slice(0, max) : "";
const LOADS = ["weight", "bodyweight", "assisted"] as const;

function parseCustom(value: unknown): SharedCustom | null {
  if (!isObject(value)) return null;
  const name = clip(value.name, 100);
  if (!name) return null;
  const aliases = (Array.isArray(value.aliases) ? value.aliases : [])
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && a.length <= 100)
    .slice(0, 20);
  const equipment = clip(value.equipment, 50);
  const measure = clip(value.measure, 20);
  // A note that looks like a favourite marker would turn the copy into one.
  const note = clip(value.note, 1000).replace(/^favourite:.*$/s, "");
  const load = LOADS.find((l) => l === value.load);
  const sharedFrom =
    typeof value.sharedFrom === "string" && UUID.test(value.sharedFrom)
      ? value.sharedFrom
      : undefined;
  return {
    name,
    category: clip(value.category, 50) || "Other",
    ...(equipment ? { equipment } : {}),
    ...(aliases.length ? { aliases } : {}),
    ...(load ? { load } : {}),
    ...(measure ? { measure } : {}),
    ...(note ? { note } : {}),
    ...(sharedFrom ? { sharedFrom } : {}),
  };
}

/**
 * A planned set from a shared one, or null when it cannot be one. Values the
 * routine editor could not save are dropped instead of failing the whole add.
 */
export function parseSharedSet(value: unknown, id: string): WorkoutSet | null {
  if (!isObject(value)) return null;
  const raw: Record<string, unknown> = { id, done: false };
  for (const key of SET_FIELDS) if (key in value) raw[key] = value[key];
  raw.reps ??= null;
  raw.weight ??= null;
  raw.load ??= "weight";
  raw.section ??= "working";
  const parsed = setSchema.safeParse(raw);
  if (!parsed.success) return null;
  const set = parsed.data;
  if (set.measure === "cardio") {
    set.reps = null;
    set.weight = null;
    delete set.extraWeight;
  } else {
    if (set.extraWeight && set.load !== "bodyweight") delete set.extraWeight;
    if (set.measure === "seconds" && set.load !== "bodyweight")
      set.measure = "reps";
    if (set.extraWeight && set.weight !== null && set.weight <= 0)
      set.weight = null;
  }
  return set;
}

/**
 * The exercises of a shared payload that the app can use, with at most 100
 * sets each. Anything malformed is left out. Empty when nothing is usable.
 */
export function parseSharedPayload(payload: unknown): SharedRoutineExercise[] {
  if (!isObject(payload) || !Array.isArray(payload.exercises)) return [];
  const exercises: SharedRoutineExercise[] = [];
  for (const ex of payload.exercises.slice(0, 100)) {
    if (!isObject(ex)) continue;
    const name = clip(ex.name, 100);
    const builtin =
      typeof ex.builtin === "string" && BUILTIN.test(ex.builtin)
        ? ex.builtin
        : undefined;
    const custom = builtin ? null : parseCustom(ex.custom);
    if (!builtin && !custom) continue;
    const sets = Array.isArray(ex.sets) ? ex.sets.slice(0, 100) : [];
    exercises.push({
      name:
        name ||
        (builtin ? (catalogueById.get(builtin)?.name ?? "") : custom!.name),
      ...(builtin ? { builtin } : { custom: custom! }),
      sets: sets as SharedSet[],
    });
  }
  return exercises.filter((ex) => ex.name);
}

/** The exercise count and names a shared routine lists. */
export function sharedRoutineSummary(row: SharedRoutineRow) {
  const exercises = parseSharedPayload(row.payload);
  return { count: exercises.length, names: exercises.map((ex) => ex.name) };
}

/** A name and category compared without case and extra spaces. */
export const customKey = (name: string, category: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase() +
  "\u0000" +
  category.trim().toLocaleLowerCase();

/** What adding a shared routine saves: new custom exercises first, then the routine. */
export type SharedRoutineImport = {
  routine: Routine;
  exercises: { id: string; payload: CustomExercise }[];
};

/**
 * A copy of a shared routine for the user's own routines, pointing back at
 * the row with `sharedFrom`. The sharer's own exercises become the user's:
 * an existing one copied from the same shared exercise, or with the same name
 * and category, is reused; otherwise a new one is created (once, even when
 * the routine uses it twice). Null when nothing in the payload is usable.
 */
export function importSharedRoutine(
  row: SharedRoutineRow,
  records: Records,
  newId: () => string = () => crypto.randomUUID(),
): SharedRoutineImport | null {
  const parsed = parseSharedPayload(row.payload);
  if (!parsed.length) return null;
  const own = ownExercises(records);
  const created: SharedRoutineImport["exercises"] = [];
  const findCustom = (custom: SharedCustom) => {
    const key = customKey(custom.name, custom.category);
    const pool = [
      ...created.map((c) => ({ id: c.id, ...c.payload })),
      ...own,
    ];
    const match =
      (custom.sharedFrom &&
        pool.find(
          (e) =>
            e.sharedFrom === custom.sharedFrom ||
            e.sharedId === custom.sharedFrom,
        )) ||
      pool.find((e) => customKey(e.name, e.category) === key);
    if (match) return match.id;
    const id = newId();
    created.push({
      id,
      payload: {
        name: custom.name,
        category: custom.category,
        note: custom.note ?? "",
        favourite: false,
        ...(custom.sharedFrom ? { sharedFrom: custom.sharedFrom } : {}),
        ...(custom.equipment ? { equipment: custom.equipment } : {}),
        ...(custom.aliases ? { aliases: custom.aliases } : {}),
        ...(custom.load ? { load: custom.load } : {}),
        ...(custom.measure ? { measure: custom.measure } : {}),
      },
    });
    return id;
  };
  const exercises = parsed.map(
    (ex): Exercise => ({
      id: newId(),
      exerciseId: ex.builtin ?? findCustom(ex.custom!),
      name: ex.name,
      sets: ex.sets.flatMap((s) => parseSharedSet(s, newId()) ?? []),
    }),
  );
  return {
    routine: {
      name: clip(row.name, 100) || exercises[0].name,
      exercises,
      ...(UUID.test(row.id) ? { sharedFrom: row.id } : {}),
    },
    exercises: created,
  };
}

/** Ids of shared routines the user already has a copy of. */
export function addedRoutineIds(records: Records) {
  const ids = new Set<string>();
  for (const r of Object.values(records))
    if (r.kind === "routine" && !r.deleted && r.payload.sharedFrom)
      ids.add(r.payload.sharedFrom);
  return ids;
}
