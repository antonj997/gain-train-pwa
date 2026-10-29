import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, Workout } from "../src/data/model";
import { routineAverageMinutes } from "../src/lib/routine-preview";

const routineId = crypto.randomUUID();
const record = (payload: Partial<Workout>): RecordDoc =>
  ({
    id: crypto.randomUUID(),
    kind: "workout",
    deleted: false,
    payload: {
      name: "Push day",
      date: "2026-10-01",
      duration: 40,
      startedAt: null,
      status: "completed",
      exercises: [],
      routineId,
      ...payload,
    },
  }) as unknown as RecordDoc;

test("routineAverageMinutes averages that routine's finished workouts to 5 minutes", () => {
  const records = [
    record({ duration: 40 }),
    record({ duration: 52 }),
    record({ duration: null }),
    record({ duration: 300, routineId: crypto.randomUUID() }),
    record({ duration: 300, status: "draft" }),
  ];
  assert.equal(routineAverageMinutes(routineId, records), 45);
  assert.equal(routineAverageMinutes(crypto.randomUUID(), records), null);
  assert.equal(routineAverageMinutes(routineId, []), null);
});
