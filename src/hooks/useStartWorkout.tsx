import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notify } from "@/lib/message-store";
import { useData } from "@/contexts/useData";
import { type Workout, repeatExercises, today } from "@/data/model";
import {
  WorkoutInProgressError,
  type StartedWorkout,
} from "@/data/workout-start";
import { customCategories, doneSetCount } from "@/data/selectors";
import Sheet from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/errors";
import { routineFromWorkout } from "@/lib/routine-library";
import { workoutPath } from "@/lib/routes";
import { finishWorkout } from "@/lib/workout-editor";
import { useT } from "@/i18n/useT";
import {
  DISCARD_ARM_MS,
  discardTap,
  runningDialogText,
} from "@/lib/running-workout";
import RunningWorkoutChoices from "@/components/home/RunningWorkoutChoices";
import { workoutTitle } from "@/lib/workout-name";

type PendingStart = {
  id: string;
  workout: Workout;
  replacing?: StartedWorkout[];
  /** Catalogue categories the new workout's exercise picker opens filtered to. */
  suggest?: string[];
  /** Ask first whether it is another workout today or an earlier one. */
  choose?: boolean;
};

export function useStartWorkout() {
  const { state, save, startWorkout, deleteRecord, restoreWorkout } = useData();
  const navigate = useNavigate();
  const { t } = useT();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingStart | null>(null);
  const [armedAt, setArmedAt] = useState<number | null>(null);
  // The armed discard falls back after its window.
  useEffect(() => {
    if (armedAt === null) return;
    const timer = window.setTimeout(() => setArmedAt(null), DISCARD_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armedAt]);
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
      setArmedAt(null);
      // A past workout opens on its details sheet, to pick the date first.
      const past = request.workout.startedAt === null;
      navigate(
        workoutPath(request.id),
        request.suggest?.length || past || request.choose
          ? {
              state: {
                suggest: request.suggest,
                details: past || undefined,
                choose: request.choose || undefined,
              },
            }
          : undefined,
      );
      // "Abandon and start" removed the running workout; offer it back.
      const replaced = request.replacing?.[0];
      // Its own place (Train's resume card) is not on screen: the Undo
      // waits in a dashed placeholder under the new workout's top bar.
      if (replaced)
        notify(
          t("start.abandonedNamed", { name: workoutTitle(replaced.name) }),
          {
            undo: {
              run: async () => {
                navigate("/", { replace: true });
                await deleteRecord(request.id);
                await restoreWorkout(replaced.id);
                navigate(workoutPath(replaced.id));
              },
              failed: t("start.restoreFailed"),
            },
          },
        );
    } catch (error) {
      if (error instanceof WorkoutInProgressError)
        setPending({ ...request, replacing: error.workouts });
      else notify.error(errorMessage(error, t("start.failed")));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const start = (
    workout: Workout,
    suggest?: string[],
    { choose = false }: { choose?: boolean } = {},
  ) => attempt({ id: crypto.randomUUID(), workout, suggest, choose });
  /** A new running workout with the same exercises as a finished one, today. */
  const repeat = (workout: Workout) => {
    const now = Date.now();
    // The plan mark belongs to the week it was planned for, and the note to
    // the workout it was written about.
    const { plan: _plan, note: _note, ...rest } = workout;
    return start({
      ...rest,
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
  const runningId = replacing[0]?.id;
  const runningRecord = runningId ? state.records[runningId] : undefined;
  const running =
    runningRecord?.kind === "workout" ? runningRecord.payload : null;
  const dialog = running
    ? runningDialogText(running, t)
    : {
        name: workoutTitle(replacing[0]?.name ?? ""),
        title: t("start.runningTitle"),
        sub: workoutTitle(replacing[0]?.name ?? ""),
        text: t("start.runningText", {
          name: workoutTitle(replacing[0]?.name ?? ""),
        }),
      };
  const close = () => {
    if (busy) return;
    setPending(null);
    setArmedAt(null);
  };
  /** Back to the running workout. */
  const resume = () => {
    if (!runningId) return;
    setPending(null);
    setArmedAt(null);
    navigate(workoutPath(runningId));
  };
  /**
   * The running workout's exercises become a routine, and it ends: kept in
   * the log when it has checked sets, discarded (with Undo) when it has none,
   * since a workout with nothing checked cannot be saved. Then the new
   * workout starts.
   */
  const saveRoutineAndEnd = async () => {
    if (!pending || !running || !runningId || lock.current) return;
    lock.current = true;
    setBusy(true);
    let next: PendingStart = pending;
    try {
      await save(crypto.randomUUID(), "routine", routineFromWorkout(running));
      if (doneSetCount(running) > 0) {
        await save(
          runningId,
          "workout",
          finishWorkout(running, Date.now(), customCategories(state.records)),
        );
        next = {
          ...pending,
          replacing: pending.replacing?.filter((w) => w.id !== runningId),
        };
      }
    } catch (error) {
      notify.error(errorMessage(error, t("actions.routineFailed")));
      return;
    } finally {
      lock.current = false;
      setBusy(false);
    }
    await attempt(next);
  };
  const discard = () => {
    if (!pending) return;
    const now = Date.now();
    if (discardTap(armedAt, now) === "arm") {
      setArmedAt(now);
      return;
    }
    void attempt(pending);
  };
  const confirmation = (
    <Sheet
      open={!!pending}
      title={dialog.title}
      description={dialog.sub}
      onClose={close}
    >
      <RunningWorkoutChoices
        name={dialog.name}
        text={dialog.text}
        armed={armedAt !== null}
        busy={busy}
        onContinue={resume}
        onSaveRoutine={() => void saveRoutineAndEnd()}
        onDiscard={discard}
      />
    </Sheet>
  );
  return { start, repeat, busy, confirmation };
}
