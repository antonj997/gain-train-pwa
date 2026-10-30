import { z } from "zod";
import { hasSetInputText } from "../lib/set-input";
import { hasExtraWeight } from "../lib/set-load";
import { isIsoDay, isoDate } from "../lib/dates";
import { CARDIO_MAX, cardioLabel } from "../lib/cardio";
import { normalizeDrops } from "./drops";
import { formatDecimal, t } from "../i18n";
export const setSchema = z.object({
  id: z.string().uuid(),
  reps: z.number().int().min(0).max(10000).nullable(),
  weight: z.number().min(0).max(10000).nullable(),
  bodyWeightKg: z.number().finite().positive().max(1000).optional(),
  extraWeight: z.boolean().optional(),
  load: z.enum(["weight", "bodyweight", "assisted"]),
  measure: z.enum(["reps", "seconds", "cardio"]).optional(),
  /** Cardio sets (gym machines) only: reps and weight stay null. */
  durationSec: z.number().int().min(0).max(CARDIO_MAX.durationSec).nullish(),
  distanceM: z.number().finite().min(0).max(CARDIO_MAX.distanceM).nullish(),
  level: z.number().finite().min(0).max(CARDIO_MAX.level).nullish(),
  calories: z.number().finite().min(0).max(CARDIO_MAX.calories).nullish(),
  section: z.enum(["working", "warmup", "winddown"]),
  done: z.boolean(),
  /** Continues the set above at a lower weight. See drops.ts. */
  drop: z.boolean().optional(),
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
// 2: cardio sets (measure "cardio" with durationSec, distanceM, level, calories).
export const SCHEMA_VERSION = 2;
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
  /** Id of this routine's row in shared_routines while it is shared. */
  sharedId: z.string().uuid().optional(),
  /** Id of the shared routine this one was copied from. It works without that row. */
  sharedFrom: z.string().uuid().optional(),
});
export const customSchema = z.object({
  schemaVersion,
  name: z.string().trim().min(1).max(100),
  category: z.string().max(50),
  note: z.string().max(1000),
  favourite: z.boolean().default(false),
  /** Id of this exercise's row in shared_exercises while it is shared. */
  sharedId: z.string().uuid().optional(),
  /** Id of the shared row this exercise was copied from. It works without that row. */
  sharedFrom: z.string().uuid().optional(),
  /** Copied from a shared exercise; used by search. */
  equipment: z.string().max(50).optional(),
  aliases: z.array(z.string().max(100)).max(20).optional(),
  load: z.enum(["weight", "bodyweight", "assisted"]).optional(),
  measure: z.string().max(20).optional(),
});
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isIsoDay);

/** One day of a plan: a routine id, "rest", a day type or group (see part D), or nothing. */
const planCell = z.string().min(1).max(100).nullable();
export const planSchema = z
  .object({
    schemaVersion,
    name: z.string().trim().min(1).max(100),
    startDate: isoDay,
    endDate: isoDay,
    cycleWeeks: z.number().int().min(1).max(6),
    /** cycleWeeks rows of seven days, Monday first. The rows repeat from startDate. */
    template: z.array(z.array(planCell).length(7)).min(1).max(6),
    /** ISO date to cell. A dated cell replaces the template for that day. */
    overrides: z.record(isoDay, planCell),
    goalIds: z.array(z.string().uuid()).max(50),
  })
  .superRefine((plan, ctx) => {
    if (plan.endDate < plan.startDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "end" });
    if (plan.template.length !== plan.cycleWeeks)
      ctx.addIssue({ code: "custom", path: ["template"], message: "weeks" });
  });

export const goalSchema = z
  .object({
    schemaVersion,
    kind: z.enum(["bodyweight", "lift"]),
    /** Bodyweight goal: the weight to reach. Lift goal: the weight to lift. */
    targetKg: z.number().finite().positive().max(10000),
    /** Lift goal: the exercise, and the reps the weight is lifted for. */
    exerciseId: z.string().min(1).max(200).optional(),
    exerciseName: z.string().trim().min(1).max(100).optional(),
    reps: z.number().int().min(1).max(1000).optional(),
    /** True when the target is an estimated one-rep max rather than a set. */
    estimated: z.boolean().optional(),
    /** Bodyweight goal: the weight when the goal was set, the progress bar's start. */
    startKg: z.number().finite().positive().max(1000).optional(),
    byDate: isoDay,
    createdAt: z.number().finite().min(0),
    /** Set when the goal is reached. */
    reachedOn: isoDay.optional(),
  })
  .superRefine((goal, ctx) => {
    if (goal.kind === "lift" && !goal.exerciseId)
      ctx.addIssue({ code: "custom", path: ["exerciseId"], message: "lift" });
  });

