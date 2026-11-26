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
  /**
   * "md" (44px) in rows and cards, "lg" (60px) in the exercise page header.
   * The numbers 40 and 60 are read as "md" and "lg" for older callers.
   */
  size?: "md" | "lg" | 40 | 60;
  className?: string;
};

/** Each size's figure and glyph (v6 H4: 34px figure, 24px glyphs in 44px). */
const SIZES = {
  md: { body: 34, glyph: 24 },
  lg: { body: 50, glyph: 34 },
} as const;

/**
 * An exercise's avatar: a circle tinted by its main category with its icon
 * (exerciseIcon): the muscle figure, 34px in the 44px circle and 50px in the
 * 60px one, or your own exercise's equipment glyph (24px, 34px) at a 1.8
 * line. Decorative: the name is always beside it.
 */
function ExerciseAvatar({
  exerciseId,
  category,
  size = "md",
  className,
}: Props) {
  const data = useContext(DataContext);
  const main =
    category ??
    (data ? exerciseCategory(data.state.records, exerciseId) : undefined);
  const large = size === "lg" || size === 60;
  const { body, glyph } = SIZES[large ? "lg" : "md"];
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
        glyph={glyph}
        body={body}
      />
    </span>
  );
}

export default memo(ExerciseAvatar);
