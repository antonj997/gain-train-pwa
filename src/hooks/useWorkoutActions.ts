import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { errorMessage } from "@/lib/errors";
import { requestPersistenceOnce } from "@/lib/persistence";
import { historyPath } from "@/lib/routes";
import { toastWithUndo } from "@/lib/undo-toast";
import { finishWorkout } from "@/lib/workout-editor";
import type { useRestTimer } from "@/hooks/useRestTimer";
import type { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import { t } from "@/i18n";

/**
 * Finishing (or saving an edit) and abandoning a workout. Both lock the editor
 * so no keystroke saves underneath; `busy` disables its buttons meanwhile.
 */
export function useWorkoutActions(
  id: string,
  autosave: ReturnType<typeof useWorkoutAutosave>,
  rest: ReturnType<typeof useRestTimer>,
) {
  const { save, deleteRecord, restoreWorkout } = useData();
  const navigate = useNavigate();
  const { workout: w, editing, setError } = autosave;
  const [busy, setBusy] = useState(false);
  const actionLocked = useRef(false);
  const runLocked = async (action: () => Promise<void>, failure: string) => {
    // A ref, not `busy`: a double tap arrives before the re-render disables buttons.
    if (actionLocked.current) return;
    actionLocked.current = true;
    autosave.lock();
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause, t("actions.saveFailed")));
      toast.error(failure);
    } finally {
      actionLocked.current = false;
      autosave.unlock();
      setBusy(false);
    }
  };
  /** Finishes the workout, or saves an edit, and optionally keeps it as a routine. */
  const complete = (saveAsRoutine: boolean) =>
    runLocked(
      async () => {
        const next = finishWorkout(w);
        await autosave.saveNow(next);
        rest.skip();
        if (!editing) requestPersistenceOnce();
        if (saveAsRoutine) {
          try {
            await save(crypto.randomUUID(), "routine", {
              name: next.name,
              exercises: next.exercises.map((ex) => ({
                ...ex,
                sets: ex.sets.map((s) => ({ ...s, done: false })),
              })),
            });
          } catch {
            toast.error(t("actions.routineFailed"));
          }
        }
        toast.success(
          editing ? t("actions.changesSaved") : t("actions.workoutSaved"),
        );
        navigate(historyPath(id));
      },
      editing ? t("actions.changesFailed") : t("actions.finishFailed"),
    );
  const abandon = () =>
    runLocked(async () => {
      await autosave.flush();
      // Leave first: deleting re-renders this route, which would flash
      // "Workout not found" before the navigation.
      navigate("/", { replace: true });
      try {
        await deleteRecord(id);
      } catch (cause) {
        toast.error(errorMessage(cause, t("actions.abandonFailed")));
        return;
      }
      rest.skip();
      toastWithUndo(
        t("home.abandoned"),
        () => restoreWorkout(id),
        t("home.restoreFailed"),
      );
    }, t("actions.abandonRetry"));
  return { busy, complete, abandon };
}
