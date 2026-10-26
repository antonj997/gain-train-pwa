import { z } from "zod";
import {
  customSchema,
  keepUnknownFields,
  routineSchema,
  workoutSchema,
  type RecordDoc,
  type Workout,
} from "../data/model";
import { setInputTextSchema } from "./set-input";
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function draftKey(account: string, kind: string, id = "") {
  return `gt-draft:${account}:${kind}:${id}`;
}
/**
 * Recovery drafts and rest timers left behind by workouts that were finished or
 * removed, possibly on another device. Unknown workouts are kept: another tab
 * may have just created them.
 */
export function staleDraftKeys(
  keys: string[],
  account: string,
  records: Record<string, RecordDoc>,
) {
  const prefixes = [draftKey(account, "workout"), draftKey(account, "rest")];
  return keys.filter((key) => {
    const prefix = prefixes.find((p) => key.startsWith(p));
    const record = prefix && records[key.slice(prefix.length)];
    return (
      !!record &&
      (record.deleted || (record.payload as Workout).status !== "draft")
    );
  });
}
export function readDraft<T>(
  storage: DraftStorage,
  key: string,
  parse: (value: unknown) => T | null,
): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function writeDraft(storage: DraftStorage, key: string, value: unknown) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
const pendingName = z.string().max(100);
const customDraft = z.object({
  id: z.string().uuid(),
  data: customSchema.extend({ name: pendingName }),
});
// Recovery permits temporary numeric errors. The saved record still uses the strict schema.
const recoverySet =
  workoutSchema.shape.exercises.element.shape.sets.element.extend({
    reps: z.number().nullable(),
    weight: z.number().nullable(),
    inputText: setInputTextSchema.optional(),
  });
const recoveryExercise = workoutSchema.shape.exercises.element.extend({
  sets: z.array(recoverySet).max(100),
});
const routineDraft = z.object({
  id: z.string().uuid(),
  data: routineSchema.extend({
    name: pendingName,
    exercises: z.array(recoveryExercise).max(100),
  }),
});
const workoutDraft = workoutSchema.extend({
  name: pendingName,
  date: z.string().max(10),
  duration: z.number().nullable(),
  exercises: z.array(recoveryExercise).max(100),
});
export function parseRoutineDraft(value: unknown) {
  const result = routineDraft.safeParse(value);
  return result.success ? keepUnknownFields(value, result.data) : null;
}
export function parseCustomDraft(value: unknown) {
  const result = customDraft.safeParse(value);
  return result.success ? keepUnknownFields(value, result.data) : null;
}
export function parseWorkoutDraft(value: unknown) {
  const result = workoutDraft.safeParse(value);
  return result.success && result.data.status === "draft"
    ? keepUnknownFields(value, result.data)
    : null;
}
export function readRestEnd(
  storage: DraftStorage,
  key: string,
  now = Date.now(),
): number | null {
  try {
    const end = Number(storage.getItem(key));
    if (Number.isFinite(end) && end > now && end < now + 86400000) return end;
    storage.removeItem(key);
  } catch {
    /* Timer remains usable when storage is unavailable. */
  }
  return null;
}
export function extendRestEnd(
  end: number | null,
  now: number,
  seconds: number,
) {
  return Math.max(end ?? now, now) + seconds * 1000;
}
