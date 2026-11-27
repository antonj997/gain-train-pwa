import ExerciseRow from "@/components/items/ExerciseRow";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Search, Plus, X } from "lucide-react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useData } from "@/contexts/useData";
import { catalogue, categories } from "@/data/catalogue";
import CategoryChips from "@/components/ui/CategoryChips";
import { matchesChip, type CategoryChip } from "@/lib/category-filter";
import { CollapsibleFilters, FilterToggle } from "@/components/SearchFilters";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import {
  inCategory,
  sameNamedExercise,
  searchExercises,
} from "@/lib/exercise-search";
import { type CustomExercise } from "@/data/model";
import type { ExerciseDefaults } from "@/data/workouts";
import { workouts } from "@/data/selectors";
import { favouriteIds, ownExercises, visibleExercises } from "@/data/exercises";
import type { ExerciseGroup } from "@/lib/library";
import FavouriteStar from "@/components/ui/FavouriteStar";
import {
  selectionItem,
  useExerciseMenu,
} from "@/components/gestures/ExerciseMenu";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { coarsePointer } from "@/lib/touch";
import { t } from "@/i18n";
import { categoryLabel } from "@/lib/catalogue-labels";
import { exerciseDisplayName, exerciseSubtitle } from "@/lib/exercise-name";

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

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

/**
 * v6 B11: "Senast använda" first (most recent first), then favourites, then
 * A–Ö; groups with nothing in them are left out.
 */
function pickerGroups<
  T extends { id: string; name: string; favourite: boolean },
>(items: readonly T[], recent: readonly string[]): ExerciseGroup<T>[] {
  const used = recent.flatMap((id) => items.filter((item) => item.id === id));
  const shown = new Set(used);
  const favourites = items
    .filter((item) => item.favourite && !shown.has(item))
    .sort(byName);
  for (const item of favourites) shown.add(item);
  return [
    { title: t("picker.recentGroup"), items: used },
    { title: t("exercises.groupFavourites"), items: favourites },
    {
      title: t("exercises.groupAz"),
      items: items.filter((item) => !shown.has(item)).sort(byName),
    },
  ].filter((group) => group.items.length);
}

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
    // v6 B11: one row of category chips; a planned day type's suggestion
    // narrows the list too until it is switched off.
    [chip, setChip] = useState<CategoryChip>("all"),
    [suggestedOnly, setSuggestedOnly] = useState(!!suggested?.length),
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
      // Most recent first, each once.
      recent: [
        ...new Set(
          workouts(state.records)
            .slice(0, 5)
            .flatMap((r) => r.payload.exercises.map((e) => e.exerciseId)),
        ),
      ],
    };
  }, [state.records]);
  const twin = creating ? sameNamedExercise(name, all) : undefined;
  // Searching lists the best matches in one untitled group: exact names
  // first, then names that start with it (exercise-search.ts), favourites
  // first among equals. Otherwise "Senast använda", favourites, then A–Ö.
  // The chips and the search filter together.
  const groups = useMemo((): ExerciseGroup<(typeof all)[number]>[] => {
    const shown = visibleExercises(all, hidden).filter(
      (e) =>
        e.id !== excludeId &&
        matchesChip({ ...e, custom: own.has(e.id) }, chip) &&
        (!suggestedOnly || !!suggested?.some((c) => inCategory(e, c))),
    );
    if (search.trim())
      return [
        {
          title: "",
          items: searchExercises(
            shown.sort(
              (a, b) =>
                Number(recent.includes(b.id)) - Number(recent.includes(a.id)) ||
                byName(a, b),
            ),
            search,
            (e) => e.favourite,
          ),
        },
      ].filter((group) => group.items.length);
    return pickerGroups(shown, recent);
  }, [
    all,
    own,
    hidden,
    excludeId,
    chip,
    suggestedOnly,
    suggested,
    recent,
    search,
  ]);
  const items = groups.flatMap((group) => group.items);
  // A new query or filter shows its results from the top.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [search, chip, suggestedOnly]);
  // Closing unmounts this body, which resets the search, filters and choices.
  const close = () => {
    if (busy) return;
    onClose();
  };
  // Press and hold a row: its menu, led by adding it.
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const exerciseMenu = useExerciseMenu({
    add: (m) => {
      if (!single)
        return selectionItem(selected.includes(m.id), () => toggle(m.id));
      const e = all.find((x) => x.id === m.id);
      return e
        ? {
            key: "add",
            label: t("menu.addToWorkout"),
            onSelect: () => {
              onAdd([e]);
              close();
            },
          }
        : null;
    },
  });
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
  const activeFilters = Number(chip !== "all") + Number(suggestedOnly);
  const startCreating = () => {
    if (!pending) updateDraft({ name: search.trim() });
    setCreating(true);
  };
  return (
    <>
      {exerciseMenu.menu}
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
              {t("editor.twin", {
                name: exerciseDisplayName(twin.id, twin.name),
              })}
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
            {/* A planned day type's suggestion, on until switched off. */}
            {!!suggested?.length && (
              <div
                className="facet-chips"
                role="group"
                aria-label={t("picker.show")}
              >
                <button
                  type="button"
                  className="filter-chip"
                  aria-pressed={suggestedOnly}
                  onClick={() => setSuggestedOnly((on) => !on)}
                >
                  {t("picker.suggested")}
                </button>
              </div>
            )}
            <CategoryChips value={chip} onChange={setChip} />
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
                  <ExerciseRow
                    key={e.id}
                    className="picker-item"
                    exerciseId={e.id}
                    category={e.category}
                    pressed={single ? undefined : selected.includes(e.id)}
                    title={
                      <>
                        {exerciseDisplayName(e.id, e.name)}
                        {e.favourite && <FavouriteStar />}
                        {own.has(e.id) && (
                          <span className="stat-chip">
                            {t("exercises.mine")}
                          </span>
                        )}
                      </>
                    }
                    // v6 §D2: "skivstång · Bench Press", "kabel · Bål · egen".
                    meta={exerciseSubtitle({
                      id: e.id,
                      equipment: "equipment" in e ? e.equipment : undefined,
                      category: e.category,
                      custom: own.has(e.id),
                      englishName: e.name,
                    })}
                    end={
                      single ? undefined : selected.includes(e.id) ? (
                        // Its place in the order it will be added.
                        <span className="picker-order">
                          <span aria-hidden="true">
                            {selected.indexOf(e.id) + 1}
                          </span>
                          <span className="sr-only">
                            {t("picker.orderLabel", {
                              n: selected.indexOf(e.id) + 1,
                            })}
                          </span>
                        </span>
                      ) : (
                        <Plus className="picker-mark" size={20} />
                      )
                    }
                    onClick={() => {
                      if (single) {
                        onAdd([e]);
                        close();
                      } else toggle(e.id);
                    }}
                    onLongPress={(anchor) =>
                      exerciseMenu.open(
                        {
                          id: e.id,
                          name: e.name,
                          category: e.category,
                          custom: own.has(e.id),
                          favourite: e.favourite,
                          hidden: false,
                        },
                        anchor,
                      )
                    }
                  />
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
                    // In the order they were picked, not the list's.
                    onAdd(
                      selected.flatMap((id) => all.filter((e) => e.id === id)),
                    );
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
