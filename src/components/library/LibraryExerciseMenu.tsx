import { Link } from "react-router-dom";
import { Eye, EyeOff, Share2, Star } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { exerciseSub, type LibraryExercise } from "@/lib/library";

/** A Library exercise's menu: favourite, edit, share and hide. */
export default function LibraryExerciseMenu({
  exercise: menu,
  now,
  canShare,
  sharing,
  onClose,
  onToggleFavourite,
  onEdit,
  onShare,
  onStopSharing,
  onToggleHidden,
}: {
  /** The exercise whose menu is open, or null. */
  exercise: LibraryExercise | null;
  now: string;
  /** Signed in, so the user's own exercises can be shared. */
  canShare: boolean;
  sharing: boolean;
  onClose: () => void;
  onToggleFavourite: (exercise: LibraryExercise) => void;
  onEdit: (exercise: LibraryExercise) => void;
  onShare: (exercise: LibraryExercise) => void;
  onStopSharing: (exercise: LibraryExercise) => void;
  onToggleHidden: (exercise: LibraryExercise) => void;
}) {
  return (
    <Sheet
      open={!!menu}
      onClose={onClose}
      title={menu?.name ?? ""}
      description={menu ? exerciseSub(menu, now) : undefined}
    >
      {menu && (
        <div className="exercise-menu-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onToggleFavourite(menu)}
          >
            <Star size={18} aria-hidden="true" />
            {menu.favourite ? "Unfavourite" : "Favourite"}
          </button>
          {menu.custom && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onEdit(menu)}
            >
              Edit exercise
            </button>
          )}
          {menu.custom &&
            (canShare ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={sharing}
                onClick={() =>
                  menu.sharedId ? onStopSharing(menu) : onShare(menu)
                }
              >
                <Share2 size={18} aria-hidden="true" />
                {sharing
                  ? "Working…"
                  : menu.sharedId
                    ? "Stop sharing"
                    : "Share to library"}
              </button>
            ) : (
              <Link to="/auth" className="btn-secondary">
                <Share2 size={18} aria-hidden="true" />
                Sign in to share
              </Link>
            ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onToggleHidden(menu)}
          >
            {menu.hidden ? (
              <Eye size={18} aria-hidden="true" />
            ) : (
              <EyeOff size={18} aria-hidden="true" />
            )}
            {menu.hidden ? "Unhide exercise" : "Hide exercise"}
          </button>
          <p className="row-sub">
            Hidden exercises leave the picker and these lists. Saved workouts
            keep them. Find them under Hidden.
          </p>
        </div>
      )}
    </Sheet>
  );
}
