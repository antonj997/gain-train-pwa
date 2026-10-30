import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import { useSharedExercises } from "@/hooks/useSharedExercises";
import { useStableCallback } from "@/hooks/useStableCallback";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { errorMessage } from "@/lib/errors";
import { categories, equipmentTypes } from "@/data/catalogue";
import { favouriteChange } from "@/data/exercises";
import { today } from "@/data/model";
import { unpublishExercise } from "@/data/shared";
import FacetChips from "@/components/FacetChips";
import ConfirmDialog from "@/components/ConfirmDialog";
import ExerciseRow from "@/components/library/ExerciseRow";
import ExerciseEditorSheet from "@/components/library/ExerciseEditorSheet";
import LibraryExerciseMenu from "@/components/library/LibraryExerciseMenu";
import SharedExerciseList from "@/components/library/SharedExerciseList";
import {
  filterExercises,
  groupExercises,
  libraryExercises,
  type ExerciseFilter,
  type LibraryExercise,
} from "@/lib/library";
import { t, type MessageKey } from "@/i18n";
import { categoryLabel, equipmentLabel } from "@/lib/catalogue-labels";

type Filter = ExerciseFilter | "shared";
const filters = [
  { value: "all", label: "exercises.filterAll" },
  { value: "mine", label: "exercises.filterMine" },
  { value: "shared", label: "exercises.filterShared" },
  { value: "recent", label: "exercises.filterRecent" },
  { value: "hidden", label: "exercises.filterHidden" },
] as const satisfies readonly { value: Filter; label: MessageKey }[];

