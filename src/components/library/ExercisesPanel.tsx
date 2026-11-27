import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { notify, offerUndo } from "@/lib/message-store";
import { interleave } from "@/lib/messages";
import { useMessageState } from "@/hooks/useMessages";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import { useSharedExercises } from "@/hooks/useSharedExercises";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useWeightUnits } from "@/hooks/useWeightUnits";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { errorMessage } from "@/lib/errors";
import { favouriteChange } from "@/data/exercises";
import { today } from "@/data/model";
import { unpublishExercise } from "@/data/shared";
import CategoryChips from "@/components/ui/CategoryChips";
import type { CategoryChip } from "@/lib/category-filter";
import ConfirmDialog from "@/components/ConfirmDialog";
import ExerciseRow from "@/components/library/ExerciseRow";
import ExerciseEditorSheet from "@/components/library/ExerciseEditorSheet";
import LibraryExerciseMenu from "@/components/library/LibraryExerciseMenu";
import { useExerciseMenu } from "@/components/gestures/ExerciseMenu";
import { libraryExercises, type LibraryExercise } from "@/lib/library";
import { hiddenCount, libraryListGroups } from "@/lib/library-list";
import { t } from "@/i18n";
import MotionList from "@/components/motion/MotionList";
import { exerciseDisplayName } from "@/lib/exercise-name";

/** A tap on Library's header Search or +, numbered so each tap acts once. */
export type PanelRequest = { kind: "new" | "search"; n: number } | null;

/**
 * Library → Övningar (v6 §E1): the search, the category chip row, "Mina
 * övningar" first and then A–Ö by the shown name, hidden exercises behind
 * "Visa dolda", and the custom exercise editor. Exercises others shared live
 * in Library → Rutiner → Upptäck.
 */
