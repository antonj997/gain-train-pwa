import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { type Workout } from "@/data/model";
import {
  WorkoutInProgressError,
  type StartedWorkout,
} from "@/data/workout-start";
import ConfirmDialog from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/errors";
import { workoutPath } from "@/lib/routes";

type PendingStart = {
  id: string;
  workout: Workout;
  replacing?: StartedWorkout[];
};

export function useStartWorkout() {
  const { startWorkout } = useData();
  const navigate = useNavigate();
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
      navigate(workoutPath(request.id));
    } catch (error) {
      if (error instanceof WorkoutInProgressError)
        setPending({ ...request, replacing: error.workouts });
      else
        toast.error(
          errorMessage(error, "Could not start this workout. Try again."),
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const start = (workout: Workout) =>
    attempt({ id: crypto.randomUUID(), workout });
  const replacing = pending?.replacing ?? [];
  const confirmation = (
    <ConfirmDialog
      open={!!pending}
      title="Workout already in progress"
      description={
        replacing.length === 1
          ? `“${replacing[0].name}” is already in progress. Starting “${pending?.workout.name}” will remove it and its logged sets.`
          : `You have ${replacing.length} workouts in progress. Starting “${pending?.workout.name}” will remove them and their logged sets.`
      }
      cancelLabel="Keep current workout"
      confirmLabel={busy ? "Starting…" : "Abandon and start"}
      busy={busy}
      onCancel={() => setPending(null)}
      onConfirm={() => pending && void attempt(pending)}
    />
  );
  return { start, busy, confirmation };
}
