import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import {
  hiddenIds,
  libraryOf,
  libraryRecordId,
  withHidden,
} from "@/data/exercises";

/** The exercises the user hid, and a way to hide or unhide one (saved and synced). */
export function useHiddenExercises() {
  const { state, save } = useData();
  const { account } = useAuth();
  const hidden = useMemo(() => hiddenIds(state.records), [state.records]);
  const setHidden = useCallback(
    (id: string, hide: boolean) =>
      save(libraryRecordId(account), "library", {
        ...libraryOf(state.records, account),
        hiddenExerciseIds: withHidden(hidden, id, hide),
      }),
    [account, hidden, save, state.records],
  );
  return { hidden, setHidden };
}
