import { useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { useStableCallback } from "@/hooks/useStableCallback";
import { libraryOf } from "@/data/exercises";
import { repHoldIds, withRepHold } from "@/lib/rep-hold";
import { t } from "@/i18n";

/**
 * Which exercises count "Reps + hold" (saved in the synced library record)
 * and a way to change one. `holdFor` keeps its identity until the saved
 * choice changes, so memoised cards skip renders.
 */
export function useRepHold() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const library = libraryOf(state.records, account);
  // The records change with every autosave; the choice rarely does.
  const key = JSON.stringify([...repHoldIds(library)].sort());
  const holdFor = useMemo(() => {
    const ids = new Set(JSON.parse(key) as string[]);
    return (exerciseId: string) => ids.has(exerciseId);
  }, [key]);
  // Stable, so passing it to every card keeps them memoised.
  const setHold = useStableCallback((exerciseId: string, on: boolean) => {
    if (repHoldIds(library).has(exerciseId) === on) return;
    saveLibrary(withRepHold(library, exerciseId, on)).catch(() => {
      toast.error(t("load.repsHoldFailed"));
    });
  });
  return { holdFor, setHold };
}
