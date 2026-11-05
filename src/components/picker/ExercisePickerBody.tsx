import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Search, Check, Plus, X } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useData } from "@/contexts/useData";
import { catalogue, categories, equipmentTypes } from "@/data/catalogue";
import FacetChips from "@/components/FacetChips";
import { CollapsibleFilters, FilterToggle } from "@/components/SearchFilters";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import {
  inCategory,
  matchesFacets,
  sameNamedExercise,
  searchExercises,
} from "@/lib/exercise-search";
import { type CustomExercise } from "@/data/model";
import type { ExerciseDefaults } from "@/data/workouts";
import { workouts } from "@/data/selectors";
import { favouriteIds, ownExercises, visibleExercises } from "@/data/exercises";
import {
  categoryGroups,
  favouriteGroups,
  type ExerciseGroup,
} from "@/lib/library";
import FavouriteStar from "@/components/ui/FavouriteStar";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { coarsePointer } from "@/lib/touch";
import { t, type MessageKey } from "@/i18n";
import {
  categoryLabel,
  categoryText,
  equipmentLabel,
} from "@/lib/catalogue-labels";

/** A chosen exercise; a custom one carries the defaults it was saved with. */
export type PickedExercise = { id: string; name: string } & ExerciseDefaults;

export type PickerOptions = {
  onClose: () => void;
  onAdd: (items: PickedExercise[]) => void;
  /** Categories to suggest from; the picker opens on a "Suggested" filter. */
  suggested?: string[];
  /** Choosing an exercise adds it at once and closes the picker. */
  single?: boolean;
  /** Replaces the default heading, for example "Swap exercise". */
  title?: string;
  /** An exercise to leave out of the list, such as the one being replaced. */
  excludeId?: string;
};

