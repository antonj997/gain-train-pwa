import { memo } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import FavouriteStar from "@/components/ui/FavouriteStar";
import { exerciseSub, type LibraryExercise } from "@/lib/library";
import { exercisePath } from "@/lib/routes";
import { t } from "@/i18n";

/**
 * One exercise in the Library list: its name and details (opening the
 * exercise page), a star when it is a favourite, and its menu or Unhide. The
 * star only marks it; Favourite is in the menu and on the exercise page.
 */
function ExerciseRow({
  exercise: e,
  now,
  onUnhide,
  onMenu,
}: {
  exercise: LibraryExercise;
  now: string;
  onUnhide: (exercise: LibraryExercise) => void;
  onMenu: (exercise: LibraryExercise) => void;
}) {
  const text = (
    <>
      <span className="row-title exercise-name">
        {e.name}
        {e.favourite && <FavouriteStar />}
        {e.custom && <span className="stat-chip">{t("exercises.mine")}</span>}
        {e.sharedId && (
          <span className="stat-chip strong">{t("exercises.shared")}</span>
        )}
      </span>
      <span className="row-sub">{exerciseSub(e, now)}</span>
    </>
  );
  return (
    <div className="row exercise-row">
      <Link className="row-main row-open" to={exercisePath(e.id)}>
        {text}
      </Link>
      {e.hidden ? (
        <button
          type="button"
          className="unhide"
          aria-label={t("exercises.unhideNamed", { name: e.name })}
          onClick={() => onUnhide(e)}
        >
          {t("exercises.unhide")}
        </button>
      ) : (
        <button
          type="button"
          className="icon-btn"
          aria-label={t("exercises.moreFor", { name: e.name })}
          onClick={() => onMenu(e)}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default memo(ExerciseRow);
