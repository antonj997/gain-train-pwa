import { z } from "zod";
import { hasSetInputText } from "../lib/set-input";
import { hasExtraWeight } from "../lib/set-load";
export const setSchema = z.object({
  id: z.string().uuid(),
  reps: z.number().int().min(0).max(10000).nullable(),
  weight: z.number().min(0).max(10000).nullable(),
  bodyWeightKg: z.number().finite().positive().max(1000).optional(),
  extraWeight: z.boolean().optional(),
  load: z.enum(["weight", "bodyweight", "assisted"]),
  measure: z.enum(["reps", "seconds"]).optional(),
  section: z.enum(["working", "warmup", "winddown"]),
  done: z.boolean(),
});
export const exerciseSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  sets: z.array(setSchema).max(100),
});
// Records without a schemaVersion were written by version 1. Bump SCHEMA_VERSION
// when a release changes what existing fields mean; older apps then open those
// records read-only instead of saving over them.
export const SCHEMA_VERSION = 1;
const schemaVersion = z.number().int().positive().optional();
export const workoutSchema = z.object({
  schemaVersion,
  routineId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().min(0).max(1440).nullable(),
  startedAt: z.number().nullable(),
  createdAt: z.number().finite().min(0).optional(),
  completedAt: z.number().finite().min(0).optional(),
  status: z.enum(["draft", "completed"]),
  exercises: z.array(exerciseSchema).max(100),
});
export const routineSchema = z.object({
  schemaVersion,
  name: z.string().trim().min(1).max(100),
  exercises: z.array(exerciseSchema).max(100),
});
export const customSchema = z.object({
  schemaVersion,
  name: z.string().trim().min(1).max(100),
  category: z.string().max(50),
  note: z.string().max(1000),
  favourite: z.boolean().default(false),
});
export type Workout = z.infer<typeof workoutSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type WorkoutSet = z.infer<typeof setSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type CustomExercise = z.infer<typeof customSchema>;
export type Kind = "workout" | "routine" | "exercise";
export type Payload = Workout | Routine | CustomExercise;
export interface RecordDoc {
  id: string;
  kind: Kind;
  payload: Payload;
  revision: number;
  deleted: boolean;
  localVersion: number;
  dirty: boolean;
  conflict?: RemoteDoc;
}
export interface RemoteDoc {
  id: string;
  kind: Kind;
  payload: Payload;
  revision: number;
  deleted: boolean;
  change_seq: number;
}
export interface Operation {
  opId: string;
  id: string;
  kind: Kind;
  payload: Payload;
  deleted: boolean;
  baseRevision: number;
  localVersion: number;
}
export interface LocalState {
  records: Record<string, RecordDoc>;
  outbox: Operation[];
  cursor: number;
}
export const emptyState = (): LocalState => ({
  records: {},
  outbox: [],
  cursor: 0,
});
export const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
export const newSet = (prior?: WorkoutSet): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: prior?.reps ?? null,
  weight: prior?.weight ?? null,
  load: prior?.load ?? "weight",
  ...(prior?.measure ? { measure: prior.measure } : {}),
  ...(prior?.extraWeight !== undefined
    ? { extraWeight: prior.extraWeight }
    : {}),
  section: prior?.section ?? "working",
  done: false,
});
export function validSet(s: WorkoutSet) {
  return (
    !hasSetInputText(s) &&
    s.reps !== null &&
    s.reps > 0 &&
    Number.isInteger(s.reps) &&
    s.reps <= 10000 &&
    (s.measure !== "seconds" || s.load === "bodyweight") &&
    (s.extraWeight !== true || s.load === "bodyweight") &&
    (!hasExtraWeight(s) ||
      (s.weight !== null &&
        Number.isFinite(s.weight) &&
        s.weight > 0 &&
        s.weight <= 10000)) &&
    (s.load === "bodyweight" ||
      (s.weight !== null && s.weight >= 0 && s.weight <= 10000))
  );
}
export class RecordValidationError extends Error {}

/** True when a newer app version saved this record; this version must not overwrite it. */
export const isFromNewerApp = (payload: unknown) =>
  ((payload as { schemaVersion?: unknown } | null)?.schemaVersion as number) >
  SCHEMA_VERSION;

