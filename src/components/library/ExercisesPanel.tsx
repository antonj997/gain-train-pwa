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

type Filter = ExerciseFilter | "shared";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "yours", label: "Yours" },
  { value: "recent", label: "Recently used" },
  { value: "hidden", label: "Hidden" },
  { value: "shared", label: "Shared" },
];

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
      toast.error("Could not update favourite. Retry.");
    }
  });
  const toggleHidden = useStableCallback(
    async (e: LibraryExercise, hide: boolean) => {
      try {
        await setHidden(e.id, hide);
        setMenu(null);
        toast(hide ? `${e.name} hidden` : `${e.name} is back`);
      } catch {
        toast.error(`Could not ${hide ? "hide" : "unhide"} ${e.name}. Retry.`);
      }
    },
  );
  const openEditor = useStableCallback((e: LibraryExercise) => {
    if (edit && edit.id !== e.id)
      toast("Resume or discard the existing exercise draft first.");
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
      toast.success("Exercise saved");
      await shared.syncEdit(before, edit.data);
    } catch (cause) {
      setError(errorMessage(cause, "Could not save. Your draft is kept here."));
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
      toast.error(
        `Stop sharing ${deleting.name} first. Connect and sign in to remove it from the shared library.`,
      );
      setDeleting(null);
      return;
    }
    setBusy(true);
    try {
      if (sharedId)
        try {
          await unpublishExercise(sharedId);
        } catch {
          toast.error(
            `Could not remove ${deleting.name} from the shared library. Nothing was deleted; retry.`,
          );
          return;
        }
      await deleteRecord(deleting.id);
      if (edit?.id === deleting.id) setEdit(null);
      setDeleting(null);
      toast("Exercise deleted");
    } catch {
      toast.error("Could not delete. The exercise is still here; retry.");
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
          placeholder="Search exercises"
          aria-label="Search exercises"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="filters" role="group" aria-label="Show exercises">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className="filter-chip"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <FacetChips
        name="Category"
        options={categories}
        value={category}
        onChange={setCategory}
      />
      <FacetChips
        name="Equipment"
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
            ? "Exercises you have trained show up here."
            : filter === "yours" && !search.trim()
              ? "Exercises you create show up here."
              : filter === "hidden" && !search.trim()
                ? "Exercises you hide show up here."
                : "No exercises match."}
        </p>
      )}
      {edit && !open && (
        <p className="draft-receipt">
          Unfinished exercise: {edit.data.name || "Untitled"}.{" "}
          {draft.retained
            ? "Kept on this phone."
            : "Keep this page open; storage is unavailable."}
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
        {edit ? "Resume exercise draft" : "New exercise"}
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
        title={<>Delete {deleting?.name}?</>}
        description="This removes the exercise from your library. Its entries in saved workouts and routines stay intact."
        cancelLabel="Keep exercise"
        confirmLabel={busy ? "Deleting…" : "Delete exercise"}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
