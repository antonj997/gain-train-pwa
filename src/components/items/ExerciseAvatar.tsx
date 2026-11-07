import { memo, useContext } from "react";
import { DataContext } from "@/contexts/useData";
import MovementIcon from "@/components/icons/exercise/MovementIcon";
import { exerciseCategory } from "@/data/selectors";
import { categoryTone, movementIcon } from "@/lib/movement-icon";

type Props = {
  /** A catalogue id ("builtin:squat") or a custom exercise's id. */
  exerciseId: string;
  /** The main category when the caller knows it; otherwise it is looked up. */
  category?: string;
  equipment?: string;
  /** 40 in rows and cards, 60 in the exercise page header. */
  size?: 40 | 60;
  className?: string;
};

/**
 * An exercise's avatar: a circle tinted by its main category with its
 * movement icon (22px in the 40px circle, 34px in the 60px one). Your own
 * exercises show the dumbbell in their category's tint. Decorative: the
 * name is always beside it.
 */
function ExerciseAvatar({
  exerciseId,
  category,
  equipment,
  size = 40,
  className,
}: Props) {
  const data = useContext(DataContext);
  const main =
    category ??
    (data ? exerciseCategory(data.state.records, exerciseId) : undefined);
  const movement = movementIcon({ id: exerciseId, category: main, equipment });
  return (
    <span
      className={
        "ex-avatar" +
        (size === 60 ? " ex-avatar-lg" : "") +
        (className ? " " + className : "")
      }
      data-tone={categoryTone(main)}
      aria-hidden="true"
    >
      <MovementIcon movement={movement} size={size === 60 ? 34 : 22} />
    </span>
  );
}

export default memo(ExerciseAvatar);
