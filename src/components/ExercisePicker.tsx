import { useRef, useState } from "react";
import { Search, Check, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useData } from "@/contexts/useData";
import { catalogue, categories } from "@/data/catalogue";
import { type CustomExercise, type Workout } from "@/data/model";
import { sortWorkoutsNewest } from "@/data/workouts";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
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
  const { account } = useAuth();
  const creationDraft = useRetainedDraft(
    draftKey(account, "picker-exercise"),
    parseCustomDraft,
  );
  const pending = creationDraft.value;
  const name = pending?.data.name ?? "";
  const category = pending?.data.category ?? "Other";
  const updateDraft = (change: Partial<CustomExercise>) =>
    creationDraft.replace({
      id: pending?.id ?? crypto.randomUUID(),
      data: {
        name: "",
        category: "Other",
        note: "",
        favourite: false,
        ...pending?.data,
        ...change,
      },
    });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [filter, setFilter] = useState("All"),
    [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const custom = Object.values(state.records)
    .filter((r) => r.kind === "exercise" && !r.deleted)
    .map((r) => ({ id: r.id, ...(r.payload as CustomExercise) }));
  const all = [...catalogue, ...custom];
  const recent = new Set(
    Object.values(state.records)
      .filter((r) => r.kind === "workout" && !r.deleted)
      .sort(sortWorkoutsNewest)
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
    if (busy) return;
    setSelected([]);
    setSearch("");
    setSearchFocused(false);
    setCreating(false);
    setError("");
    onClose();
  };
  const create = async () => {
    if (busy || !name.trim()) return;
    const match = all.find(
      (e) => e.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (match) {
      onAdd([match]);
      creationDraft.replace(null);
      close();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = pending?.id ?? crypto.randomUUID();
      await save(id, "exercise", {
        name: name.trim(),
        category,
        note: "",
        favourite: false,
      });
      onAdd([{ id, name: name.trim() }]);
      setSelected([]);
      setSearch("");
      creationDraft.replace(null);
      setCreating(false);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Your entries are still here; retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent
        className={`picker-dialog${creating ? " is-creating" : searchFocused || search.trim() ? " is-searching" : ""}`}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="picker-title">
            {creating ? "Create exercise" : "Add exercises"}
          </DialogTitle>
          <DialogDescription className="picker-description">
            {creating
              ? "Create it once and use it in any workout. Unfinished details are kept on this phone."
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
                onChange={(e) => updateDraft({ name: e.target.value })}
                maxLength={100}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => updateDraft({ category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              onClick={() => void create()}
              disabled={busy || !name.trim()}
            >
              {busy ? "Saving…" : "Create and add"}
            </button>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {!creationDraft.retained && (
              <p className="field-error" role="alert">
                Storage is unavailable. Keep this form open until saved.
              </p>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Back to exercises
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => {
                creationDraft.replace(null);
                setCreating(false);
              }}
            >
              Discard exercise draft
            </button>
          </div>
        ) : (
          <>
            <div className="search-field">
              <Search size={19} />
              <input
                ref={searchRef}
                type="search"
                aria-label="Search exercises"
                placeholder="Search exercises"
                value={search}
                autoComplete="off"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label="Clear exercise search"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="chips">
              {["All", "Recent", "Favourites", ...categories].map((c) => (
                <button
                  key={c}
                  className={filter === c ? "chip selected" : "chip"}
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div
              className="picker-list"
              role="group"
              aria-label="Exercise search results"
            >
              {items.map((e) => (
                <button
                  key={e.id}
                  aria-pressed={selected.includes(e.id)}
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
            <div className="picker-footer">
              <button
                className="text-button"
                onClick={() => {
                  if (!pending) updateDraft({ name: search });
                  setCreating(true);
                }}
              >
                {pending ? "Resume draft" : "New exercise"}
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
