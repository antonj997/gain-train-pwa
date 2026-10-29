import { useMemo, useRef } from "react";
import type { RecordDoc, Workout } from "@/data/model";
import { customDefaults } from "@/data/selectors";
import {
  lastSessions,
  priorWorkouts,
  type ExerciseDefaults,
} from "@/data/workouts";

type Records = Record<string, RecordDoc>;

/** A summary of the other finished workouts: changes whenever one of them does. */
function finishedKey(records: Records, id: string) {
  let key = "";
  for (const r of Object.values(records))
    if (r.id !== id && r.kind === "workout")
      key += `${r.id}:${r.localVersion}:${r.revision}:${r.deleted ? 1 : 0}:${r.payload.status};`;
  return key;
}

/**
 * What the workout editor's cards need from the rest of the log: the previous
 * results per exercise and custom exercises' defaults. Both keep their identity
 * across autosaves of this workout, so memoised cards do not re-render.
 */
export function usePreviousResults(
  records: Records,
  id: string,
  initial: Workout,
  date: string,
) {
  // Previous results are rebuilt only when other finished workouts or the date
  // change: not after each autosave of this one, which reloads the log.
  const latest = useRef(records);
  latest.current = records;
  const historyKey = useMemo(() => finishedKey(records, id), [records, id]);
  const previous = useMemo(
    () =>
      lastSessions(
        priorWorkouts(
          Object.values(latest.current),
          { ...latest.current[id], kind: "workout", payload: initial },
          date,
        ),
      ),
    // historyKey stands in for the records it summarises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyKey, id, initial, date],
  );
  // The same defaults objects until a custom exercise actually changes.
  const defaultsKey = useMemo(
    () => JSON.stringify([...customDefaults(records)]),
    [records],
  );
  const defaults = useMemo(
    () =>
      new Map<string, ExerciseDefaults>(
        JSON.parse(defaultsKey) as [string, ExerciseDefaults][],
      ),
    [defaultsKey],
  );
  return { previous, defaults };
}
