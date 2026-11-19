import { useMemo } from "react";
import { notify } from "@/lib/message-store";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { libraryOf } from "@/data/exercises";
import {
  exerciseWeightUnit,
  weightUnitOverrides,
  withExerciseWeightUnit,
} from "@/lib/exercise-units";
import type { WeightUnit } from "@/lib/units";
import { t } from "@/i18n";

/**
 * Each exercise's weight unit: its own (saved in the synced library record)
 * or the device's default from Settings, and a way to change one exercise's.
 * `unitFor` keeps its identity until a unit changes, so memoised cards skip
 * renders.
 */
export function useWeightUnits() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const [{ weightUnit: defaultUnit }] = useTrainingPreferences();
  const library = libraryOf(state.records, account);
  // The records change with every autosave; the units rarely do.
  const key = JSON.stringify(
    Object.entries(weightUnitOverrides(library)).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  );
  const unitFor = useMemo(() => {
    const overrides = Object.fromEntries(
      JSON.parse(key) as [string, WeightUnit][],
    );
    return (exerciseId: string) =>
      exerciseWeightUnit(overrides, exerciseId, defaultUnit);
  }, [key, defaultUnit]);
  // Stable, so passing it to every card keeps them memoised.
  const setUnit = useStableCallback((exerciseId: string, unit: WeightUnit) => {
    if (unitFor(exerciseId) === unit) return;
    saveLibrary(
      withExerciseWeightUnit(library, exerciseId, unit, defaultUnit),
    ).catch(() => notify.error(t("unit.saveFailed")));
  });
  return { unitFor, setUnit, defaultUnit };
}
