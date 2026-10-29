import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import ConfirmDialog from "@/components/ConfirmDialog";
import ExercisePicker from "@/components/ExercisePicker";
import ListRow from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import type { GoalItem } from "@/data/goals";
import { type Goal, today as todayDate } from "@/data/model";
import { shiftDate } from "@/data/summary";
import { errorMessage } from "@/lib/errors";
import { parseSetNumber } from "@/lib/set-input";

const kinds: { value: Goal["kind"]; label: string }[] = [
  { value: "lift", label: "Lift" },
  { value: "bodyweight", label: "Bodyweight" },
];

const text = (value: number | undefined) =>
  value === undefined ? "" : String(Number(value.toFixed(2)));

/** Creates, edits or deletes one goal. `goal` is null for a new one. */
export default function GoalEditor({
  open,
  goal,
  onClose,
}: {
  open: boolean;
  goal: GoalItem | null;
  onClose: () => void;
}) {
  const { save, deleteRecord } = useData();
  const { bodyWeightKg } = useProfile();
  const today = todayDate();
  const [kind, setKind] = useState<Goal["kind"]>(goal?.kind ?? "lift");
  const [target, setTarget] = useState(text(goal?.targetKg));
  const [reps, setReps] = useState(goal ? String(goal.reps ?? 1) : "1");
  const [start, setStart] = useState(
    goal?.startKg !== undefined
      ? text(goal.startKg)
      : text(bodyWeightKg ?? undefined),
  );
  const [exercise, setExercise] = useState(
    goal?.exerciseId
      ? { id: goal.exerciseId, name: goal.exerciseName ?? "Exercise" }
      : null,
  );
  const [byDate, setByDate] = useState(goal?.byDate ?? shiftDate(today, 90));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const targetKg = parseSetNumber(target);
  const repCount = parseSetNumber(reps);
  const startKg = parseSetNumber(start);
  const maxKg = kind === "bodyweight" ? 1000 : 10000;
  const problem =
    targetKg === null ||
    Number.isNaN(targetKg) ||
    targetKg <= 0 ||
    targetKg > maxKg
      ? kind === "lift"
        ? "Enter the weight you want to lift, in kg."
        : "Enter your target weight, in kg."
      : kind === "lift" && !exercise
        ? "Choose the exercise."
        : kind === "lift" &&
            (repCount === null ||
              !Number.isInteger(repCount) ||
              repCount < 1 ||
              repCount > 10)
          ? "Reps must be a whole number from 1 to 10."
          : kind === "bodyweight" &&
              (startKg === null ||
                Number.isNaN(startKg) ||
                startKg <= 0 ||
                startKg > 1000)
            ? "Enter your weight today, in kg. The progress bar starts there."
            : !/^\d{4}-\d{2}-\d{2}$/.test(byDate)
              ? "Choose the date to reach it by."
              : !goal && byDate < today
                ? "Choose a date that has not passed."
                : "";

  const submit = async () => {
    if (busy || problem) return;
    setBusy(true);
    setError("");
    const changed =
      !goal ||
      goal.targetKg !== targetKg ||
      goal.byDate !== byDate ||
      goal.kind !== kind;
    const payload: Goal = {
      kind,
      targetKg: targetKg!,
      byDate,
      createdAt: goal?.createdAt ?? Date.now(),
      ...(kind === "lift"
        ? {
            exerciseId: exercise!.id,
            exerciseName: exercise!.name,
            reps: repCount!,
          }
        : { startKg: startKg! }),
      ...(goal?.reachedOn && !changed ? { reachedOn: goal.reachedOn } : {}),
    };
    try {
      await save(goal?.id ?? crypto.randomUUID(), "goal", payload);
      toast.success("Goal saved");
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Could not save the goal. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={() => {
          if (!busy) onClose();
        }}
        title={goal ? "Edit goal" : "New goal"}
        description="A goal stands on its own. A plan can link to it, but it does not need one."
      >
        <Segmented<Goal["kind"]>
          label="Kind of goal"
          value={kind}
          options={kinds}
          onChange={setKind}
        />
        {kind === "lift" ? (
          <>
            <div className="list">
              <ListRow
                title="Exercise"
                value={exercise?.name ?? "Choose"}
                chevron
                onClick={() => setPicking(true)}
              />
            </div>
            <div className="field-row">
              <label>
                Weight (kg)
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={target}
                  placeholder="110"
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <label>
                Reps
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </label>
            </div>
            <p className="row-sub">
              One rep compares with your heaviest set. More reps compare with
              your estimated one-rep max.
            </p>
          </>
        ) : (
          <div className="field-row">
            <label>
              Target (kg)
              <input
                inputMode="decimal"
                autoComplete="off"
                value={target}
                placeholder="80"
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label>
              Weight today (kg)
              <input
                inputMode="decimal"
                autoComplete="off"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
          </div>
        )}
        <label>
          By
          <input
            type="date"
            value={byDate}
            onChange={(e) => setByDate(e.target.value)}
          />
        </label>
        {problem && (
          <p className="row-sub" role="status">
            {problem}
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn-primary btn-block"
          disabled={busy || !!problem}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Save goal"}
        </button>
        {goal && (
          <button
            type="button"
            className="btn-danger btn-block"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            Delete goal
          </button>
        )}
      </Sheet>
      <ExercisePicker
        single
        open={picking}
        onClose={() => setPicking(false)}
        onAdd={([item]) =>
          item && setExercise({ id: item.id, name: item.name })
        }
      />
      <ConfirmDialog
        open={deleting}
        title="Delete this goal?"
        description="The goal is removed. Your workouts and plans stay."
        cancelLabel="Keep goal"
        confirmLabel={busy ? "Deleting…" : "Delete goal"}
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          if (!goal) return;
          setBusy(true);
          try {
            await deleteRecord(goal.id);
            toast("Goal deleted");
            onClose();
          } catch {
            toast.error("Could not delete. The goal is still here; retry.");
          } finally {
            setBusy(false);
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
