import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { Search, Check, Plus, X } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useData } from "@/contexts/useData";
import { catalogue, categories, equipmentTypes } from "@/data/catalogue";
import FacetChips from "@/components/FacetChips";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import { matchesFacets, searchExercises } from "@/lib/exercise-search";
import { type CustomExercise } from "@/data/model";
import { workouts } from "@/data/selectors";
import { favouriteIds, ownExercises, visibleExercises } from "@/data/exercises";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { draftKey, parseCustomDraft } from "@/lib/drafts";

export type PickedExercise = { id: string; name: string; category?: string };

export type PickerOptions = {
  onClose: () => void;
  onAdd: (items: PickedExercise[]) => void;
  /** Categories to suggest from; the picker opens on a "Suggested" filter. */
  suggested?: string[];
  /** Choosing an exercise adds it at once and closes the picker. */
  single?: boolean;
  /** Replaces the default heading, for example "Change exercise". */
  title?: string;
  /** An exercise to leave out of the list, such as the one being replaced. */
  excludeId?: string;
};

/** The picker's content: search, filters, the list and "New exercise". Mounted only while open. */
export default function ExercisePickerBody({
  onClose,
  onAdd,
  suggested,
  single = false,
  title,
  excludeId,
  busyRef,
}: PickerOptions & {
  /** Tells the dialog not to close while a new exercise saves. */
  busyRef: MutableRefObject<boolean>;
}) {
  const initialFilter = suggested?.length ? "Suggested" : "All";
  const { state, save } = useData();
  const { hidden } = useHiddenExercises();
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
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [filter, setFilter] = useState(initialFilter),
    [equipment, setEquipment] = useState(""),
    [creating, setCreating] = useState(false);
  const [busy, setBusyState] = useState(false);
  const setBusy = (value: boolean) => {
    busyRef.current = value;
    setBusyState(value);
  };
  const [error, setError] = useState("");
  const { all, recent, favourites } = useMemo(
    () => ({
      all: [...catalogue, ...ownExercises(state.records)],
      recent: new Set(
        workouts(state.records)
          .slice(0, 5)
          .flatMap((r) => r.payload.exercises.map((e) => e.exerciseId)),
      ),
      favourites: favouriteIds(state.records),
    }),
    [state.records],
  );
  const items = useMemo(
    () =>
      searchExercises(
        visibleExercises(all, hidden)
          .filter(
            (e) =>
              e.id !== excludeId &&
              matchesFacets(e, {
                category: categories.includes(filter) ? filter : "",
                equipment,
              }) &&
              (filter === "Suggested"
                ? !!suggested?.includes(e.category)
                : filter === "Recent"
                  ? recent.has(e.id)
                  : filter === "Favourites"
                    ? favourites.has(e.id)
                    : true),
          )
          .sort(
            (a, b) =>
              Number(recent.has(b.id)) - Number(recent.has(a.id)) ||
              a.name.localeCompare(b.name),
          ),
        search,
      ),
    [
      all,
      hidden,
      excludeId,
      filter,
      equipment,
      suggested,
      recent,
      favourites,
      search,
    ],
  );
  // Closing unmounts this body, which resets the search, filters and choices.
  const close = () => {
    if (busy) return;
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
      onAdd([{ id, name: name.trim(), category }]);
      creationDraft.replace(null);
      busyRef.current = false;
      onClose();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          "Could not save. Your entries are still here; retry.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const searching = !creating && (searchFocused || !!search.trim());
  return (
    <>
      <DialogHeader>
        <DialogTitle tabIndex={-1} className="picker-title">
          {creating
            ? "Create exercise"
            : title
              ? title
              : single
                ? "Choose an exercise"
                : "Add exercises"}
        </DialogTitle>
        <DialogDescription
          className={"picker-description" + (searching ? " is-searching" : "")}
        >
          {creating
            ? "Create it once and use it in any workout. Unfinished details are kept on this phone."
            : single
              ? "Tap an exercise to choose it."
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
          <div className="facet-chips" role="group" aria-label="Show">
            {[
              ...(suggested?.length ? ["Suggested"] : []),
              "All",
              "Recent",
              "Favourites",
              ...categories,
            ].map((c) => (
              <button
                key={c}
                type="button"
                className="filter-chip"
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <FacetChips
            name="Equipment"
            options={equipmentTypes}
            value={equipment}
            onChange={setEquipment}
          />
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
                  "exercise-choice " + (selected.includes(e.id) ? "chosen" : "")
                }
                onClick={() => {
                  if (single) {
                    onAdd([e]);
                    close();
                  } else
                    setSelected((s) =>
                      s.includes(e.id)
                        ? s.filter((id) => id !== e.id)
                        : [...s, e.id],
                    );
                }}
              >
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {e.category}
                    {"equipment" in e ? ` · ${e.equipment}` : ""}
                    {recent.has(e.id) ? " · Recent" : ""}
                  </small>
                </span>
                {single ? null : selected.includes(e.id) ? (
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
            {!single && (
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
            )}
          </div>
        </>
      )}
    </>
  );
}
