import { useRef, useState } from "react";
import type { Exercise } from "@/data/model";
import {
  changeDiscardsSets,
  changeExercise,
  loggedSetCount,
  withoutChecks,
  type ExerciseTarget,
} from "@/lib/workout-editor";
import { isCardioSet } from "@/lib/cardio";
import { toastWithUndo } from "@/lib/undo-toast";
import ExercisePicker from "@/components/ExercisePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { t } from "@/i18n";

/**
 * "Change exercise" for a whole workout or routine: one picker shared by every
 * card instead of one per card. Changing to a strength exercise from cardio
 * (or back) asks first when logged sets would be cleared; Undo restores the
 * card as it was.
 */
export default function ChangeExercisePicker({
  exercise,
  mode = "log",
  onClose,
  onChange,
}: {
  /** The card being changed, or null while the picker is closed. */
  exercise: Exercise | null;
  mode?: "log" | "plan";
  onClose: () => void;
  onChange: (exercise: Exercise) => void;
}) {
  // The picker keeps its exercise while it slides out.
  const shown = useRef(exercise);
  if (exercise) shown.current = exercise;
  const before = shown.current;
  const current = before && mode === "plan" ? withoutChecks(before) : before;
  const [pending, setPending] = useState<{
    before: Exercise;
    current: Exercise;
    target: ExerciseTarget;
  } | null>(null);
  // The Undo toast outlives this render; it must change the latest workout.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const apply = (from: Exercise, card: Exercise, target: ExerciseTarget) => {
    onChange(changeExercise(card, target));
    toastWithUndo(
      t("change.changedTo", { name: target.name }),
      async () => onChangeRef.current(from),
      t("change.undoFailed"),
    );
  };
  const choose = (items: ExerciseTarget[]) => {
    const target = items[0];
    if (!target || !before || !current) return;
    if (changeDiscardsSets(current, target) && loggedSetCount(current) > 0)
      setPending({ before, current, target });
    else apply(before, current, target);
  };
  const logged = pending ? loggedSetCount(pending.current) : 0;
  const cardio = !!pending?.current.sets.some(isCardioSet);
  return (
    <>
      <ExercisePicker
        single
        title={t("exercise.changeExercise")}
        excludeId={current?.exerciseId}
        open={!!exercise}
        onClose={onClose}
        onAdd={choose}
      />
      <ConfirmDialog
        open={!!pending}
        title={t("change.title", { name: pending?.target.name ?? "" })}
        description={t(
          cardio ? "change.cardioToStrength" : "change.strengthToCardio",
          { count: logged },
        )}
        cancelLabel={t("workout.keepExercise")}
        confirmLabel={t("exercise.changeExercise")}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const choice = pending;
          setPending(null);
          if (choice) apply(choice.before, choice.current, choice.target);
        }}
      />
    </>
  );
}
