import { useState } from "react";
import { Star, Trash2, Pencil } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { catalogue, categories } from "@/data/catalogue";
import { type CustomExercise } from "@/data/model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
export default function MyExercises() {
  const { state, save } = useData();
  const [search, setSearch] = useState(""),
    [edit, setEdit] = useState<{ id: string; data: CustomExercise } | null>(
      null,
    );
  const custom = Object.values(state.records).filter(
    (r) => r.kind === "exercise" && !r.deleted,
  );
  const all = [
    ...catalogue.map((e) => ({
      ...e,
      note: "",
      favourite: custom.some(
        (r) => (r.payload as CustomExercise).note === "favourite:" + e.id,
      ),
    })),
    ...custom
      .filter(
        (r) => !(r.payload as CustomExercise).note.startsWith("favourite:"),
      )
      .map((r) => ({ id: r.id, ...(r.payload as CustomExercise) })),
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
        onClick={() =>
          setEdit({
            id: crypto.randomUUID(),
            data: { name: "", category: "Other", note: "", favourite: false },
          })
        }
      >
        Create exercise
      </button>
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
                  if (e.id.startsWith("builtin:")) {
                    const fav = custom.find(
                      (r) =>
                        (r.payload as CustomExercise).note ===
                        "favourite:" + e.id,
                    );
                    await save(
                      fav?.id || crypto.randomUUID(),
                      "exercise",
                      {
                        name: e.name,
                        category: e.category,
                        note: "favourite:" + e.id,
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
                }}
              >
                <Star size={20} fill={e.favourite ? "currentColor" : "none"} />
              </button>
              {!e.id.startsWith("builtin:") && (
                <>
                  <button
                    className="icon-button"
                    aria-label={"Edit " + e.name}
                    onClick={() => setEdit({ id: e.id, data: e })}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={"Delete " + e.name}
                    onClick={async () => {
                      await save(e.id, "exercise", e, true);
                      toast("Exercise deleted", {
                        action: {
                          label: "Undo",
                          onClick: () => void save(e.id, "exercise", e),
                        },
                      });
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercise details</DialogTitle>
            <DialogDescription>
              Names in completed workouts stay as originally recorded.
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
                disabled={!edit.data.name.trim()}
                onClick={async () => {
                  await save(edit.id, "exercise", edit.data);
                  setEdit(null);
                }}
              >
                Save exercise
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
