import { memo } from "react";
import { MoreHorizontal, Star } from "lucide-react";
import { exerciseSub, type LibraryExercise } from "@/lib/library";

/** One exercise in the Library list: its name and details, star and menu, or Unhide. */
function ExerciseRow({
  exercise: e,
  now,
  onEdit,
  onUnhide,
  onToggleFavourite,
  onMenu,
}: {
  exercise: LibraryExercise;
  now: string;
  onEdit: (exercise: LibraryExercise) => void;
  onUnhide: (exercise: LibraryExercise) => void;
  onToggleFavourite: (exercise: LibraryExercise) => void;
  onMenu: (exercise: LibraryExercise) => void;
}) {
  const text = (
    <>
      <span className="row-title exercise-name">
        {e.name}
        {e.custom && <span className="stat-chip">Yours</span>}
        {e.sharedId && <span className="stat-chip">Shared</span>}
      </span>
      <span className="row-sub">{exerciseSub(e, now)}</span>
    </>
  );
  return (
    <div className="row exercise-row">
      {e.custom ? (
        <button
          type="button"
          className="row-main row-open"
          aria-label={"Edit " + e.name}
          onClick={() => onEdit(e)}
        >
          {text}
        </button>
      ) : (
        <span className="row-main">{text}</span>
      )}
      {e.hidden ? (
        <button
          type="button"
          className="unhide"
          aria-label={"Unhide " + e.name}
          onClick={() => onUnhide(e)}
        >
          Unhide
        </button>
      ) : (
        <>
          <button
            type="button"
            className={"icon-btn" + (e.favourite ? " starred" : "")}
            aria-label={(e.favourite ? "Unfavourite " : "Favourite ") + e.name}
            aria-pressed={e.favourite}
            onClick={() => onToggleFavourite(e)}
          >
            <Star
              size={20}
              aria-hidden="true"
              fill={e.favourite ? "currentColor" : "none"}
            />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={"More for " + e.name}
            onClick={() => onMenu(e)}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

export default memo(ExerciseRow);
