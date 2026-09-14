import { z } from "zod";
export const setSchema = z.object({
  id: z.string().uuid(),
  reps: z.number().int().min(0).max(10000).nullable(),
  weight: z.number().min(0).max(10000).nullable(),
  load: z.enum(["weight", "bodyweight", "assisted"]),
  section: z.enum(["working", "warmup", "winddown"]),
  done: z.boolean(),
});
export const exerciseSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  sets: z.array(setSchema).max(100),
});
export const workoutSchema = z.object({
  routineId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().min(0).max(1440).nullable(),
  startedAt: z.number().nullable(),
  status: z.enum(["draft", "completed"]),
  exercises: z.array(exerciseSchema).max(100),
});
export const routineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  exercises: z.array(exerciseSchema).max(100),
});
export const customSchema = z.object({
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
  section: prior?.section ?? "working",
  done: false,
});
export function validSet(s: WorkoutSet) {
  return (
    s.reps !== null &&
    s.reps > 0 &&
    Number.isInteger(s.reps) &&
    s.reps <= 10000 &&
    (s.load === "bodyweight" ||
      (s.weight !== null && s.weight >= 0 && s.weight <= 10000))
  );
}
export function validate(kind: Kind, payload: unknown): Payload {
  if (!["workout", "routine", "exercise"].includes(kind))
    throw Error("Unknown record type");
  const p = (
    kind === "workout"
      ? workoutSchema
      : kind === "routine"
        ? routineSchema
        : customSchema
  ).parse(payload);
  if (kind === "workout") {
    const w = p as Workout;
    const date = new Date(w.date + "T12:00:00");
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== w.date
    )
      throw Error("Choose a valid workout date.");
    if (
      w.status === "completed" &&
      (!w.exercises.some((e) => e.sets.some((s) => s.done)) ||
        w.exercises.some((e) => e.sets.some((s) => s.done && !validSet(s))))
    )
      throw Error("Complete at least one valid set.");
  }
  return p;
}
export const labelSet = (s: WorkoutSet) =>
  s.load === "bodyweight"
    ? "BW × " + s.reps
    : s.load === "assisted"
      ? s.weight + " kg assist × " + s.reps
      : s.weight + " kg × " + s.reps;
export const repeatExercises = (items: Exercise[]) =>
  items.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    sets: e.sets.map((s) => ({ ...s, id: crypto.randomUUID(), done: false })),
  }));
