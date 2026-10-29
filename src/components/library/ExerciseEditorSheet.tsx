import { Trash2 } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { categories } from "@/data/catalogue";
import type { CustomExercise } from "@/data/model";
import { sameNamedExercise } from "@/lib/exercise-search";

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
      title={saved ? "Edit exercise" : "New exercise"}
      description="Names in completed workouts stay as originally recorded. Unfinished edits are kept when you close this form."
    >
      {draft && (
        <>
          <label>
            Name
            <input
              value={draft.data.name}
              maxLength={100}
              aria-describedby={twin ? "exercise-name-twin" : undefined}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          {twin && (
            <p id="exercise-name-twin" className="field-warning" role="status">
              You already have an exercise called {twin.name}.
            </p>
          )}
          <label>
            Category
            <select
              value={draft.data.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Note
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
            {busy ? "Saving…" : "Save exercise"}
          </button>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!retained && (
            <p className="field-error" role="alert">
              Storage is unavailable. Keep this form open until saved.
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
              Delete exercise
            </button>
          )}
          <div className="button-row">
            <button className="secondary" disabled={busy} onClick={onClose}>
              Close and keep draft
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={onDiscard}
            >
              Discard draft
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
