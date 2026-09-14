import { useRef, useState } from "react";
import { Search, Check, Star, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { catalogue, categories } from "@/data/catalogue";
import { type CustomExercise, type Workout } from "@/data/model";
export default function ExercisePicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: { id: string; name: string }[]) => void;
}) {
  const { state, save } = useData();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [filter, setFilter] = useState("All"),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [category, setCategory] = useState("Other");
  const custom = Object.values(state.records)
    .filter((r) => r.kind === "exercise" && !r.deleted)
    .map((r) => ({ id: r.id, ...(r.payload as CustomExercise) }));
  const all = [...catalogue, ...custom];
  const recent = new Set(
    Object.values(state.records)
      .filter((r) => r.kind === "workout" && !r.deleted)
      .sort((a, b) =>
        (b.payload as Workout).date.localeCompare((a.payload as Workout).date),
      )
      .slice(0, 5)
      .flatMap((r) =>
        (r.payload as Workout).exercises.map((e) => e.exerciseId),
      ),
  );
  const favourite = (id: string) =>
    custom.some((e) => e.id === id && e.favourite) ||
    Object.values(state.records).some(
      (r) =>
        r.kind === "exercise" &&
        !r.deleted &&
        (r.payload as CustomExercise).note === "favourite:" + id,
    );
  const items = all
    .filter(
      (e) =>
        !(
          "note" in e &&
          typeof e.note === "string" &&
          e.note.startsWith("favourite:")
        ) &&
        e.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "All" ||
          (filter === "Recent" && recent.has(e.id)) ||
          (filter === "Favourites" && favourite(e.id)) ||
          e.category === filter),
    )
    .sort(
      (a, b) =>
        Number(recent.has(b.id)) - Number(recent.has(a.id)) ||
        a.name.localeCompare(b.name),
    );
  const close = () => {
    setSelected([]);
    setSearch("");
    setCreating(false);
    onClose();
  };
  const create = async () => {
    if (!name.trim()) return;
    const match = all.find(
      (e) => e.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (match) {
      onAdd([match]);
      close();
      return;
    }
    const id = crypto.randomUUID();
    await save(id, "exercise", {
      name: name.trim(),
      category,
      note: "",
      favourite: false,
    });
    onAdd([{ id, name: name.trim() }]);
    close();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent
        className="picker-dialog"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="picker-title">
            {creating ? "Create exercise" : "Add exercises"}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? "Create it once and use it in any workout."
              : "Choose one or more exercises."}
          </DialogDescription>
        </DialogHeader>
        {creating ? (
          <div className="stack">
            <label>
              Exercise name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              onClick={() => void create()}
              disabled={!name.trim()}
            >
              Create and add
            </button>
            <button className="secondary" onClick={() => setCreating(false)}>
              Back to exercises
            </button>
          </div>
        ) : (
          <>
            <div className="search-field">
              <Search size={19} />
              <input
                aria-label="Search exercises"
                placeholder="Search exercises"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="chips">
              {["All", "Recent", "Favourites", ...categories].map((c) => (
                <button
                  key={c}
                  className={filter === c ? "chip selected" : "chip"}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="picker-list">
              {items.map((e) => (
                <button
                  key={e.id}
                  className={
                    "exercise-choice " +
                    (selected.includes(e.id) ? "chosen" : "")
                  }
                  onClick={() =>
                    setSelected((s) =>
                      s.includes(e.id)
                        ? s.filter((id) => id !== e.id)
                        : [...s, e.id],
                    )
                  }
                >
                  <span>
                    <strong>{e.name}</strong>
                    <small>
                      {e.category}
                      {recent.has(e.id) ? " · Recent" : ""}
                    </small>
                  </span>
                  {selected.includes(e.id) ? (
                    <Check size={21} />
                  ) : (
                    <Plus size={20} />
                  )}
                </button>
              ))}
              {!items.length && (
                <p className="empty">
                  No matching exercises. Try another search or create one.
                </p>
              )}
            </div>
            <button
              className="text-button"
              onClick={() => {
                setName(search);
                setCreating(true);
              }}
            >
              Create custom exercise
            </button>
            <button
              className="primary"
              disabled={!selected.length}
              onClick={() => {
                onAdd(all.filter((e) => selected.includes(e.id)));
                close();
              }}
            >
              Add {selected.length || ""}{" "}
              {selected.length === 1 ? "exercise" : "exercises"}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