// The picker's own filters; the other chips are categories.
const FILTER_LABELS: Record<string, MessageKey> = {
  Suggested: "picker.suggested",
  All: "picker.all",
  Recent: "picker.recent",
  Favourites: "picker.favourites",
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const listRef = useRef<HTMLDivElement>(null);
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
  const { all, own, recent } = useMemo(() => {
    const own = ownExercises(state.records);
    const favourites = favouriteIds(state.records);
    return {
      all: [...catalogue, ...own].map((e) => ({
        ...e,
        favourite: favourites.has(e.id),
      })),
      own: new Set(own.map((e) => e.id)),
      recent: new Set(
        workouts(state.records)
          .slice(0, 5)
          .flatMap((r) => r.payload.exercises.map((e) => e.exerciseId)),
      ),
    };
  }, [state.records]);
  const twin = creating ? sameNamedExercise(name, all) : undefined;
  const categoryFilter = categories.includes(filter) ? filter : "";
  // Searching lists the best matches in one untitled group, favourites first
  // among equals. Otherwise favourites lead: with a category, see
  // categoryGroups; with All or Suggested, favourites, recent, then A–Z.
  const groups = useMemo((): ExerciseGroup<(typeof all)[number]>[] => {
    const shown = visibleExercises(all, hidden).filter(
      (e) =>
        e.id !== excludeId &&
        matchesFacets(e, { category: categoryFilter, equipment }) &&
        (filter === "Suggested"
          ? !!suggested?.some((c) => inCategory(e, c))
          : filter === "Recent"
            ? recent.has(e.id)
            : filter === "Favourites"
              ? e.favourite
              : true),
    );
    if (search.trim())
      return [
        {
          title: "",
          items: searchExercises(
            shown.sort(
              (a, b) =>
                Number(recent.has(b.id)) - Number(recent.has(a.id)) ||
                a.name.localeCompare(b.name),
            ),
            search,
            (e) => e.favourite,
          ),
        },
      ].filter((group) => group.items.length);
    if (categoryFilter) return categoryGroups(shown, categoryFilter);
    if (filter === "Recent" || filter === "Favourites")
      return favouriteGroups(shown).map((group) => ({ ...group, title: "" }));
    return favouriteGroups(
      shown,
      shown
        .filter((e) => recent.has(e.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }, [
    all,
    hidden,
    excludeId,
    filter,
    categoryFilter,
    equipment,
    suggested,
    recent,
    search,
  ]);
  const items = groups.flatMap((group) => group.items);
  // A new query or filter shows its results from the top.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [search, filter, equipment]);
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
      setError(errorMessage(cause, t("picker.saveFailed")));
    } finally {
      setBusy(false);
    }
  };
  const searching = !creating && (searchFocused || !!search.trim());
  // While searching, the results get the room: the title, the chip rows and
  // an empty footer fold away until "Filter" brings the chips back.
  const compact = searching && !filtersOpen;
  const activeFilters = Number(filter !== initialFilter) + Number(!!equipment);
  const startCreating = () => {
    if (!pending) updateDraft({ name: search.trim() });
    setCreating(true);
  };
  return (
    <>
      <DialogHeader
        className={compact ? "picker-header sr-only" : "picker-header"}
      >
        <DialogTitle tabIndex={-1} className="picker-title">
          {creating
            ? t("picker.create")
            : title
              ? title
              : single
                ? t("picker.chooseOne")
                : t("picker.addExercises")}
        </DialogTitle>
        <DialogDescription
          className={"picker-description" + (searching ? " is-searching" : "")}
        >
          {creating
            ? t("picker.createDescription")
            : single
              ? t("picker.tapToChoose")
              : t("picker.chooseMany")}
        </DialogDescription>
      </DialogHeader>
      {creating ? (
        <div className="stack">
          <label>
            {t("picker.exerciseName")}
            <input
              // A touch screen would open the keyboard before the form shows.
              autoFocus={!coarsePointer()}
              value={name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              maxLength={100}
              aria-describedby={twin ? "picker-name-twin" : undefined}
            />
          </label>
          {twin && (
            <p id="picker-name-twin" className="field-warning" role="status">
              {t("editor.twin", { name: twin.name })}
            </p>
          )}
          <label>
            {t("facet.category")}
            <select
              value={category}
              onChange={(e) => updateDraft({ category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn-primary"
            onClick={() => void create()}
            disabled={busy || !name.trim()}
          >
            {busy ? t("common.saving") : t("picker.createAndAdd")}
          </button>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!creationDraft.retained && (
            <p className="field-error" role="alert">
              {t("editor.storageUnavailable")}
            </p>
          )}
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => setCreating(false)}
          >
            {t("picker.backToExercises")}
          </button>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => {
              creationDraft.replace(null);
              setCreating(false);
            }}
          >
            {t("picker.discardDraft")}
          </button>
        </div>
      ) : (
        <>
          <div className="search-row">
            <div className="search-field">
              <Search size={19} />
              <input
                ref={searchRef}
                type="search"
                aria-label={t("exercises.search")}
                placeholder={t("exercises.search")}
                value={search}
                autoComplete="off"
                onFocus={() => {
                  setSearchFocused(true);
                  setFiltersOpen(false);
                }}
                onBlur={() => setSearchFocused(false)}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label={t("picker.clearSearch")}
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {compact && (
              <FilterToggle
                count={activeFilters}
                controls={filtersId}
                onClick={() => setFiltersOpen(true)}
              />
            )}
          </div>
          <CollapsibleFilters id={filtersId} collapsed={compact}>
            <div
              className="facet-chips"
              role="group"
              aria-label={t("picker.show")}
            >
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
                  {FILTER_LABELS[c] ? t(FILTER_LABELS[c]) : categoryLabel(c)}
                </button>
              ))}
            </div>
            <FacetChips
              name={t("facet.equipment")}
              allLabel={t("facet.allEquipment")}
              format={equipmentLabel}
              options={equipmentTypes}
              value={equipment}
              onChange={setEquipment}
            />
          </CollapsibleFilters>
          <div
            ref={listRef}
            className="picker-list"
            role="group"
            aria-label={t("picker.results")}
          >
            {groups.map((group, index) => (
              <Fragment key={group.title || index}>
                {group.title && (
                  <h3 className="group-title picker-group-title">
                    {group.title}
                  </h3>
                )}
                {group.items.map((e) => (
                  <button
                    key={e.id}
                    aria-pressed={selected.includes(e.id)}
                    className={
                      "exercise-choice " +
                      (selected.includes(e.id) ? "chosen" : "")
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
                      <strong className="exercise-name">
                        {e.name}
                        {e.favourite && <FavouriteStar />}
                        {own.has(e.id) && (
                          <span className="stat-chip">
                            {t("exercises.mine")}
                          </span>
                        )}
                      </strong>
                      <small>
                        {categoryText(e.category, e.categories)}
                        {"equipment" in e && e.equipment
                          ? ` · ${equipmentLabel(e.equipment)}`
                          : ""}
                        {recent.has(e.id) ? ` · ${t("picker.recent")}` : ""}
                      </small>
                    </span>
                    {single ? null : selected.includes(e.id) ? (
                      <Check size={21} />
                    ) : (
                      <Plus size={20} />
                    )}
                  </button>
                ))}
              </Fragment>
            ))}
            {!items.length && <p className="empty">{t("picker.noMatch")}</p>}
            {compact && (
              // "New exercise" moves out of the folded footer, to the list's end.
              <button
                type="button"
                className="exercise-choice picker-create"
                onClick={startCreating}
              >
                <span>
                  <strong>
                    {pending
                      ? t("picker.resumeDraft")
                      : search.trim()
                        ? t("picker.createNamed", { name: search.trim() })
                        : t("exercises.new")}
                  </strong>
                </span>
                <Plus size={20} aria-hidden="true" />
              </button>
            )}
          </div>
          {(!compact || (!single && selected.length > 0)) && (
            <div className="picker-footer">
              {!compact && (
                <button className="text-button" onClick={startCreating}>
                  {pending ? t("picker.resumeDraft") : t("exercises.new")}
                </button>
              )}
              {/* Hidden until something is chosen. */}
              {!single && selected.length > 0 && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    onAdd(all.filter((e) => selected.includes(e.id)));
                    close();
                  }}
                >
                  {t("picker.addCount", { count: selected.length })}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