/** Library → Exercises: search, filters, groups and the custom exercise editor. */
export default function ExercisesPanel() {
  const { state, save, deleteRecord } = useData();
  const { account } = useAuth();
  const draft = useRetainedDraft(
    draftKey(account, "exercise"),
    parseCustomDraft,
  );
  const edit = draft.value;
  const setEdit = draft.replace;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const { hidden, setHidden } = useHiddenExercises();
  const [menu, setMenu] = useState<LibraryExercise | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const now = today();
  const shared = useSharedExercises({
    browsing: filter === "shared",
    // An open draft of the exercise follows its shared id.
    onSharedId: (id, sharedId) => {
      if (edit?.id !== id) return;
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      setEdit({ ...edit, data });
    },
  });

  const all = useMemo(
    () => libraryExercises(state.records, hidden),
    [state.records, hidden],
  );
  const groups = useMemo(
    () =>
      filter === "shared"
        ? []
        : groupExercises(
            filterExercises(all, search, filter, { category, equipment }),
            filter,
            !!search.trim(),
          ),
    [all, search, filter, category, equipment],
  );
  const sharedItems = useMemo(
    () =>
      filterExercises(
        shared.rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          equipment: r.equipment ?? undefined,
          aliases: r.aliases,
          custom: false,
          favourite: false,
          note: "",
          lastDate: null,
          best: null,
          ...(r.by_name ? { sharedBy: r.by_name } : {}),
        })),
        search,
        "all",
        { category, equipment },
      ),
    [shared.rows, search, category, equipment],
  );
  const customPayload = (id: string) => {
    const record = state.records[id];
    return record?.kind === "exercise" ? record.payload : null;
  };

  // Stable for the memoised rows.
  const toggleFavourite = useStableCallback(async (e: LibraryExercise) => {
    try {
      const change = favouriteChange(state.records, e);
      await save(change.id, "exercise", change.payload, change.deleted);
    } catch {
      toast.error(t("exercises.favouriteFailed"));
    }
  });
  const toggleHidden = useStableCallback(
    async (e: LibraryExercise, hide: boolean) => {
      try {
        await setHidden(e.id, hide);
        setMenu(null);
        toast(
          t(hide ? "exercises.hidden" : "exercises.back", { name: e.name }),
        );
      } catch {
        toast.error(
          t(hide ? "exercises.hideFailed" : "exercises.unhideFailed", {
            name: e.name,
          }),
        );
      }
    },
  );
  const openEditor = useStableCallback((e: LibraryExercise) => {
    if (edit && edit.id !== e.id) toast(t("exercises.resumeFirst"));
    else if (!edit) {
      const record = state.records[e.id];
      if (record?.kind === "exercise")
        setEdit({ id: e.id, data: structuredClone(record.payload) });
    }
    setOpen(true);
  });
  const unhide = useStableCallback((e: LibraryExercise) =>
    toggleHidden(e, false),
  );

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      const before = customPayload(edit.id);
      await save(edit.id, "exercise", edit.data);
      setEdit(null);
      setOpen(false);
      toast.success(t("exercises.saved"));
      await shared.syncEdit(before, edit.data);
    } catch (cause) {
      setError(errorMessage(cause, t("exercises.saveFailed")));
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleting || busy) return;
    const sharedId = customPayload(deleting.id)?.sharedId;
    // A shared exercise leaves the shared library first, while its record
    // still holds the id needed to remove it.
    if (sharedId && !shared.ready) {
      toast.error(t("exercises.stopSharingFirst", { name: deleting.name }));
      setDeleting(null);
      return;
    }
    setBusy(true);
    try {
      if (sharedId)
        try {
          await unpublishExercise(sharedId);
        } catch {
          toast.error(t("exercises.unpublishFailed", { name: deleting.name }));
          return;
        }
      await deleteRecord(deleting.id);
      if (edit?.id === deleting.id) setEdit(null);
      setDeleting(null);
      toast(t("exercises.deleted"));
    } catch {
      toast.error(t("exercises.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const saved = !!edit && edit.id in state.records;
  return (
    <div className="col-12">
      <label className="search-field">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          placeholder={t("exercises.search")}
          aria-label={t("exercises.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div
        className="facet-chips"
        role="group"
        aria-label={t("exercises.show")}
      >
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className="filter-chip"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {t(f.label)}
          </button>
        ))}
      </div>
      <FacetChips
        name={t("facet.category")}
        allLabel={t("facet.allCategories")}
        format={categoryLabel}
        options={categories}
        value={category}
        onChange={setCategory}
      />
      <FacetChips
        name={t("facet.equipment")}
        allLabel={t("facet.allEquipment")}
        format={equipmentLabel}
        options={equipmentTypes}
        value={equipment}
        onChange={setEquipment}
      />
      {filter === "shared" && (
        <SharedExerciseList
          canShare={shared.canShare}
          ready={shared.ready}
          status={shared.status}
          hasRows={shared.hasRows}
          items={sharedItems}
          narrowed={!!(search.trim() || category || equipment)}
          adding={shared.adding}
          onRetry={shared.retry}
          onAdd={(id) => void shared.add(id)}
        />
      )}
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="group-title">{group.title}</h2>
          <div className="list">
            {group.items.map((e) => (
              <ExerciseRow
                key={e.id}
                exercise={e}
                now={now}
                onEdit={openEditor}
                onUnhide={unhide}
                onToggleFavourite={toggleFavourite}
                onMenu={setMenu}
              />
            ))}
          </div>
        </section>
      ))}
      {filter !== "shared" && !groups.length && (
        <p className="empty" role="status">
          {filter === "recent" && !search.trim()
            ? t("exercises.emptyRecent")
            : filter === "mine" && !search.trim()
              ? t("exercises.emptyMine")
              : filter === "hidden" && !search.trim()
                ? t("exercises.emptyHidden")
                : t("exercises.noMatch")}
        </p>
      )}
      {edit && !open && (
        <p className="draft-receipt">
          {t("exercises.unfinished", {
            name: edit.data.name || t("exercises.untitled"),
          })}{" "}
          {draft.retained ? t("routines.keptOnPhone") : t("routines.keepOpen")}
        </p>
      )}
      <button
        type="button"
        className="btn-dashed"
        onClick={() => {
          if (!edit)
            setEdit({
              id: crypto.randomUUID(),
              data: { name: "", category: "Other", note: "", favourite: false },
            });
          setOpen(true);
        }}
      >
        <Plus size={20} aria-hidden="true" />
        {edit ? t("exercises.resumeDraft") : t("exercises.new")}
      </button>
      <ExerciseEditorSheet
        open={open}
        draft={edit}
        retained={draft.retained}
        saved={saved}
        busy={busy}
        error={error}
        onChange={setEdit}
        exercises={all}
        onSave={() => void saveEdit()}
        onDelete={() =>
          edit && setDeleting({ id: edit.id, name: edit.data.name })
        }
        onClose={() => setOpen(false)}
        onDiscard={() => {
          setEdit(null);
          setOpen(false);
        }}
      />
      <LibraryExerciseMenu
        exercise={menu}
        now={now}
        canShare={shared.canShare}
        sharing={shared.sharing}
        onClose={() => setMenu(null)}
        onToggleFavourite={(e) => {
          void toggleFavourite(e);
          setMenu(null);
        }}
        onEdit={(e) => {
          setMenu(null);
          openEditor(e);
        }}
        onShare={async (e) => {
          if (await shared.share(e)) setMenu(null);
        }}
        onStopSharing={async (e) => {
          if (await shared.stopSharing(e)) setMenu(null);
        }}
        onToggleHidden={(e) => void toggleHidden(e, !e.hidden)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t("exercises.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("exercises.deleteText")}
        cancelLabel={t("workout.keepExercise")}
        confirmLabel={busy ? t("history.deleting") : t("exercises.delete")}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
