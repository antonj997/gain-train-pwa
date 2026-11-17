import { useMemo, useState } from "react";
import { Check, Pencil, Play, Plus, Share2 } from "lucide-react";
import type { RecordDoc } from "@/data/model";
import { ownExercises } from "@/data/exercises";
import type { LastSession } from "@/data/workouts";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  PreviewExercises,
  SetsBar,
  type PreviewItem,
} from "@/components/library/RoutinePreviewParts";
import { sharedRoutinePreview } from "@/lib/shared-routine-preview";
import {
  matchingCustom,
  parseSharedPayload,
  type SharedRoutineRow,
} from "@/lib/shared-routines";
import { sharedByLine } from "@/lib/display-name";
import { countLabel, durationLabel } from "@/lib/labels";
import { plannedSetsByCategory } from "@/lib/routine-library";
import { lastResultText, previewSetsLine } from "@/lib/routine-preview";
import {
  sharedAsExercises,
  sharedExerciseFacts,
} from "@/lib/routine-tile-facts";
import { useT } from "@/i18n/useT";

type Props = {
  row: SharedRoutineRow | null;
  records: Record<string, RecordDoc>;
  /** The user's last session of each exercise, by exercise id. */
  sessions: ReadonlyMap<string, LastSession>;
  /** Its length: your own routine's history, else an estimate from its sets. */
  minutes: number | null;
  /** The user already saved a copy. */
  added: boolean;
  /** This row is being saved. */
  adding: boolean;
  /** Something else is being saved, shared or started. */
  busy: boolean;
  /** Your own row whose routine is still here: Dela and Redigera. */
  canEdit: boolean;
  onClose: () => void;
  onAdd: () => void;
  onTry: () => void;
  onShare: () => void;
  onEdit: () => void;
  onStopSharing: () => void;
};

/**
 * Upptäck: a shared routine's preview. Who shared it, its note and focus,
 * the sets per muscle group, and every exercise with its sets by structure
 * (they carry no values) and, where you have done it, your own last result
 * ("Din förra 80 × 8"; "Ny för dig" otherwise). Someone else's has Spara
 * (then "Sparad ✓") and Prova en gång; your own has Dela and Redigera.
 */
export default function SharedRoutinePreviewSheet({
  row,
  records,
  sessions,
  minutes,
  added,
  adding,
  busy,
  canEdit,
  onClose,
  onAdd,
  onTry,
  onShare,
  onEdit,
  onStopSharing,
}: Props) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const preview = useMemo(() => {
    if (!row) return null;
    const summary = sharedRoutinePreview(row, records);
    const parsed = parseSharedPayload(row.payload);
    const planned = sharedAsExercises(row);
    const own = ownExercises(records);
    const facts = parsed.map(sharedExerciseFacts);
    const categoryOf = new Map(
      planned.map((ex, i) => [ex.exerciseId, facts[i].category]),
    );
    const items = parsed.map((exercise, index): PreviewItem => {
      // The user's own exercise this one is: a built-in, or a matching custom.
      const mine =
        exercise.builtin ??
        (exercise.custom && matchingCustom(exercise.custom, own)?.id);
      return {
        key: String(index),
        exerciseId: facts[index].exerciseId,
        category: facts[index].category,
        equipment: facts[index].equipment,
        name: exercise.name,
        line: previewSetsLine(planned[index]),
        last: mine ? lastResultText(planned[index], sessions.get(mine)) : null,
      };
    });
    return {
      ...summary,
      items,
      groups: plannedSetsByCategory(planned, (id) => categoryOf.get(id)),
    };
  }, [row, records, sessions]);
  return (
    <>
      <Sheet
        open={!!row}
        onClose={onClose}
        size="full"
        className="shared-preview routine-preview-sheet"
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
            <SetsBar groups={preview.groups} />
            <PreviewExercises
              items={preview.items}
              lastLabel={t("routinePreview.yourLast")}
              missing={row.mine ? undefined : t("routinePreview.newForYou")}
            />
            <p className="sheet-hint">{t("sharedPreview.empty")}</p>
            <div className="sheet-footer shared-preview-footer">
              {row.mine ? (
                <>
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={onShare}
                      >
                        <Share2 size={18} aria-hidden="true" />
                        {t("routineTile.share")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={onEdit}
                      >
                        <Pencil size={18} aria-hidden="true" />
                        {t("common.edit")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busy}
                      onClick={() => setConfirming(true)}
                    >
                      <Share2 size={18} aria-hidden="true" />
                      {t("exercises.stopSharing")}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      added || busy || adding || !preview.exercises.length
                    }
                    onClick={onAdd}
                  >
                    {added ? (
                      <Check size={18} aria-hidden="true" />
                    ) : (
                      <Plus size={18} aria-hidden="true" />
                    )}
                    {added
                      ? t("discover.saved")
                      : adding
                        ? t("discover.saving")
                        : t("discover.save")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy || adding || !preview.exercises.length}
                    onClick={onTry}
                  >
                    <Play
                      size={16}
                      fill="currentColor"
                      stroke="none"
                      aria-hidden="true"
                    />
                    {t("discover.tryOnce")}
                  </button>
                  <p className="row-sub">{t("discover.tryHint")}</p>
                </>
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
