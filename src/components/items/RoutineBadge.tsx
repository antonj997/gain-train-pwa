import { memo, useContext } from "react";
import { Layers } from "lucide-react";
import { DataContext } from "@/contexts/useData";
import MovementIcon from "@/components/icons/exercise/MovementIcon";
import { exerciseCategory } from "@/data/selectors";
import { categoryTone, movementIcon } from "@/lib/movement-icon";

type Props = {
  /** The routine's exercises in order; the first one leads. */
  exercises: readonly { exerciseId: string }[];
  /** 48 on routine cards (30px icon), 56 on the Today card (34px icon). */
  size?: 48 | 56;
  /** Show the exercise count at the corner (on by default). */
  count?: boolean;
  className?: string;
};

/**
 * A routine's badge: a rounded tile tinted by its leading exercise's main
 * category, with that exercise's movement icon and a count badge at the
 * corner. One icon per routine, no mosaic. A routine without exercises shows
 * the layers icon. Decorative: the routine's name is always beside it.
 */
function RoutineBadge({
  exercises,
  size = 48,
  count = true,
  className,
}: Props) {
  const data = useContext(DataContext);
  const lead = exercises[0];
  const category =
    lead && data ? exerciseCategory(data.state.records, lead.exerciseId) : "";
  const icon = size === 56 ? 34 : 30;
  return (
    <span
      className={
        "routine-badge" +
        (size === 56 ? " is-lg" : "") +
        (className ? " " + className : "")
      }
      data-tone={lead ? categoryTone(category) : undefined}
      aria-hidden="true"
    >
      {lead ? (
        <MovementIcon
          movement={movementIcon({ id: lead.exerciseId, category })}
          size={icon}
        />
      ) : (
        <Layers size={icon - 6} />
      )}
      {count && exercises.length > 0 && (
        <span className="routine-badge-count">{exercises.length}</span>
      )}
    </span>
  );
}

export default memo(RoutineBadge);
