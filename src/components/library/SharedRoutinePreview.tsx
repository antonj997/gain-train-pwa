import { useMemo, useState } from "react";
import { Pencil, Plus, Share2 } from "lucide-react";
import type { RecordDoc } from "@/data/model";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { sharedRoutinePreview } from "@/lib/shared-routine-preview";
import type { SharedRoutineRow } from "@/lib/shared-routines";
import { sharedByLine } from "@/lib/display-name";
import { countLabel, durationLabel } from "@/lib/labels";
import { useT } from "@/i18n/useT";

type Props = {
  row: SharedRoutineRow | null;
  records: Record<string, RecordDoc>;
  /** Average length of the user's own routine this row was shared from, if known. */
  minutes: number | null;
  /** The user already has a copy. */
  added: boolean;
  /** This row is being added. */
  adding: boolean;
  /** Something else is being added, shared or unshared. */
  busy: boolean;
  /** The user's own row and its routine still exists here, so it can be edited. */
  canEdit: boolean;
  onClose: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onStopSharing: () => void;
};

/**
 * The full preview of a shared routine before adding it: who shared it, its
 * note and categories, and every exercise with its sets by structure (they
 * carry no values). Someone else's routine can be added; the user's own one
 * edited or stopped sharing.
 */
export default function SharedRoutinePreviewSheet({
  row,
  records,
  minutes,
  added,
  adding,
  busy,
  canEdit,
  onClose,
  onAdd,
  onEdit,
  onStopSharing,
}: Props) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const preview = useMemo(
    () => (row ? sharedRoutinePreview(row, records) : null),
    [row, records],
  );
  return (
    <>
      <Sheet
        open={!!row}
        onClose={onClose}
        size="full"
        className="shared-preview"
        title={row?.name}
        description={
          preview &&
          [
            countLabel(preview.exercises.length, "exercise"),
            countLabel(preview.sets, "set"),
            minutes && `~${durationLabel(minutes)}`,
          ]
            .filter(Boolean)
            .join(" · ")
        }
      >
        {row && preview && (
          <>
            <p className="sheet-hint shared-preview-by">
              {row.mine ? t("sharedPreview.byYou") : sharedByLine(row.by_name)}
            </p>
            {row.note && <p className="sheet-note">{row.note}</p>}
            {preview.categories.length > 0 && (
              <div className="shared-preview-categories">
                {preview.categories.map((category) => (
                  <span className="stat-chip" key={category}>
                    {category}
                  </span>
                ))}
              </div>
            )}
            <ul className="list preview-list">
              {preview.exercises.map((exercise) => (
                <li className="row preview-item" key={exercise.key}>
                  <span className="row-main">
                    <span className="row-title exercise-name">
                      {exercise.name}
                      {exercise.isNew && !row.mine && (
                        <span className="stat-chip warm">
                          {t("sharedPreview.newExercise")}
                        </span>
                      )}
                    </span>
                    {exercise.lines.map((line) => (
                      <span className="row-sub" key={line}>
                        {line}
                      </span>
                    ))}
                  </span>
                  <span className="row-value">{exercise.headline}</span>
                </li>
              ))}
            </ul>
            <p className="sheet-hint">{t("sharedPreview.empty")}</p>
            <div className="sheet-footer shared-preview-footer">
              {row.mine ? (
                <>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={onEdit}
                    >
                      <Pencil size={18} aria-hidden="true" />
                      {t("common.edit")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => setConfirming(true)}
                  >
                    <Share2 size={18} aria-hidden="true" />
                    {t("exercises.stopSharing")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    added || busy || adding || !preview.exercises.length
                  }
                  onClick={onAdd}
                >
                  {!added && <Plus size={18} aria-hidden="true" />}
                  {added
                    ? t("sharedPreview.alreadyAdded")
                    : adding
                      ? t("shared.adding")
                      : t("sharedPreview.add")}
                </button>
              )}
            </div>
          </>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirming && !!row}
        title={t("sharedPreview.stopTitle", { name: row?.name ?? "" })}
        description={t("sharedPreview.stopText")}
        cancelLabel={t("sharedPreview.keepSharing")}
        confirmLabel={t("exercises.stopSharing")}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onStopSharing();
        }}
      />
    </>
  );
}
