import { Trash2 } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { categories } from "@/data/catalogue";
import type { CustomExercise } from "@/data/model";
import { sameNamedExercise } from "@/lib/exercise-search";
import { t } from "@/i18n";
import { categoryLabel } from "@/lib/catalogue-labels";

export type ExerciseDraft = { id: string; data: CustomExercise };

/** The custom exercise form: name, category and note, kept as a draft until saved. */
export default function ExerciseEditorSheet({
  open,
  draft,
  retained,
  saved,
  busy,
  error,
  onChange,
  onSave,
  onDelete,
  onClose,
  onDiscard,
  exercises = [],
}: {
  open: boolean;
  draft: ExerciseDraft | null;
  /** False when storage refused the draft. */
  retained: boolean;
  /** The exercise exists already (editing rather than creating). */
  saved: boolean;
  busy: boolean;
  error: string;
  onChange: (draft: ExerciseDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  onDiscard: () => void;
  /** Every exercise, built-in and custom, to warn about a name in use. */
  exercises?: readonly { id: string; name: string }[];
}) {
  const set = (change: Partial<CustomExercise>) =>
    draft && onChange({ ...draft, data: { ...draft.data, ...change } });
  // Two exercises can share a name; say so, since lists can't tell them apart.
  const twin = draft && sameNamedExercise(draft.data.name, exercises, draft.id);
  return (
    <Sheet
      size="full"
      open={open && !!draft}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={saved ? t("exercises.edit") : t("exercises.new")}
      description={t("editor.description")}
    >
      {draft && (
        <>
          <label>
            {t("editor.name")}
            <input
              value={draft.data.name}
              maxLength={100}
              aria-describedby={twin ? "exercise-name-twin" : undefined}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          {twin && (
            <p id="exercise-name-twin" className="field-warning" role="status">
              {t("editor.twin", { name: twin.name })}
            </p>
          )}
          <label>
            {t("facet.category")}
            <select
              value={draft.data.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("editor.note")}
            <textarea
              value={draft.data.note}
              maxLength={1000}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !draft.data.name.trim()}
            onClick={onSave}
          >
            {busy ? t("common.saving") : t("editor.save")}
          </button>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!retained && (
            <p className="field-error" role="alert">
              {t("editor.storageUnavailable")}
            </p>
          )}
          {saved && (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={18} aria-hidden="true" />
              {t("exercises.delete")}
            </button>
          )}
          <div className="button-row">
            <button className="secondary" disabled={busy} onClick={onClose}>
              {t("routines.closeKeep")}
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={onDiscard}
            >
              {t("routines.discardDraft")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
