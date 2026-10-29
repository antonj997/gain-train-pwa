import ExerciseCard, {
  type ExerciseCardProps,
} from "@/components/ExerciseCard";

/**
 * One exercise in a routine's form: the exercise card in plan mode, with the
 * same set rows and sheets as a workout but no checks, rest or previous results.
 */
export default function RoutinePlan(
  props: Omit<ExerciseCardProps, "mode" | "lastSession" | "nextSetId">,
) {
  return <ExerciseCard mode="plan" {...props} />;
}