const editorOnlyFields = new Set(["inputText"]);
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// zod drops keys it does not know. Copy them back so fields added by a newer app
// version survive when this version saves the record. Editor-only state never does.
export function keepUnknownFields<T>(original: unknown, parsed: T): T {
  if (Array.isArray(parsed))
    return (
      Array.isArray(original)
        ? parsed.map((item, i) => keepUnknownFields(original[i], item))
        : parsed
    ) as T;
  if (!isPlainObject(parsed) || !isPlainObject(original)) return parsed;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(original))
    if (!(key in parsed) && !editorOnlyFields.has(key)) result[key] = value;
  for (const [key, value] of Object.entries(parsed))
    result[key] = keepUnknownFields(original[key], value);
  return result as T;
}

export function validate(kind: Kind, payload: unknown): Payload {
  if (!["workout", "routine", "exercise"].includes(kind))
    throw new RecordValidationError("Unknown record type.");
  const result = (
    kind === "workout"
      ? workoutSchema
      : kind === "routine"
        ? routineSchema
        : customSchema
  ).safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.at(-1);
    const candidate = payload as { exercises?: Exercise[] };
    const candidateSet =
      candidate?.exercises?.[Number(issue.path[1])]?.sets?.[
        Number(issue.path[3])
      ];
    if (field === "weight" && candidateSet && hasExtraWeight(candidateSet))
      throw new RecordValidationError(
        "Added weight must be greater than 0 and no more than 10000 kg, or blank for an unfinished set.",
      );
    const messages: Record<string, string> = {
      name: "Enter a name between 1 and 100 characters.",
      date: "Choose a valid workout date.",
      duration:
        "Duration must be a whole number from 0 to 1440 minutes, or blank.",
      weight: "Weight must be a number from 0 to 10000 kg, or blank.",
      bodyWeightKg:
        "Bodyweight must be greater than 0 and no more than 1000 kg.",
      extraWeight: "Choose whether this bodyweight set uses extra weight.",
      measure: "Choose reps or seconds for this set.",
      load: "Choose weight, bodyweight or assisted load.",
      section: "Choose working, warm-up or cool-down for this set.",
      exercises: "Use no more than 100 exercises in a session.",
      sets: "Use no more than 100 sets per exercise.",
    };
    if (field === "reps") {
      const timed = candidateSet?.measure === "seconds";
      throw new RecordValidationError(
        `${timed ? "Seconds" : "Reps"} must be a whole number from 0 to 10000, or blank.`,
      );
    }
    throw new RecordValidationError(
      messages[String(field)] ?? "Check the record details before saving.",
    );
  }
  const p = keepUnknownFields(payload, result.data);
  if (kind === "workout" || kind === "routine") {
    if (
      (payload as Workout | Routine).exercises.some((ex) =>
        ex.sets.some(hasSetInputText),
      )
    )
      throw new RecordValidationError(
        "Finish entering the set values before saving.",
      );
    for (const ex of (p as Workout | Routine).exercises) {
      for (const s of ex.sets) {
        if (s.extraWeight === true && s.load !== "bodyweight")
          throw new RecordValidationError(
            "Extra weight is available for bodyweight sets only.",
          );
        if (hasExtraWeight(s) && s.weight !== null && s.weight <= 0)
          throw new RecordValidationError(
            "Added weight must be greater than 0 and no more than 10000 kg.",
          );
        if (s.measure === "seconds" && s.load !== "bodyweight")
          throw new RecordValidationError(
            "Timed sets use bodyweight. Choose bodyweight to log seconds.",
          );
        if (s.done && !validSet(s))
          throw new RecordValidationError(
            "Checked sets need positive reps or seconds and a valid weight or bodyweight load. Uncheck the set to leave it unfinished.",
          );
      }
    }
  }
  if (kind === "workout") {
    const w = p as Workout;
    const date = new Date(w.date + "T12:00:00Z");
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== w.date
    )
      throw new RecordValidationError("Choose a valid workout date.");
    if (
      w.status === "completed" &&
      !w.exercises.some((e) => e.sets.some((s) => s.done))
    )
      throw new RecordValidationError(
        "Complete at least one valid set. Checked sets need reps or seconds and a valid load.",
      );
  }
  return p;
}
export const labelSet = (s: WorkoutSet) =>
  hasExtraWeight(s)
    ? `BW + ${s.weight} kg${s.measure === "seconds" ? ` · ${s.reps} sec` : ` × ${s.reps}`}`
    : s.measure === "seconds"
      ? s.reps + " sec"
      : s.load === "bodyweight"
        ? "BW × " + s.reps
        : s.load === "assisted"
          ? s.weight + " kg assist × " + s.reps
          : s.weight + " kg × " + s.reps;
export const repeatExercises = (items: Exercise[]) =>
  items.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    sets: e.sets.map((s) => newSet(s)),
  }));
