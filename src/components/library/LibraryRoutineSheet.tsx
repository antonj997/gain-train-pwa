import { useMemo } from "react";
import { Info, MoreHorizontal, Pencil, Play } from "lucide-react";
import type { RecordDoc, RoutineRecord } from "@/data/model";
import { exerciseCategory, setCount } from "@/data/selectors";
import type { LastSession } from "@/data/workouts";
import { isDrop } from "@/data/drops";
import Sheet from "@/components/ui/Sheet";
import {
  PreviewExercises,
  SetsBar,
  type PreviewItem,
} from "@/components/library/RoutinePreviewParts";
import { countLabel, durationLabel } from "@/lib/labels";
import { lastUsedLabel } from "@/lib/library";
import { plannedSetsByCategory } from "@/lib/routine-library";
import { lastResultText, previewSetsLine } from "@/lib/routine-preview";
import { hasTarget } from "@/lib/routine-targets";
import { shortSetText } from "@/lib/set-target";
import { useT } from "@/i18n/useT";

type Props = {
  routine: RoutineRecord | null;
  records: Record<string, RecordDoc>;
  /** The last session of each exercise, by exercise id. */
  sessions: ReadonlyMap<string, LastSession>;
  minutes: number | null;
  lastDone: string | undefined;
  now: string;
  disabled?: boolean;
  onClose: () => void;
  onStart: () => void;
  onEdit: () => void;
  onMenu: () => void;
};

/**
 * Library → Routines: a tile's preview. "3 övningar · 8 set · ~45 min ·
 * senast mån 16 nov", the sets per muscle group as one bar, and every
 * exercise with its sets and last time's result in grey ("Förra 70 × 8").
 * Starta, Redigera and ⋯.
 */
export default function LibraryRoutineSheet({
  routine,
  records,
  sessions,
  minutes,
  lastDone,
  now,
  disabled,
  onClose,
  onStart,
  onEdit,
  onMenu,
}: Props) {
  const { t } = useT();
  const exercises = useMemo(() => routine?.payload.exercises ?? [], [routine]);
  const categoryOf = (id: string) => exerciseCategory(records, id);
  const items = exercises.map((exercise): PreviewItem => {
    const first = exercise.sets.find(
      (s) => s.section === "working" && !isDrop(s) && hasTarget(s),
    );
    return {
      key: exercise.id,
      exerciseId: exercise.exerciseId,
      category: categoryOf(exercise.exerciseId),
      name: exercise.name,
      line: previewSetsLine(exercise),
      last: lastResultText(exercise, sessions.get(exercise.exerciseId)),
      target: first ? shortSetText(first, first) : null,
    };
  });
  const name = routine?.payload.name ?? "";
  return (
    <Sheet
      open={!!routine}
      onClose={onClose}
      size={exercises.length > 4 ? "full" : undefined}
      className="routine-preview-sheet"
      title={name}
      description={
        routine
          ? [
              countLabel(exercises.length, "exercise"),
              countLabel(setCount(routine.payload), "set"),
              minutes && `~${durationLabel(minutes)}`,
              lastDone
                ? t("routines.lastDone", { when: lastUsedLabel(lastDone, now) })
                : t("routines.neverDone"),
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      headerAction={
        <button
          type="button"
          className="icon-btn"
          aria-label={t("routines.options", { name })}
          aria-haspopup="dialog"
          onClick={onMenu}
        >
          <MoreHorizontal size={22} aria-hidden="true" />
        </button>
      }
    >
      {routine && (
        <>
          <SetsBar groups={plannedSetsByCategory(exercises, categoryOf)} />
          <PreviewExercises
            items={items}
            lastLabel={t("exercise.colPrevious")}
          />
          <p className="sheet-hint routine-preview-note">
            <Info size={16} aria-hidden="true" />
            <span>{t("routinePreview.note")}</span>
          </p>
          <div className="sheet-footer routine-preview-actions">
            <button
              type="button"
              className="btn-primary btn-block"
              disabled={disabled}
              onClick={onStart}
            >
              <Play
                size={18}
                fill="currentColor"
                stroke="none"
                aria-hidden="true"
              />
              {t("routinePreview.start")}
            </button>
            <button
              type="button"
              className="btn-secondary btn-block"
              disabled={disabled}
              onClick={onEdit}
            >
              <Pencil size={18} aria-hidden="true" />
              {t("common.edit")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
