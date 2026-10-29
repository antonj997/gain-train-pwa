import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { hiddenIds, libraryOf, withHidden } from "@/data/exercises";

/** The exercises the user hid, and a way to hide or unhide one (saved and synced). */
export function useHiddenExercises() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const hidden = useMemo(() => hiddenIds(state.records), [state.records]);
  const setHidden = useCallback(
    (id: string, hide: boolean) =>
      saveLibrary({
        ...libraryOf(state.records, account),
        hiddenExerciseIds: withHidden(hidden, id, hide),
      }),
    [account, hidden, saveLibrary, state.records],
  );
  return { hidden, setHidden };
}