export default function ExercisesPanel({
  request = null,
}: {
  request?: PanelRequest;
}) {
  const { state, save, deleteRecord } = useData();
  const { account } = useAuth();
  const draft = useRetainedDraft(
    draftKey(account, "exercise"),
    parseCustomDraft,
  );
  const edit = draft.value;
  const setEdit = draft.replace;
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<CategoryChip>("all");
  const [showHidden, setShowHidden] = useState(false);
  const { hidden, setHidden } = useHiddenExercises();
  const [menu, setMenu] = useState<LibraryExercise | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const now = today();
  const { undos } = useMessageState();
  const shared = useSharedExercises({
    browsing: false,
    // An open draft of the exercise follows its shared id.
    onSharedId: (id, sharedId) => {
      if (edit?.id !== id) return;
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      setEdit({ ...edit, data });
    },
  });

  const { unitFor } = useWeightUnits();
  const all = useMemo(
    () => libraryExercises(state.records, hidden, unitFor),
    [state.records, hidden, unitFor],
  );
  const groups = useMemo(
    () => libraryListGroups(all, { query: search, chip, hidden: showHidden }),
    [all, search, chip, showHidden],
  );
  const hiddenHere = useMemo(() => hiddenCount(all, chip), [all, chip]);
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
      notify.error(t("exercises.favouriteFailed"));
    }
  });
  const toggleHidden = useStableCallback(
    async (e: LibraryExercise, hide: boolean) => {
      try {
        await setHidden(e.id, hide);
        setMenu(null);
        notify(
          t(hide ? "exercises.hidden" : "exercises.back", {
            name: exerciseDisplayName(e.id, e.name),
          }),
        );
      } catch {
        notify.error(
          t(hide ? "exercises.hideFailed" : "exercises.unhideFailed", {
            name: exerciseDisplayName(e.id, e.name),
          }),
        );
      }
    },
  );
  const openEditor = useStableCallback((e: LibraryExercise) => {
    if (edit && edit.id !== e.id) notify(t("exercises.resumeFirst"));
    else if (!edit) {
      const record = state.records[e.id];
      if (record?.kind === "exercise")
        setEdit({ id: e.id, data: structuredClone(record.payload) });
    }
    setOpen(true);
  });
  // Press and hold on a row: its menu by the row.
  const exerciseMenu = useExerciseMenu({
    onEdit: (e) => {
      const target = all.find((x) => x.id === e.id);
      if (target) openEditor(target);
    },
  });
  const hold = useStableCallback((e: LibraryExercise, anchor: HTMLElement) =>
    exerciseMenu.open(e, anchor),
  );
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
      notify.success(t("exercises.saved"));
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
      notify.error(t("exercises.stopSharingFirst", { name: deleting.name }));
      setDeleting(null);
      return;
    }
    setBusy(true);
    try {
      if (sharedId)
        try {
          await unpublishExercise(sharedId);
        } catch {
          notify.error(t("exercises.unpublishFailed", { name: deleting.name }));
          return;
        }
      const payload = customPayload(deleting.id);
      await deleteRecord(deleting.id);
      if (edit?.id === deleting.id) setEdit(null);
      setDeleting(null);
      // Its row's place in the list keeps an Undo for a few seconds; it
      // comes back unshared, as its shared copy is gone.
      const group = groups.find((g) =>
        g.items.some((e) => e.id === deleting.id),
      );
      if (payload) {
        const restored = structuredClone(payload);
        delete restored.sharedId;
        offerUndo({
          scope: `exercises:${group?.title ?? ""}`,
          index: group?.items.findIndex((e) => e.id === deleting.id) ?? 0,
          text: t("exercises.deleted", { name: deleting.name }),
          undo: () => save(deleting.id, "exercise", restored),
          failed: t("exercises.restoreFailed"),
        });
      }
    } catch {
      notify.error(t("exercises.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  // `?edit=<id>` (from the exercise page) opens that exercise's editor once.
  const [params, setParams] = useSearchParams();
  const editId = params.get("edit");
  useEffect(() => {
    if (!editId) return;
    const target = all.find((e) => e.id === editId && e.custom);
    setParams({ tab: "exercises" }, { replace: true });
    if (target) openEditor(target);
  }, [editId, all, setParams, openEditor]);

  const createExercise = () => {
    if (!edit)
      setEdit({
        id: crypto.randomUUID(),
        data: {
          name: "",
          category: "Other",
          note: "",
          favourite: false,
          equipment: "dumbbell",
          icon: "dumbbell",
        },
      });
    setOpen(true);
  };
  // Library's header: + opens a new exercise, Search focuses the field.
  const searchInput = useRef<HTMLInputElement>(null);
  const handled = useRef(request?.n ?? 0);
  useEffect(() => {
    if (!request || request.n === handled.current) return;
    handled.current = request.n;
    if (request.kind === "new") createExercise();
    else searchInput.current?.focus();
  });

  const saved = !!edit && edit.id in state.records;
  const firstId = groups[0]?.items[0]?.id;
  return (
    <div className="col-12">
      <label className="search-field">
        <Search size={20} aria-hidden="true" />
        <input
          ref={searchInput}
          type="search"
          placeholder={t("exercises.search")}
          aria-label={t("exercises.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <CategoryChips value={chip} onChange={setChip} />
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="group-title">{group.title}</h2>
          <MotionList
            className="flat-list"
            resetKey={`${chip}|${showHidden}|${search.trim()}`}
          >
            {interleave(
              group.items,
              undos.filter((u) => u.scope === `exercises:${group.title}`),
            ).map((slot) =>
              slot.kind === "undo" ? (
                <UndoPlaceholder
                  key={`u${slot.entry.id}`}
                  entry={slot.entry}
                  className="in-flat-list"
                />
              ) : (
                <ExerciseRow
                  key={slot.item.id}
                  exercise={slot.item}
                  onUnhide={unhide}
                  onMenu={setMenu}
                  onHold={hold}
                  tip={slot.item.id === firstId}
                />
              ),
            )}
          </MotionList>
        </section>
      ))}
      {/* A deleted exercise whose group went with it keeps its Undo here. */}
      {undos
        .filter(
          (u) =>
            u.scope.startsWith("exercises:") &&
            !groups.some((g) => u.scope === `exercises:${g.title}`),
        )
        .map((entry) => (
          <UndoPlaceholder key={`u${entry.id}`} entry={entry} />
        ))}
      {!groups.length && (
        <p className="empty" role="status">
          {chip === "mine" && !search.trim()
            ? t("exercises.emptyMine")
            : t("exercises.noMatch")}
        </p>
      )}
      {!search.trim() && (hiddenHere > 0 || showHidden) && (
        <button
          type="button"
          className="btn-quiet btn-block"
          aria-expanded={showHidden}
          onClick={() => setShowHidden((on) => !on)}
        >
          {showHidden
            ? t("exercises.hideHidden")
            : t("exercises.showHidden", { count: hiddenHere })}
        </button>
      )}
      {edit && !open && (
        <p className="draft-receipt">
          {t("exercises.unfinished", {
            name: edit.data.name || t("exercises.untitled"),
          })}{" "}
          {draft.retained ? t("routines.keptOnPhone") : t("routines.keepOpen")}
        </p>
      )}
      <button type="button" className="btn-dashed" onClick={createExercise}>
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
      {exerciseMenu.menu}
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
