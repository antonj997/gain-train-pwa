import { memo, useContext } from "react";
import { DataContext } from "@/contexts/useData";
import ExerciseIcon from "@/components/muscles/ExerciseIcon";
import { exerciseCategory } from "@/data/selectors";
import { categoryTone } from "@/lib/exercise-icon";

type Props = {
  /** A catalogue id ("builtin:squat") or a custom exercise's id. */
  exerciseId: string;
  /** The main category when the caller knows it; otherwise it is looked up. */
  category?: string;
  /** 40 in rows and cards, 60 in the exercise page header. */
  size?: 40 | 60;
  className?: string;
};

/**
 * An exercise's avatar: a circle tinted by its main category with its icon
 * (exerciseIcon): the muscle figure about 30px tall in the 40px circle and
 * 46px in the 60px one, or your own exercise's equipment glyph (22px, 34px).
 * Decorative: the name is always beside it.
 */
function ExerciseAvatar({ exerciseId, category, size = 40, className }: Props) {
  const data = useContext(DataContext);
  const main =
    category ??
    (data ? exerciseCategory(data.state.records, exerciseId) : undefined);
  const large = size === 60;
  return (
    <span
      className={
        "ex-avatar" +
        (large ? " ex-avatar-lg" : "") +
        (className ? " " + className : "")
      }
      data-tone={categoryTone(main)}
      aria-hidden="true"
    >
      <ExerciseIcon
        exerciseId={exerciseId}
        category={main}
        glyph={large ? 34 : 22}
        body={large ? 50 : 32}
      />
    </span>
  );
}

export default memo(ExerciseAvatar);
