import {
  validate,
  RecordValidationError,
  type LocalState,
  type Workout,
} from "./model";

export type StartedWorkout = {
  id: string;
  name: string;
  localVersion: number;
  revision: number;
};

export class WorkoutInProgressError extends Error {
  constructor(public workouts: StartedWorkout[]) {
    super("A workout is already in progress.");
    this.name = "WorkoutInProgressError";
  }
}

export function startedWorkouts(state: LocalState): StartedWorkout[] {
  return Object.values(state.records)
    .filter(
      (record) =>
        !record.deleted &&
        record.kind === "workout" &&
        (record.payload as Workout).status === "draft" &&
        (record.payload as Workout).startedAt !== null,
    )
    .map((record) => ({
      id: record.id,
      name: record.payload.name,
      localVersion: record.localVersion,
      revision: record.revision,
    }));
}

export function restoreRemovedWorkout(state: LocalState, id: string) {
  const record = state.records[id];
  if (!record || record.kind !== "workout")
    throw new RecordValidationError(
      "Could not find this workout to restore it.",
    );
  if (!record.deleted) return;
  const workout = validate("workout", record.payload) as Workout;
  if (
    workout.status === "draft" &&
    workout.startedAt !== null &&
    startedWorkouts(state).length
  )
    throw new RecordValidationError(
      "Another workout is already in progress. Finish or abandon it before restoring this one.",
    );
  state.records[id] = {
    ...record,
    payload: workout,
    deleted: false,
    localVersion: record.localVersion + 1,
    dirty: true,
  };
}

// Runs inside a single IndexedDB transaction: either replace and create together,
// or leave everything intact. The versions also protect work added in another tab.
export function createWorkout(
  state: LocalState,
  id: string,
  payload: Workout,
  confirmed?: Pick<StartedWorkout, "id" | "localVersion" | "revision">[],
) {
  const workout = validate("workout", payload) as Workout;
  if (workout.status !== "draft" || state.records[id])
    throw new RecordValidationError("Could not start this workout. Try again.");
  const started = startedWorkouts(state);
  if (workout.startedAt !== null) {
    if (
      started.some(
        (current) =>
          !confirmed?.some(
            (choice) =>
              choice.id === current.id &&
              choice.localVersion === current.localVersion &&
              choice.revision === current.revision,
          ),
      )
    )
      throw new WorkoutInProgressError(started);
    for (const current of started) {
      const record = state.records[current.id];
      state.records[current.id] = {
        ...record,
        deleted: true,
        localVersion: record.localVersion + 1,
        dirty: true,
      };
    }
  }
  state.records[id] = {
    id,
    kind: "workout",
    payload: { ...workout, createdAt: workout.createdAt ?? Date.now() },
    revision: 0,
    localVersion: 1,
    deleted: false,
    dirty: true,
  };
}
