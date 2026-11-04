import { useEffect, useState } from "react";
import {
  TRAINING_PREFERENCES_EVENT,
  readTrainingPreferences,
  saveTrainingPreferences,
  type TrainingPreferences,
} from "@/lib/preferences";
import { setCurrentWeightUnit } from "@/lib/units";

/** The training preferences on this device, kept current when another screen changes them. */
export function useTrainingPreferences() {
  const [preferences, setPreferences] = useState(readTrainingPreferences);
  useEffect(() => {
    const refresh = () => {
      const next = readTrainingPreferences();
      // Another tab may have changed the unit: labels read it from its module.
      setCurrentWeightUnit(next.weightUnit);
      setPreferences(next);
    };
    window.addEventListener(TRAINING_PREFERENCES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(TRAINING_PREFERENCES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const update = (patch: Partial<TrainingPreferences>) => {
    saveTrainingPreferences(patch);
    setPreferences(readTrainingPreferences());
  };
  return [preferences, update] as const;
}
