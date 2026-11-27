import { newWorkout } from "@/data/start";
import { completedWorkouts, customDefaults, routines } from "@/data/selectors";
import { today, type RoutineRecord } from "@/data/model";
import { errorMessage } from "@/lib/errors";
import { reorderByIds } from "@/lib/exercise-order";
import ReorderExercisesSheet from "@/components/workout/ReorderExercisesSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { ChevronDown, Plus, Search } from "lucide-react";
import { useRoutineMenu } from "@/components/library/RoutineMenu";
import RoutineTile, { NewRoutineTile } from "@/components/library/RoutineTile";
import LibraryRoutineSheet from "@/components/library/LibraryRoutineSheet";
import ShareRoutineSheet from "@/components/library/ShareRoutineSheet";
import {
  MoveFolderSheet,
  NewFolderSheet,
} from "@/components/library/FolderSheets";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import { useWithUndo } from "@/hooks/useMessages";
import { useGridMotion } from "@/hooks/useGridMotion";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { type Exercise, type Routine } from "@/data/model";
import { hasLoggedExercise, lastSessions } from "@/data/workouts";
import { draftKey, parseRoutineDraft } from "@/lib/drafts";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import ExercisePicker from "@/components/ExercisePicker";
import ChangeExercisePicker from "@/components/workout/ChangeExercisePicker";
import { countLabel } from "@/lib/labels";
import {
  addExercisesToRoutine,
  copyName,
  duplicateRoutine,
  folderCounts,
  sortRoutines,
  withFolder,
  type RoutineSort,
} from "@/lib/routine-library";
import { ownTileFacts } from "@/lib/routine-tile-facts";
import { exerciseDisplayName } from "@/lib/exercise-name";
import { local, storageKeys, writeStored } from "@/lib/storage";
import RoutinePlan from "@/components/RoutinePlan";
import { useCardioFields } from "@/hooks/useCardioFields";
import { useRepHold } from "@/hooks/useRepHold";
import { useWeightUnits } from "@/hooks/useWeightUnits";
import type { PanelRequest } from "@/components/library/ExercisesPanel";
import { useSharedRoutines } from "@/hooks/useSharedRoutines";
import { notify } from "@/lib/message-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { currentLocale, t } from "@/i18n";
import MotionList from "@/components/motion/MotionList";
import Reveal from "@/components/motion/Reveal";

const SCOPE = "routines:library";

/**
 * Copies made this session, copy id → original id: each sits right after its
 * original in either order (sortRoutines). Kept for the app's session, so
 * switching tabs keeps the place.
 */
const copyPins = new Map<string, string>();

/** How long a new copy keeps its accent ring. */
const HIGHLIGHT_MS = 2400;

const readSort = (): RoutineSort =>
  local.getItem(storageKeys.routineSort) === "name" ? "name" : "recent";

/**
 * Library → Routines: folder chips and the order over a grid of equal tiles,
 * two to a row, with "Ny rutin" last. A tile opens its preview (Starta,
 * Redigera, ⋯); its play button starts it; ⋯ or a long press has Duplicera,
 * Dela, Flytta till mapp, Redigera and Ta bort. The routine editor lives
 * here too.
 */
