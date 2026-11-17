import { memo } from "react";
import MovementIcon from "@/components/icons/exercise/MovementIcon";
import { categoryTone, movementIcon } from "@/lib/movement-icon";

type Props = {
  /** A catalogue id ("builtin:squat"), a custom exercise's id or "shared:…". */
  exerciseId: string;
  /** Its main category, for the tint (and the icon of an unknown id). */
  category?: string;
  equipment?: string;
  /** 28 on tiles, 36 in rows and the preview. */
  size?: 28 | 36;
};

/**
 * An exercise's icon in the Library's tiles, previews and Discover rows: a
 * rounded square tinted by its main category with its movement icon. The one
 * place these draw an exercise icon, so another icon set can replace it
 * here alone. Decorative: the name is always beside it.
 */
function RoutineGlyph({ exerciseId, category, equipment, size = 28 }: Props) {
  return (
    <span
      className={"routine-glyph" + (size === 36 ? " is-lg" : "")}
      data-tone={categoryTone(category)}
      aria-hidden="true"
    >
      <MovementIcon
        movement={movementIcon({ id: exerciseId, category, equipment })}
        size={size === 36 ? 22 : 17}
      />
    </span>
  );
}

export default memo(RoutineGlyph);
