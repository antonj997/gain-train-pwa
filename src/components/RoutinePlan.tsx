import type { Exercise } from "@/data/model";
import ExerciseCard from "@/components/ExerciseCard";

/**
 * One exercise in a routine's form: the exercise card in plan mode, with the
 * same set rows and sheets as a workout but no checks, rest or previous results.
 */
export default function RoutinePlan({
  exercise,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
  onChange: (exercise: Exercise) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <ExerciseCard
      mode="plan"
      exercise={exercise}
      isFirst={isFirst}
      isLast={isLast}
      onChange={onChange}
      onMove={onMove}
      onRemove={onRemove}
    />
  );
}