/** A named day for plans, such as "Legday": routines to start and categories to suggest from. */
export const groupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  routineIds: z.array(z.string().uuid()).max(50),
  categories: z.array(z.string().min(1).max(50)).max(20),
});

/** The user's synced exercise settings and routine groups. One record per account. */
export const librarySchema = z.object({
  schemaVersion,
  hiddenExerciseIds: z.array(z.string().min(1).max(200)).max(5000),
  groups: z.array(groupSchema).max(50).optional(),
});

export type Workout = z.infer<typeof workoutSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type WorkoutSet = z.infer<typeof setSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type CustomExercise = z.infer<typeof customSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Library = z.infer<typeof librarySchema>;
export type RoutineGroup = z.infer<typeof groupSchema>;
export type Kind =
  "workout" | "routine" | "exercise" | "plan" | "goal" | "library";
export type Payload =
  Workout | Routine | CustomExercise | Plan | Goal | Library;
interface RecordBase {
  id: string;
  revision: number;
  deleted: boolean;
  localVersion: number;
  dirty: boolean;
  conflict?: RemoteDoc;
  /** Set when the server refused this change; it is resent after the next edit or a retry. */
  syncError?: string;
}
// Checking `kind` narrows `payload`, so callers need no casts.
export type WorkoutRecord = RecordBase & { kind: "workout"; payload: Workout };
export type RoutineRecord = RecordBase & { kind: "routine"; payload: Routine };
export type ExerciseRecord = RecordBase & {
  kind: "exercise";
  payload: CustomExercise;
};
export type PlanRecord = RecordBase & { kind: "plan"; payload: Plan };
export type GoalRecord = RecordBase & { kind: "goal"; payload: Goal };
export type LibraryRecord = RecordBase & { kind: "library"; payload: Library };
export type RecordDoc =
  | WorkoutRecord
  | RoutineRecord
  | ExerciseRecord
  | PlanRecord
  | GoalRecord
  | LibraryRecord;

/** Every record kind this version understands. Older versions park the others. */
export const recordKinds = [
  "workout",
  "routine",
  "exercise",
  "plan",
  "goal",
  "library",
] as const satisfies readonly Kind[];

/** A short name for lists and messages; goals and library records have none. */
export function recordLabel(record: RecordDoc | RemoteDoc) {
  const p = record.payload as { name?: unknown };
  if (typeof p.name === "string") return p.name;
  return record.kind === "goal"
    ? t("kind.goal")
    : record.kind === "library"
      ? t("kind.library")
      : t("kind.record");
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
  /** Downloaded rows this version could not read; retried on every sync. */
  quarantine?: Record<string, RemoteDoc>;
}
export const emptyState = (): LocalState => ({
  records: {},
  outbox: [],
  cursor: 0,
});
export const today = () => isoDate(new Date());
export const newSet = (prior?: WorkoutSet): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: prior?.reps ?? null,
  weight: prior?.weight ?? null,
  load: prior?.load ?? "weight",
  // A cardio set starts blank: the time and distance are not copied.
  ...(prior?.measure ? { measure: prior.measure } : {}),
  ...(prior?.extraWeight !== undefined
    ? { extraWeight: prior.extraWeight }
    : {}),
  section: prior?.section ?? "working",
  done: false,
  ...(prior?.drop ? { drop: true } : {}),
});
const inRange = (value: number | null | undefined, max: number) =>
  value === null ||
  value === undefined ||
  (Number.isFinite(value) && value >= 0 && value <= max);
