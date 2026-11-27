// P1 Passet's fixture additions (v6 plan, Task 1.13). The harness passes the
// common fixture (fixture.cjs) and uses what this returns.
//
// - The running Benpass's calf raise gets a 60 kg last set with a 50 kg drop,
//   so "+ Drop" shows and adds 40 (a machine's 5 kg step).
// - B13: a finished "Ben B" a week ago (Squat 3, then Bulgarian Split Squat 3
//   at the top of 8–10 with 20 kg), and a running "Ben B" today with Squat 3
//   and Leg Press 3 checked before the split squat, whose target is 22 × 8:
//   quads have 6 hard sets against 3, so the fatigue row offers 20 × 8.
// - An empty draft, "Tomt pass", with nothing checked, for "Inga set är
//   ikryssade" and, once all is checked, Avsluta's fill.
const { uuid } = require("./fixture.cjs");

const P1 = {
  benB: uuid(60),
  b13: uuid(61),
  empty: uuid(62),
};
let next = 6000;
const id = () => uuid(next++);

const set = (weight, reps, extra = {}) => ({
  id: id(),
  reps,
  weight,
  load: "weight",
  section: "working",
  done: true,
  ...extra,
});
const sets = (count, weight, reps, extra) =>
  Array.from({ length: count }, () => set(weight, reps, extra));
const exercise = (exerciseId, name, exerciseSets, repRange) => ({
  id: id(),
  exerciseId,
  name,
  sets: exerciseSets,
  ...(repRange ? { repRange } : {}),
});
const workout = (recordId, payload) => ({
  id: recordId,
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: { schemaVersion: 2, ...payload },
});
// Stockholm time (CET in November).
const at = (date, hour) => new Date(`${date}T${hour}:00:00+01:00`).getTime();

module.exports = (fixture) => {
  next = 6000;
  const records = fixture.state.records;
  const draft = records[uuid(5)];
  // The calf raise: three open sets at 60 kg, the last with a 50 kg drop.
  const calf = draft.payload.exercises.find(
    (ex) => ex.exerciseId === "builtin:standing-calf-raise",
  );
  calf.sets = [
    ...sets(3, 60, 12, { done: false }),
    set(50, null, { done: false, drop: true }),
  ];

  records[P1.benB] = workout(P1.benB, {
    name: "Ben B",
    date: "2026-11-11",
    duration: 40,
    startedAt: null,
    createdAt: at("2026-11-11", "07"),
    completedAt: at("2026-11-11", "07") + 40 * 60000,
    status: "completed",
    exercises: [
      exercise("builtin:squat", "Squat", sets(3, 90, 5), { min: 5, max: 7 }),
      exercise(
        "builtin:bulgarian-split-squat",
        "Bulgarian Split Squat",
        sets(3, 20, 10),
        { min: 8, max: 10 },
      ),
    ],
  });
  records[P1.b13] = workout(P1.b13, {
    name: "Ben B",
    date: "2026-11-19",
    duration: null,
    startedAt: at("2026-11-19", "09"),
    createdAt: at("2026-11-19", "09"),
    status: "draft",
    exercises: [
      exercise("builtin:squat", "Squat", sets(3, 90, 5), { min: 5, max: 7 }),
      exercise("builtin:leg-press", "Leg Press", sets(3, 140, 10), {
        min: 8,
        max: 12,
      }),
      exercise(
        "builtin:bulgarian-split-squat",
        "Bulgarian Split Squat",
        sets(3, 22, 8, { done: false }),
        { min: 8, max: 10 },
      ),
    ],
  });
  records[P1.empty] = workout(P1.empty, {
    name: "Tomt pass",
    date: "2026-11-19",
    duration: null,
    startedAt: at("2026-11-19", "09"),
    createdAt: at("2026-11-19", "09"),
    status: "draft",
    exercises: [
      exercise("builtin:lateral-raise", "Lateral Raise", sets(2, 8, 12, { done: false }), {
        min: 10,
        max: 15,
      }),
    ],
  });
  return fixture;
};
module.exports.P1 = P1;
