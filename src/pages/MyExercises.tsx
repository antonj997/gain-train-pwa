import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { Star, Trash2, Pencil } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { catalogue, categories } from "@/data/catalogue";
import { favouriteMarker, favouriteNote, ownExercises } from "@/data/exercises";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
export default function MyExercises() {
  const { state, save, deleteRecord } = useData();
  const { account } = useAuth();
  const draft = useRetainedDraft(
    draftKey(account, "exercise"),
    parseCustomDraft,
  );
  const edit = draft.value;
  const setEdit = draft.replace;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const all = [
    ...catalogue.map((e) => ({
      ...e,
      note: "",
      favourite: !!favouriteMarker(state.records, e.id),
    })),
    ...ownExercises(state.records),
  ];
  return (
    <div className="stack">
      <h1>Exercises</h1>
      <input
        placeholder="Search exercises"
        aria-label="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button
        className="primary"
        onClick={() => {
          if (!edit)
            setEdit({
              id: crypto.randomUUID(),
              data: { name: "", category: "Other", note: "", favourite: false },
            });
          setOpen(true);
        }}
      >
        {edit ? "Resume exercise draft" : "Create exercise"}
      </button>
      {edit && !open && (
        <p className="draft-receipt">
          Unfinished exercise: {edit.data.name || "Untitled"}.{" "}
          {draft.retained
            ? "Kept on this phone."
            : "Keep this page open; storage is unavailable."}
        </p>
      )}
      {all
        .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
        .map((e) => (
          <div className="list-card" key={e.id}>
            <span>
              <strong>{e.name}</strong>
              <small>{e.category}</small>
            </span>
            <div className="button-row">
              <button
                className={"icon-button " + (e.favourite ? "starred" : "")}
                aria-label={
                  (e.favourite ? "Unfavourite " : "Favourite ") + e.name
                }
                aria-pressed={e.favourite}
                onClick={async () => {
                  try {
                    if (e.id.startsWith("builtin:")) {
                      const fav = favouriteMarker(state.records, e.id);
                      await save(
                        fav?.id || crypto.randomUUID(),
                        "exercise",
                        {
                          name: e.name,
                          category: e.category,
                          note: favouriteNote(e.id),
                          favourite: true,
                        },
                        !!fav,
                      );
                    } else
                      await save(e.id, "exercise", {
                        name: e.name,
                        category: e.category,
                        note: e.note,
                        favourite: !e.favourite,
                      });
                  } catch {
                    toast.error("Could not update favourite. Retry.");
                  }
                }}
              >
                <Star size={20} fill={e.favourite ? "currentColor" : "none"} />
              </button>
              {!e.id.startsWith("builtin:") && (
                <>
                  <button
                    className="icon-button"
                    aria-label={"Edit " + e.name}
                    onClick={() => {
                      if (edit && edit.id !== e.id)
                        toast(
                          "Resume or discard the existing exercise draft first.",
                        );
                      else if (!edit) setEdit({ id: e.id, data: e });
                      setOpen(true);
                    }}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={"Delete " + e.name}
                    onClick={() => setDeleting({ id: e.id, name: e.name })}
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      <ConfirmDialog
        open={!!deleting}
        title={<>Delete {deleting?.name}?</>}
        description="This removes the exercise from your library. Its entries in saved workouts and routines stay intact."
        cancelLabel="Keep exercise"
        confirmLabel={busy ? "Deleting…" : "Delete exercise"}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting || busy) return;
          setBusy(true);
          try {
            await deleteRecord(deleting.id);
            if (edit?.id === deleting.id) setEdit(null);
            setDeleting(null);
            toast("Exercise deleted");
          } catch {
            toast.error("Could not delete. The exercise is still here; retry.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Dialog
        open={open && !!edit}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercise details</DialogTitle>
            <DialogDescription>
              Names in completed workouts stay as originally recorded.
              Unfinished edits are kept when you close this form.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <>
              <label>
                Name
                <input
                  value={edit.data.name}
                  maxLength={100}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, name: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={edit.data.category}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, category: e.target.value },
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <textarea
                  value={edit.data.note}
                  maxLength={1000}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, note: e.target.value },
                    })
                  }
                />
              </label>
              <button
                className="primary"
                disabled={busy || !edit.data.name.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await save(edit.id, "exercise", edit.data);
                    setEdit(null);
                    setOpen(false);
                    toast.success("Exercise saved");
                  } catch (cause) {
                    setError(
                      errorMessage(
                        cause,
                        "Could not save. Your draft is kept here.",
                      ),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save exercise"}
              </button>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {!draft.retained && (
                <p className="field-error" role="alert">
                  Storage is unavailable. Keep this form open until saved.
                </p>
              )}
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Close and keep draft
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    setEdit(null);
                    setOpen(false);
                  }}
                >
                  Discard draft
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