/** A cardio set has a time and no reps or weight; its other values are optional. */
function validCardioSet(s: WorkoutSet) {
  return (
    !hasSetInputText(s) &&
    s.reps === null &&
    s.weight === null &&
    typeof s.durationSec === "number" &&
    Number.isInteger(s.durationSec) &&
    s.durationSec > 0 &&
    s.durationSec <= CARDIO_MAX.durationSec &&
    inRange(s.distanceM, CARDIO_MAX.distanceM) &&
    inRange(s.level, CARDIO_MAX.level) &&
    inRange(s.calories, CARDIO_MAX.calories)
  );
}
export function validSet(s: WorkoutSet) {
  if (s.measure === "cardio") return validCardioSet(s);
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

export function validate(kind: "workout", payload: unknown): Workout;
export function validate(kind: "routine", payload: unknown): Routine;
export function validate(kind: "exercise", payload: unknown): CustomExercise;
export function validate(kind: "plan", payload: unknown): Plan;
export function validate(kind: "goal", payload: unknown): Goal;
export function validate(kind: "library", payload: unknown): Library;
export function validate(kind: Kind, payload: unknown): Payload;
export function validate(kind: Kind, payload: unknown): Payload {
  const schema = {
    workout: workoutSchema,
    routine: routineSchema,
    exercise: customSchema,
    plan: planSchema,
    goal: goalSchema,
    library: librarySchema,
  }[kind as string] as z.ZodTypeAny | undefined;
  if (!schema) throw new RecordValidationError(t("val.unknownType"));
  const result = schema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.at(-1);
    const candidate = payload as { exercises?: Exercise[] };
    const candidateSet =
      candidate?.exercises?.[Number(issue.path[1])]?.sets?.[
        Number(issue.path[3])
      ];
    if (field === "weight" && candidateSet && hasExtraWeight(candidateSet))
      throw new RecordValidationError(t("val.addedWeight"));
    const messages: Record<string, string> = {
      name: t("val.name"),
      date: t("val.date"),
      duration: t("val.duration"),
      weight: t("val.weight"),
      bodyWeightKg: t("val.bodyWeightKg"),
      extraWeight: t("val.extraWeight"),
      measure: t("val.measure"),
      durationSec: t("val.durationSec"),
      distanceM: t("val.distanceM"),
      level: t("val.level"),
      calories: t("val.calories"),
      load: t("val.load"),
      section: t("val.section"),
      exercises: t("val.exercises"),
      sets: t("val.sets"),
      startDate: t("val.startDate"),
      endDate: t("val.endDate"),
      cycleWeeks: t("val.cycleWeeks"),
      template: t("val.template"),
      overrides: t("val.overrides"),
      goalIds: t("val.goalIds"),
      kind: t("val.kind"),
      targetKg: t("val.targetKg"),
      exerciseId: t("val.exerciseId"),
      byDate: t("val.byDate"),
      hiddenExerciseIds: t("val.hiddenExerciseIds"),
      groups: t("val.groups"),
      routineIds: t("val.routineIds"),
      startKg: t("val.startKg"),
    };
    if (field === "reps") {
      const timed = candidateSet?.measure === "seconds";
      throw new RecordValidationError(
        t(timed ? "val.secondsRange" : "val.repsRange"),
      );
    }
    throw new RecordValidationError(
      messages[String(field)] ?? t("val.checkDetails"),
    );
  }
  const p = keepUnknownFields(payload, result.data);
  if (kind === "workout" || kind === "routine") {
    if (
      (payload as Workout | Routine).exercises.some((ex) =>
        ex.sets.some(hasSetInputText),
      )
    )
      throw new RecordValidationError(t("val.finishEntering"));
    for (const ex of (p as Workout | Routine).exercises) {
      ex.sets = normalizeDrops(ex.sets);
      for (const s of ex.sets) {
        if (s.measure === "cardio") {
          if (s.reps !== null || s.weight !== null)
            throw new RecordValidationError(t("val.cardioNoReps"));
          if (s.done && !validSet(s))
            throw new RecordValidationError(t("val.cardioNeedsTime"));
          continue;
        }
        if (s.extraWeight === true && s.load !== "bodyweight")
          throw new RecordValidationError(t("val.extraBodyweightOnly"));
        if (hasExtraWeight(s) && s.weight !== null && s.weight <= 0)
          throw new RecordValidationError(t("val.addedWeightRange"));
        if (s.measure === "seconds" && s.load !== "bodyweight")
          throw new RecordValidationError(t("val.timedBodyweight"));
        if (s.done && !validSet(s))
          throw new RecordValidationError(t("val.checkedInvalid"));
      }
    }
  }
  if (kind === "workout") {
    const w = p as Workout;
    if (!isIsoDay(w.date)) throw new RecordValidationError(t("val.date"));
    if (
      w.status === "completed" &&
      !w.exercises.some((e) => e.sets.some((s) => s.done))
    )
      throw new RecordValidationError(t("val.completeOne"));
  }
  return p;
}
export const labelSet = (s: WorkoutSet) => {
  if (s.measure === "cardio") return cardioLabel(s);
  const kg = s.weight === null ? "null" : formatDecimal(s.weight);
  if (hasExtraWeight(s))
    return (
      t("label.bwPlus", { kg }) +
      (s.measure === "seconds"
        ? ` · ${t("label.sec", { n: s.reps })}`
        : ` × ${s.reps}`)
    );
  if (s.measure === "seconds") return t("label.sec", { n: s.reps });
  if (s.load === "bodyweight") return t("label.bwReps", { n: s.reps });
  if (s.load === "assisted") return t("label.assist", { kg, n: s.reps });
  return t("label.weight", { kg, n: s.reps });
};
export const repeatExercises = (items: Exercise[]) =>
  items.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    sets: e.sets.map((s) => newSet(s)),
  }));
