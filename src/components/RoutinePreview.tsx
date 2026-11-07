import { Play } from "lucide-react";
import type { RoutineRecord } from "@/data/model";
import { setCount } from "@/data/selectors";
import { countLabel, durationLabel } from "@/lib/labels";
import { lastUsedLabel } from "@/lib/library";
import {
  exerciseExtras,
  plannedSummary,
  routineMeta,
} from "@/lib/routine-preview";
import Sheet from "@/components/ui/Sheet";
import RoutineCard from "@/components/items/RoutineCard";
import ExerciseAvatar from "@/components/items/ExerciseAvatar";
import { useT } from "@/i18n/useT";

export type RoutineStats = {
  /** Average length in minutes, rounded to 5; null with no finished workout. */
  minutes: number | null;
  /** Date of the newest finished workout from the routine. */
  lastDone: string | null;
};

type RowProps = {
  routine: RoutineRecord;
  stats: RoutineStats;
  disabled?: boolean;
  onPreview: () => void;
  onStart: () => void;
};

/** A routine on Train: the card opens the preview, the play button starts it. */
export function RoutineRow({
  routine,
  stats,
  disabled,
  onPreview,
  onStart,
}: RowProps) {
  const name = routine.payload.name;
  const { t } = useT();
  return (
    <RoutineCard
      title={name}
      meta={routineMeta(routine.payload.exercises.length, stats.minutes)}
      openLabel={t("routine.preview", { name })}
      onOpen={onPreview}
      startLabel={t("routine.startNamed", { name })}
      disabled={disabled}
      onStart={onStart}
    />
  );
}

type SheetProps = {
  routine: RoutineRecord | null;
  stats: RoutineStats;
  now: string;
  disabled?: boolean;
  onClose: () => void;
  onStart: () => void;
  onEdit: () => void;
};

/** The floating preview of a routine: its totals and every planned exercise. */
export function RoutinePreviewSheet({
  routine,
  stats,
  now,
  disabled,
  onClose,
  onStart,
  onEdit,
}: SheetProps) {
  const exercises = routine?.payload.exercises ?? [];
  const { t } = useT();
  return (
    <Sheet
      open={!!routine}
      onClose={onClose}
      title={routine?.payload.name}
      size={exercises.length > 5 ? "full" : undefined}
      description={
        routine &&
        [
          countLabel(exercises.length, "exercise"),
          countLabel(setCount(routine.payload), "set"),
          stats.minutes && `~${durationLabel(stats.minutes)}`,
        ]
          .filter(Boolean)
          .join(" · ")
      }
    >
      {routine && (
        <>
          <p className="sheet-hint">
            {stats.lastDone
              ? t("routine.lastDone", {
                  when: lastUsedLabel(stats.lastDone, now),
                })
              : t("routine.neverDone")}
          </p>
          <ul className="list preview-list">
            {exercises.map((exercise) => {
              const extras = exerciseExtras(exercise);
              return (
                <li className="row preview-item" key={exercise.id}>
                  <ExerciseAvatar exerciseId={exercise.exerciseId} />
                  <span className="row-main">
                    <span className="row-title">{exercise.name}</span>
                    {extras && <span className="row-sub">{extras}</span>}
                  </span>
                  <span className="row-value">{plannedSummary(exercise)}</span>
                </li>
              );
            })}
          </ul>
          <div className="preview-actions">
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
              {t("routine.start")}
            </button>
            <button type="button" className="btn-quiet" onClick={onEdit}>
              {t("common.edit")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
