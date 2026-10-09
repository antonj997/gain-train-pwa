import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { type Workout } from "@/data/model";
import {
  WorkoutInProgressError,
  type StartedWorkout,
} from "@/data/workout-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
      navigate("/workout/" + request.id);
    } catch (error) {
      if (error instanceof WorkoutInProgressError)
        setPending({ ...request, replacing: error.workouts });
      else
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not start this workout. Try again.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const start = (workout: Workout) =>
    attempt({ id: crypto.randomUUID(), workout });
  const confirmation = (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open && !lock.current) setPending(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workout already in progress</DialogTitle>
          <DialogDescription>
            {pending?.replacing?.length === 1
              ? `“${pending.replacing[0].name}” is already in progress. Starting “${pending.workout.name}” will remove it and its logged sets.`
              : `You have ${pending?.replacing?.length ?? 0} workouts in progress. Starting “${pending?.workout.name}” will remove them and their logged sets.`}
          </DialogDescription>
        </DialogHeader>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setPending(null)}
        >
          Keep current workout
        </button>
        <button
          className="secondary danger"
          disabled={busy}
          onClick={() => pending && void attempt(pending)}
        >
          {busy ? "Starting…" : "Abandon and start"}
        </button>
      </DialogContent>
    </Dialog>
  );
  return { start, busy, confirmation };
}
