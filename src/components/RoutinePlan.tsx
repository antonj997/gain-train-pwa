import ExerciseCard, {
  type ExerciseCardProps,
} from "@/components/ExerciseCard";

/**
 * One exercise in a routine's form: the exercise card in plan mode, with the
 * same set rows and sheets as a workout but no checks or rest. `lastSession`
 * gives the Förra column and the empty fields' grey placeholders.
 */
export default function RoutinePlan(
  props: Omit<ExerciseCardProps, "mode" | "nextSetId">,
) {
  return <ExerciseCard mode="plan" {...props} />;
}
