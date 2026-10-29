import { createContext, useContext } from "react";
import type {
  Kind,
  LocalState,
  Payload,
  RecordDoc,
  Workout,
} from "@/data/model";
import type { StartedWorkout } from "@/data/workout-start";
import type { ImportResult } from "@/data/actions";
import type { SyncHealth } from "@/lib/sync-health";

export type Data = {
  state: LocalState;
  ready: boolean;
  error: string;
  syncing: boolean;
  online: boolean;
  syncHealth: SyncHealth;
  save: (
    id: string,
    kind: Kind,
    payload: Payload,
    deleted?: boolean,
  ) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  restoreWorkout: (id: string) => Promise<void>;
  startWorkout: (
    id: string,
    payload: Workout,
    replace?: StartedWorkout[],
  ) => Promise<void>;
  sync: () => Promise<void>;
  resolve: (id: string, mine: boolean) => Promise<void>;
  /** Sends changes the server refused once more, e.g. after an app update. */
  retryRejected: () => Promise<void>;
  /** Adds backup records this log lacks; first downloads what the server has. */
  importRecords: (records: RecordDoc[]) => Promise<ImportResult>;
};
export const DataContext = createContext<Data | null>(null);

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw Error("Data provider missing");
  return context;
}
