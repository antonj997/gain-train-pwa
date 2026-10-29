import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { type Workout, repeatExercises, today } from "@/data/model";
import {
  WorkoutInProgressError,
  type StartedWorkout,
} from "@/data/workout-start";
import ConfirmDialog from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/errors";
import { workoutPath } from "@/lib/routes";
import { toastWithUndo } from "@/lib/undo-toast";
import { useT } from "@/i18n/useT";
import { workoutTitle } from "@/lib/workout-name";

type PendingStart = {
  id: string;
  workout: Workout;
  replacing?: StartedWorkout[];
  /** Catalogue categories the new workout's exercise picker opens filtered to. */
  suggest?: string[];
};

export function useStartWorkout() {
  const { startWorkout, deleteRecord, restoreWorkout } = useData();
  const navigate = useNavigate();
  const { t } = useT();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingStart | null>(null);
  const attempt = async (request: PendingStart) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const now = Date.now();
      await startWorkout(
        request.id,
        {
          ...request.workout,
          startedAt: request.workout.startedAt === null ? null : now,
          createdAt: now,
        },
        request.replacing,
      );
      setPending(null);
      // A past workout opens on its details sheet, to pick the date first.
      const past = request.workout.startedAt === null;
      navigate(
        workoutPath(request.id),
        request.suggest?.length || past
          ? {
              state: {
                suggest: request.suggest,
                details: past || undefined,
              },
            }
          : undefined,
      );
      // "Abandon and start" removed the running workout; offer it back.
      const replaced = request.replacing?.[0];
      if (replaced)
        toastWithUndo(
          t("start.abandonedNamed", { name: workoutTitle(replaced.name) }),
          async () => {
            navigate("/", { replace: true });
            await deleteRecord(request.id);
            await restoreWorkout(replaced.id);
            navigate(workoutPath(replaced.id));
          },
          t("start.restoreFailed"),
        );
    } catch (error) {
      if (error instanceof WorkoutInProgressError)
        setPending({ ...request, replacing: error.workouts });
      else toast.error(errorMessage(error, t("start.failed")));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const start = (workout: Workout, suggest?: string[]) =>
    attempt({ id: crypto.randomUUID(), workout, suggest });
  /** A new running workout with the same exercises as a finished one, today. */
  const repeat = (workout: Workout) => {
    const now = Date.now();
    return start({
      ...workout,
      date: today(),
      duration: null,
      startedAt: now,
      createdAt: now,
      completedAt: undefined,
      status: "draft",
      exercises: repeatExercises(workout.exercises),
    });
  };
  const replacing = pending?.replacing ?? [];
  const confirmation = (
    <ConfirmDialog
      open={!!pending}
      title={t("start.inProgressTitle")}
      description={
        replacing.length === 1
          ? t("start.replaceOne", {
              name: workoutTitle(replacing[0].name),
              next: workoutTitle(pending?.workout.name ?? ""),
            })
          : t("start.replaceMany", {
              count: replacing.length,
              next: workoutTitle(pending?.workout.name ?? ""),
            })
      }
      cancelLabel={t("start.keep")}
      confirmLabel={busy ? t("home.starting") : t("start.abandonAndStart")}
      busy={busy}
      onCancel={() => setPending(null)}
      onConfirm={() => pending && void attempt(pending)}
    />
  );
  return { start, repeat, busy, confirmation };
}
