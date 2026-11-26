import { useMemo, useRef } from "react";
import { notify } from "@/lib/message-store";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { useStableCallback } from "@/hooks/useStableCallback";
import { libraryOf } from "@/data/exercises";
import { equipmentLookup } from "@/data/progression";
import {
  exerciseNote,
  restOf,
  weightStepOf,
  withExerciseNote,
  withRest,
  withWeightStep,
} from "@/lib/exercise-settings";
import { t } from "@/i18n";

/**
 * Each exercise's own settings from the synced library (v6 §D5): its note,
 * weight step and rest time, with its equipment for the step's default, and
 * ways to change them. The lookups keep their identity until a setting
 * changes, so memoised cards skip renders.
 */
export function useExerciseSettings() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const library = libraryOf(state.records, account);
  const latest = useRef(library);
  latest.current = library;
  // The records change with every autosave; the settings rarely do.
  const key = JSON.stringify([
    library.exerciseNotes ?? {},
    library.weightSteps ?? {},
    library.restSeconds ?? {},
  ]);
  // Equipment comes from the catalogue or your own exercises.
  const customKey = Object.values(state.records)
    .filter((r) => r.kind === "exercise")
    .map(
      (r) =>
        `${r.id}:${r.deleted ? "" : ((r.payload as { equipment?: string }).equipment ?? "")}`,
    )
    .join("|");
  const equipmentFor = useMemo(
    () => equipmentLookup(state.records),
    // customKey stands in for the records it summarises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customKey],
  );
  const lookups = useMemo(() => {
    const [exerciseNotes, weightSteps, restSeconds] = JSON.parse(key) as [
      Record<string, string>,
      Record<string, number>,
      Record<string, number>,
    ];
    const settings = { exerciseNotes, weightSteps, restSeconds };
    return {
      noteFor: (exerciseId: string) => exerciseNote(settings, exerciseId),
      stepFor: (exerciseId: string) =>
        weightStepOf(settings, exerciseId, equipmentFor(exerciseId)),
      /** The exercise's own rest (0 = off), or undefined: it follows the preference. */
      restFor: (exerciseId: string) => restOf(settings, exerciseId),
    };
  }, [key, equipmentFor]);
  const save = (next: ReturnType<typeof libraryOf>) =>
    saveLibrary(next).catch(() => notify.error(t("exercise.saveFailed")));
  const setNote = useStableCallback((exerciseId: string, text: string) => {
    if (exerciseNote(latest.current, exerciseId) === text.trim()) return;
    void save(withExerciseNote(latest.current, exerciseId, text));
  });
  const setStep = useStableCallback(
    (exerciseId: string, step: number | null) =>
      void save(
        withWeightStep(
          latest.current,
          exerciseId,
          step,
          equipmentFor(exerciseId),
        ),
      ),
  );
  const setRest = useStableCallback(
    (exerciseId: string, seconds: number | null) =>
      void save(withRest(latest.current, exerciseId, seconds)),
  );
  return { ...lookups, equipmentFor, setNote, setStep, setRest };
}
