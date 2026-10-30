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
import { shiftDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { parseSetNumber } from "@/lib/set-input";
import { formatDecimal, t } from "@/i18n";

const kinds = (): { value: Goal["kind"]; label: string }[] => [
  { value: "lift", label: t("goals.lift") },
  { value: "bodyweight", label: t("goals.bodyweight") },
];

const text = (value: number | undefined) =>
  value === undefined ? "" : formatDecimal(Number(value.toFixed(2)));

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
      ? {
          id: goal.exerciseId,
          name: goal.exerciseName ?? t("goals.exercise"),
        }
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
        ? t("goals.enterLift")
        : t("goals.enterTarget")
      : kind === "lift" && !exercise
        ? t("goals.chooseExercise")
        : kind === "lift" &&
            (repCount === null ||
              !Number.isInteger(repCount) ||
              repCount < 1 ||
              repCount > 10)
          ? t("goals.repsRange")
          : kind === "bodyweight" &&
              (startKg === null ||
                Number.isNaN(startKg) ||
                startKg <= 0 ||
                startKg > 1000)
            ? t("goals.enterToday")
            : !/^\d{4}-\d{2}-\d{2}$/.test(byDate)
              ? t("goals.chooseBy")
              : !goal && byDate < today
                ? t("goals.notPassed")
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
      toast.success(t("goals.saved"));
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, t("goals.saveFailed")));
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
        title={goal ? t("goals.edit") : t("goals.new")}
        description={t("goals.description")}
      >
        <Segmented<Goal["kind"]>
          label={t("goals.kind")}
          value={kind}
          options={kinds()}
          onChange={setKind}
        />
        {kind === "lift" ? (
          <>
            <div className="list">
              <ListRow
                title={t("goals.exercise")}
                value={exercise?.name ?? t("goals.choose")}
                chevron
                onClick={() => setPicking(true)}
              />
            </div>
            <div className="field-row">
              <label>
                {t("goals.weightKg")}
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={target}
                  placeholder="110"
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <label>
                {t("goals.reps")}
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </label>
            </div>
            <p className="row-sub">{t("goals.repsNote")}</p>
          </>
        ) : (
          <div className="field-row">
            <label>
              {t("goals.targetKg")}
              <input
                inputMode="decimal"
                autoComplete="off"
                value={target}
                placeholder="80"
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label>
              {t("goals.todayKg")}
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
          {t("goals.by")}
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
          {busy ? t("common.saving") : t("goals.save")}
        </button>
        {goal && (
          <button
            type="button"
            className="btn-danger btn-block"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            {t("goals.delete")}
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
        title={t("goals.deleteTitle")}
        description={t("goals.deleteText")}
        cancelLabel={t("goals.keep")}
        confirmLabel={busy ? t("history.deleting") : t("goals.delete")}
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          if (!goal) return;
          setBusy(true);
          try {
            await deleteRecord(goal.id);
            toast(t("goals.deleted"));
            onClose();
          } catch {
            toast.error(t("goals.deleteFailed"));
          } finally {
            setBusy(false);
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