export default function RoutinesPanel({
  request = null,
}: {
  request?: PanelRequest;
}) {
  const { state, save } = useData();
  const { account } = useAuth();
  const cardioFields = useCardioFields();
  const repHold = useRepHold();
  const weightUnits = useWeightUnits();
  const workoutStart = useStartWorkout();
  const draft = useRetainedDraft(
    draftKey(account, "routine"),
    parseRoutineDraft,
  );
  const edit = draft.value;
  const setEdit = draft.replace;
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Exercise | null>(null);
  const [changing, setChanging] = useState<Exercise | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  // "Byt namn" opens the editor on its name, selected.
  const focusName = useRef(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<RoutineSort>(readSort);
  const [sortOpen, setSortOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [pins, setPins] = useState(() => new Map(copyPins));
  const followSharedId = (id: string, sharedId: string | null) => {
    if (edit?.id !== id) return;
    const data = structuredClone(edit.data);
    if (sharedId) data.sharedId = sharedId;
    else delete data.sharedId;
    setEdit({ ...edit, data });
  };
  // An open draft of the routine follows its shared id.
  const shared = useSharedRoutines({
    browsing: false,
    onSharedId: followSharedId,
  });
  const categories = useMemo(
    () => customDefaults(state.records),
    [state.records],
  );
  const removeExercise = (exercise: Exercise) => {
    if (edit)
      setEdit({
        ...edit,
        data: {
          ...edit.data,
          exercises: edit.data.exercises.filter(
            (item) => item.id !== exercise.id,
          ),
        },
      });
    setRemoving(null);
  };
  const lock = useRef(false);
  const records = useMemo(() => routines(state.records), [state.records]);
  const latestRecords = useRef(state.records);
  latestRecords.current = state.records;
  const now = today();
  // The newest finished workout that started from each routine.
  const lastDone = useMemo(() => {
    const dates = new Map<string, string>();
    for (const r of completedWorkouts(state.records)) {
      const id = r.payload.routineId;
      if (id && !dates.has(id)) dates.set(id, r.payload.date);
    }
    return dates;
  }, [state.records]);
  // Each exercise's last session: the editor's Förra and the preview's.
  const sessions = useMemo(
    () => lastSessions(completedWorkouts(state.records)),
    [state.records],
  );
  const update = (exercise: Exercise) => {
    if (edit)
      setEdit({
        ...edit,
        data: {
          ...edit.data,
          exercises: edit.data.exercises.map((ex) =>
            ex.id === exercise.id ? exercise : ex,
          ),
        },
      });
  };
  // Reorder exercises, from a planned exercise's menu.
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderFrom, setReorderFrom] = useState<string | null>(null);
  const latestEdit = useRef(edit);
  latestEdit.current = edit;
  const reorderTo = (ids: string[]) => {
    const current = latestEdit.current;
    if (!current) return;
    setEdit({
      ...current,
      data: {
        ...current.data,
        exercises: reorderByIds(current.data.exercises, ids),
      },
    });
  };
  // The editor shows the new order at once; reordering is its own undo.
  const saveOrder = (ids: string[]) => reorderTo(ids);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      // Shown in the editor's footer, by Save.
      setError(errorMessage(cause, t("routines.saveFailed")));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const startEdit = (
    id: string,
    data: Routine,
    { rename = false }: { rename?: boolean } = {},
  ) => {
    if (edit && edit.id !== id) {
      notify(t("routines.resumeFirst"));
      setOpen(true);
      return;
    }
    focusName.current = rename;
    if (!edit) setEdit({ id, data: structuredClone(data) });
    setError(null);
    setPreviewId(null);
    setOpen(true);
  };

  // A copy right after its original, with a ring and "Byt namn".
  const duplicate = async (r: RoutineRecord) => {
    const id = crypto.randomUUID();
    const copy = duplicateRoutine(
      r.payload,
      copyName(r.payload.name, t("routineTile.copySuffix")),
    );
    try {
      await save(id, "routine", copy);
    } catch {
      notify.error(t("routineTile.copyFailed", { name: r.payload.name }));
      return;
    }
    copyPins.set(id, r.id);
    setPins(new Map(copyPins));
    setPreviewId(null);
    setHighlight(id);
    notify(t("routineTile.copied"), {
      key: "routine-copy",
      action: {
        label: t("routineTile.rename"),
        run: () => {
          const record = latestRecords.current[id];
          if (record?.kind === "routine" && !record.deleted)
            startEdit(id, record.payload, { rename: true });
        },
      },
    });
  };
  useEffect(() => {
    if (!highlight) return;
    document
      .querySelector(`[data-key="${CSS.escape(highlight)}"]`)
      ?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  // Folders: a name on each routine (Routine.folder), saved one by one.
  const moveTo = async (ids: readonly string[], target: string | null) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    let moved = "";
    try {
      for (const id of ids) {
        const record = latestRecords.current[id];
        if (record?.kind !== "routine" || record.deleted) continue;
        moved = record.payload.name;
        await save(id, "routine", withFolder(record.payload, target));
      }
      return true;
    } catch {
      notify.error(t("folders.failed", { name: moved }));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const routineMenu = useRoutineMenu({
    scope: SCOPE,
    onEdit: (r) => {
      if (!busy) startEdit(r.id, r.payload);
    },
    onDuplicate: (r) => void duplicate(r),
    onShare: (r) => {
      setPreviewId(null);
      setShareId(r.id);
    },
    onMove: (r) => {
      setPreviewId(null);
      setMoveId(r.id);
    },
    onSharedId: followSharedId,
  });
  // `?edit=<id>` (from the Train preview) opens that routine's editor once.
  const [params, setParams] = useSearchParams();
  const editId = params.get("edit");
  useEffect(() => {
    if (!editId) return;
    const target = records.find((r) => r.id === editId);
    const next = new URLSearchParams(params);
    next.delete("edit");
    setParams(next, { replace: true });
    if (target) startEdit(target.id, target.payload);
  });
  const create = () => {
    if (!edit)
      setEdit({
        id: crypto.randomUUID(),
        data: { name: "", exercises: [] },
      });
    focusName.current = false;
    setError(null);
    setOpen(true);
  };

  const folders = useMemo(
    () => folderCounts(records, currentLocale()),
    [records],
  );
  const folderNames = folders.map((f) => f.name);
  // The chosen folder is gone once its last routine leaves it.
  const activeFolder = folder && folderNames.includes(folder) ? folder : null;
  // A search narrows the tiles by name or exercise.
  const needle = (query ?? "").trim().toLocaleLowerCase();
  const ordered = useMemo(() => {
    const shown = records.filter(
      (r) =>
        (!activeFolder || r.payload.folder === activeFolder) &&
        (!needle ||
          r.payload.name.toLocaleLowerCase().includes(needle) ||
          r.payload.exercises.some(
            (ex) =>
              ex.name.toLocaleLowerCase().includes(needle) ||
              exerciseDisplayName(ex.exerciseId, ex.name)
                .toLocaleLowerCase()
                .includes(needle),
          )),
    );
    return sortRoutines(shown, lastDone, sort, pins, currentLocale());
  }, [records, activeFolder, needle, lastDone, sort, pins]);
  // A deleted routine's place keeps an Undo for a few seconds.
  const cards = useWithUndo(SCOPE, ordered);
  const grid = useGridMotion<HTMLDivElement>(
    `${activeFolder}|${needle}|${sort}`,
  );
  // Library's header: + starts a new routine, Search opens the search field.
  const handled = useRef(request?.n ?? 0);
  useEffect(() => {
    if (!request || request.n === handled.current) return;
    handled.current = request.n;
    if (request.kind === "new") create();
    else {
      setQuery((q) => q ?? "");
      requestAnimationFrame(() => searchInput.current?.focus());
    }
    // Runs once per tap: `create` is this render's, and nothing else matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const start = (r: RoutineRecord) =>
    void workoutStart.start(
      newWorkout(Object.values(state.records), { routine: r }),
    );
  const find = (id: string | null) =>
    id ? (records.find((r) => r.id === id) ?? null) : null;
  const previewRoutine = find(previewId);
  const previewIndex = ordered.findIndex((r) => r.id === previewId);
  // The draft differs from what is saved (or, new, has a name or an exercise).
  const savedRoutine = edit ? state.records[edit.id] : undefined;
  const changed =
    !!edit &&
    (savedRoutine?.kind === "routine" && !savedRoutine.deleted
      ? JSON.stringify(savedRoutine.payload) !== JSON.stringify(edit.data)
      : !!edit.data.name.trim() || edit.data.exercises.length > 0);
  const sortName = (value: RoutineSort) =>
    value === "name" ? t("routineTile.sortName") : t("routineTile.sortRecent");

  return (
    <div className="col-12 routines-panel">
      {workoutStart.confirmation}
      {query !== null && (
        <label className="search-field routine-search">
          <Search size={20} aria-hidden="true" />
          <input
            ref={searchInput}
            type="search"
            placeholder={t("routines.find")}
            aria-label={t("library.searchRoutines")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (!query.trim()) setQuery(null);
            }}
          />
        </label>
      )}
      {records.length > 0 && (
        <>
          <div
            className="facet-chips folder-chips"
            role="group"
            aria-label={t("folders.label")}
          >
            <button
              type="button"
              className="filter-chip"
              aria-pressed={!activeFolder}
              onClick={() => setFolder(null)}
            >
              {t("folders.all")}
              <span className="chip-count">{records.length}</span>
            </button>
            {folders.map((f) => (
              <button
                key={f.name}
                type="button"
                className="filter-chip"
                aria-pressed={activeFolder === f.name}
                onClick={() => setFolder(f.name)}
              >
                {f.name}
                <span className="chip-count">{f.count}</span>
              </button>
            ))}
            <button
              type="button"
              className="filter-chip is-add"
              aria-label={t("folders.newTitle")}
              onClick={() => setNewFolder([])}
            >
              <Plus size={16} aria-hidden="true" />
              {t("folders.add")}
            </button>
          </div>
          <div className="routine-list-head">
            <span>{countLabel(ordered.length, "routine")}</span>
            <button
              type="button"
              className="text-button routine-sort"
              aria-haspopup="dialog"
              aria-label={t("routineTile.sortLabel", { sort: sortName(sort) })}
              onClick={() => setSortOpen(true)}
            >
              {sortName(sort)}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
      <div className="routine-grid" ref={grid}>
        {cards.map((slot) => {
          if (slot.kind === "undo")
            return (
              <div
                key={`u${slot.entry.id}`}
                className="routine-tile-slot"
                data-key={`u${slot.entry.id}`}
              >
                <UndoPlaceholder entry={slot.entry} />
              </div>
            );
          const { item: r, index } = slot;
          const facts = ownTileFacts(
            r.id,
            r.payload,
            state.records,
            lastDone.get(r.id),
            now,
          );
          return (
            <RoutineTile
              key={r.id}
              itemKey={r.id}
              name={r.payload.name}
              icons={facts.icons}
              more={facts.more}
              meta={facts.meta}
              foot={facts.foot}
              shared={!!r.payload.sharedId}
              highlight={highlight === r.id}
              openLabel={t("routine.preview", { name: r.payload.name })}
              onOpen={() => {
                if (!busy) setPreviewId(r.id);
              }}
              menuLabel={t("routines.options", { name: r.payload.name })}
              onMenu={() => {
                if (!busy) routineMenu.open(r.id, index);
              }}
              action={{
                kind: "start",
                label: t("routine.startNamed", { name: r.payload.name }),
                disabled: busy || workoutStart.busy,
                onClick: () => start(r),
              }}
            />
          );
        })}
        <NewRoutineTile
          label={edit ? t("routines.resumeDraft") : t("routineTile.new")}
          onClick={create}
        />
      </div>
      <Reveal>
        {records.length > 0 && !ordered.length && (
          <p className="empty" role="status">
            {activeFolder && !needle
              ? t("folders.empty", { folder: activeFolder })
              : t("routines.noMatch")}
          </p>
        )}
      </Reveal>
      {!records.length && !edit && (
        <p className="empty">{t("routines.empty")}</p>
      )}
      <Reveal>
        {edit && !open && (
          <p className="draft-receipt" role="status">
            {t("routines.unfinished", {
              name: edit.data.name || t("routines.untitled"),
            })}{" "}
            {draft.retained
              ? t("routines.keptOnPhone")
              : t("routines.keepOpen")}
          </p>
        )}
      </Reveal>
      {routineMenu.sheet}
      <LibraryRoutineSheet
        routine={previewRoutine}
        records={state.records}
        sessions={sessions}
        minutes={
          previewRoutine
            ? ownTileFacts(
                previewRoutine.id,
                previewRoutine.payload,
                state.records,
                undefined,
                now,
              ).minutes
            : null
        }
        lastDone={previewRoutine ? lastDone.get(previewRoutine.id) : undefined}
        now={now}
        disabled={busy || workoutStart.busy}
        onClose={() => setPreviewId(null)}
        onStart={() => {
          if (!previewRoutine) return;
          setPreviewId(null);
          start(previewRoutine);
        }}
        onEdit={() =>
          previewRoutine && startEdit(previewRoutine.id, previewRoutine.payload)
        }
        onMenu={() =>
          previewRoutine &&
          routineMenu.open(previewRoutine.id, Math.max(0, previewIndex))
        }
      />
      <ShareRoutineSheet
        routine={find(shareId)}
        records={state.records}
        canShare={shared.canShare}
        ready={shared.ready}
        sharing={shared.sharing}
        onClose={() => setShareId(null)}
        onShare={(r, on) =>
          void (on ? shared.share(r.id) : shared.stopSharing(r.id))
        }
      />
      <MoveFolderSheet
        routine={find(moveId)}
        folders={folderNames}
        busy={busy}
        onClose={() => setMoveId(null)}
        onMove={async (r, target) => {
          if (!(await moveTo([r.id], target))) return;
          setMoveId(null);
          notify(
            target
              ? t("folders.moved", { name: r.payload.name, folder: target })
              : t("folders.movedOut", { name: r.payload.name }),
          );
        }}
        onNew={(r) => {
          setMoveId(null);
          setNewFolder([r.id]);
        }}
      />
      <NewFolderSheet
        open={newFolder !== null}
        routines={records}
        folders={folderNames}
        preselected={newFolder ?? []}
        busy={busy}
        onClose={() => setNewFolder(null)}
        onCreate={async (name, ids) => {
          if (!(await moveTo(ids, name))) return;
          setNewFolder(null);
          setFolder(name);
        }}
      />
      <ChoiceSheet<RoutineSort>
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title={t("routineTile.sortTitle")}
        value={sort}
        options={[
          { value: "recent", label: t("routineTile.sortRecent") },
          { value: "name", label: t("routineTile.sortName") },
        ]}
        hint={t("routineTile.sortHint")}
        onChoose={(value) => {
          setSort(value);
          writeStored(storageKeys.routineSort, value === "name" ? value : null);
        }}
      />
      <Dialog
        open={open && !!edit}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (!value) setPicker(false);
          }
        }}
      >
        <DialogContent
          size="full"
          className="routine-dialog"
          // The title says it all; there is no description line.
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            if (!focusName.current) return;
            focusName.current = false;
            event.preventDefault();
            nameInput.current?.focus();
            nameInput.current?.select();
          }}
        >
          <DialogHeader className="has-close">
            <div className="dialog-header-text">
              <DialogTitle>
                {edit && state.records[edit.id]
                  ? t("routines.edit")
                  : t("routines.create")}
              </DialogTitle>
            </div>
            <DialogCloseButton />
          </DialogHeader>
          {edit && (
            <>
              <label>
                {t("routines.name")}
                <input
                  ref={nameInput}
                  autoFocus={!state.records[edit.id]}
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
              {edit.data.exercises.length > 0 && (
                <p className="sheet-hint routine-values-hint">
                  {t("routines.valuesHint")}
                </p>
              )}
              <MotionList className="routine-editor-list" resetKey={edit.id}>
                {edit.data.exercises.map((ex) => (
                  <RoutinePlan
                    key={ex.id}
                    exercise={ex}
                    lastSession={sessions.get(ex.exerciseId)}
                    defaults={categories.get(ex.exerciseId)}
                    onChange={update}
                    onReorderExercises={
                      edit.data.exercises.length > 1
                        ? (exercise) => {
                            setReorderFrom(exercise.id);
                            setReorderOpen(true);
                          }
                        : undefined
                    }
                    onRemove={(exercise) =>
                      hasLoggedExercise(exercise)
                        ? setRemoving(exercise)
                        : removeExercise(exercise)
                    }
                    onChangeExercise={setChanging}
                    cardioFields={cardioFields.fieldsFor(ex.exerciseId)}
                    onCardioFields={cardioFields.setFields}
                    repHold={repHold.holdFor(ex.exerciseId)}
                    onRepHold={repHold.setHold}
                    weightUnit={weightUnits.unitFor(ex.exerciseId)}
                    defaultWeightUnit={weightUnits.defaultUnit}
                    onWeightUnit={weightUnits.setUnit}
                  />
                ))}
              </MotionList>
              <button
                className="btn-secondary"
                onClick={() => setPicker(true)}
                disabled={busy}
              >
                <Plus size={18} />
                {t("routines.addExercises")}
              </button>
              {!draft.retained && (
                <p className="field-error" role="alert">
                  {t("routines.storageUnavailable")}
                </p>
              )}
              {/* Nothing to throw away until something changed (v6 §E5). */}
              {changed && (
                <button
                  type="button"
                  className="text-button danger routine-discard"
                  disabled={busy}
                  onClick={() => {
                    setEdit(null);
                    setOpen(false);
                  }}
                >
                  {t("routines.discardDraft")}
                </button>
              )}
              {/* Last, so it can stick to the bottom edge of the long form. */}
              <div className="sheet-footer">
                <Reveal>
                  {error && (
                    <p className="field-error" role="alert">
                      {error}
                    </p>
                  )}
                </Reveal>
                <button
                  className="btn-primary"
                  disabled={
                    busy ||
                    !edit.data.name.trim() ||
                    !edit.data.exercises.length
                  }
                  onClick={() =>
                    void run(async () => {
                      const record = state.records[edit.id];
                      const before =
                        record?.kind === "routine" && !record.deleted
                          ? record.payload
                          : null;
                      await save(edit.id, "routine", edit.data);
                      setEdit(null);
                      setOpen(false);
                      notify.success(t("routines.saved"));
                      await shared.syncEdit(before, edit.data);
                    })
                  }
                >
                  {busy ? t("common.saving") : t("routines.save")}
                </button>
                <p className="routine-close-note">{t("routines.closeSaves")}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={(items) => {
          if (edit)
            setEdit({ ...edit, data: addExercisesToRoutine(edit.data, items) });
        }}
      />
      <ReorderExercisesSheet
        open={reorderOpen && !!edit}
        exercises={edit?.data.exercises ?? []}
        currentId={reorderFrom}
        onSave={saveOrder}
        onClose={() => setReorderOpen(false)}
      />
      <ChangeExercisePicker
        mode="plan"
        exercise={changing}
        defaults={categories}
        onClose={() => setChanging(null)}
        onChange={update}
      />
      <ConfirmDialog
        open={!!removing}
        title={t("workout.removeTitle", { name: removing?.name ?? "" })}
        description={t("routines.removeText")}
        cancelLabel={t("workout.keepExercise")}
        confirmLabel={t("workout.removeExercise")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && removeExercise(removing)}
      />
    </div>
  );
}
