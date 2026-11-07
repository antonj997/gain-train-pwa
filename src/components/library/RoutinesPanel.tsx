import { newWorkout } from "@/data/start";
import {
  completedWorkouts,
  customDefaults,
  routines,
  setCount,
} from "@/data/selectors";
import { today } from "@/data/model";
import { errorMessage } from "@/lib/errors";
import { reorderByIds } from "@/lib/exercise-order";
import ReorderExercisesSheet from "@/components/workout/ReorderExercisesSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import {
  ChevronRight,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import RoutineCard from "@/components/items/RoutineCard";
import { useRoutineMenu } from "@/components/library/RoutineMenu";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import { useWithUndo } from "@/hooks/useMessages";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { type Exercise, type Routine } from "@/data/model";
import { initialSet, hasLoggedExercise } from "@/data/workouts";
import { draftKey, parseRoutineDraft } from "@/lib/drafts";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import ExercisePicker from "@/components/ExercisePicker";
import ChangeExercisePicker from "@/components/workout/ChangeExercisePicker";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { countLabel } from "@/lib/labels";
import { lastUsedLabel } from "@/lib/library";
import RoutinePlan from "@/components/RoutinePlan";
import { useCardioFields } from "@/hooks/useCardioFields";
import { useRepHold } from "@/hooks/useRepHold";
import PhaseCard from "@/components/library/PhaseCard";
import type { PanelRequest } from "@/components/library/ExercisesPanel";
import { useSharedRoutines } from "@/hooks/useSharedRoutines";
import { notify } from "@/lib/message-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { t } from "@/i18n";

/**
 * Library → Routines: the phase card (to the Plan subscreen), a card per
 * routine, the routine editor, and a row to the Shared routines subscreen.
 */
export default function RoutinesPanel({
  request = null,
}: {
  request?: PanelRequest;
}) {
  const { state, save, deleteRecord } = useData();
  const { account } = useAuth();
  const cardioFields = useCardioFields();
  const repHold = useRepHold();
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
  const shared = useSharedRoutines({
    browsing: false,
    // An open draft of the routine follows its shared id.
    onSharedId: (id, sharedId) => {
      if (edit?.id !== id) return;
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      setEdit({ ...edit, data });
    },
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
  const records = routines(state.records);
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
  const startEdit = (id: string, data: Routine) => {
    if (edit && edit.id !== id) {
      notify(t("routines.resumeFirst"));
      setOpen(true);
      return;
    }
    if (!edit) setEdit({ id, data: structuredClone(data) });
    setError(null);
    setOpen(true);
  };
  const routineMenu = useRoutineMenu({
    scope: "routines:library",
    onEdit: (r) => {
      if (!busy) startEdit(r.id, r.payload);
    },
    onSharedId: (id, sharedId) => {
      if (edit?.id !== id) return;
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      setEdit({ ...edit, data });
    },
  });
  // `?edit=<id>` (from the Train preview) opens that routine's editor once.
  const [params, setParams] = useSearchParams();
  const editId = params.get("edit");
  useEffect(() => {
    if (!editId) return;
    const target = records.find((r) => r.id === editId);
    setParams({}, { replace: true });
    if (target) startEdit(target.id, target.payload);
  });
  const create = () => {
    if (!edit)
      setEdit({
        id: crypto.randomUUID(),
        data: { name: "", exercises: [] },
      });
    setError(null);
    setOpen(true);
  };
  // A search narrows the cards by name or exercise.
  const needle = (query ?? "").trim().toLocaleLowerCase();
  const shown = needle
    ? records.filter(
        (r) =>
          r.payload.name.toLocaleLowerCase().includes(needle) ||
          r.payload.exercises.some((ex) =>
            ex.name.toLocaleLowerCase().includes(needle),
          ),
      )
    : records;
  // A deleted routine's place keeps an Undo for a few seconds.
  const cards = useWithUndo("routines:library", shown);
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
  return (
    <div className="col-12">
      {workoutStart.confirmation}
      <PhaseCard />
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
      {cards.length > 0 && (
        <div className="routine-cards">
          {cards.map((slot) => {
            if (slot.kind === "undo")
              return (
                <UndoPlaceholder key={`u${slot.entry.id}`} entry={slot.entry} />
              );
            const { item: r, index } = slot;
            const done = lastDone.get(r.id);
            return (
              <RoutineCard
                key={r.id}
                title={
                  <>
                    {r.payload.name}
                    {r.payload.sharedId && (
                      <span className="stat-chip strong">
                        {t("exercises.shared")}
                      </span>
                    )}
                  </>
                }
                meta={
                  <>
                    {countLabel(r.payload.exercises.length, "exercise")} ·{" "}
                    {countLabel(setCount(r.payload), "set")} ·{" "}
                    {done
                      ? t("routines.lastDone", {
                          when: lastUsedLabel(done, now),
                        })
                      : t("routines.neverDone")}
                  </>
                }
                detail={
                  r.payload.exercises.map((ex) => ex.name).join(" · ") ||
                  undefined
                }
                openLabel={t("routines.editNamed", { name: r.payload.name })}
                onOpen={() => {
                  if (!busy) startEdit(r.id, r.payload);
                }}
                startLabel={t("routine.startNamed", { name: r.payload.name })}
                disabled={busy || workoutStart.busy}
                onStart={() =>
                  void workoutStart.start(
                    newWorkout(Object.values(state.records), { routine: r }),
                  )
                }
                actions={
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("routines.options", {
                      name: r.payload.name,
                    })}
                    disabled={busy}
                    onClick={() => routineMenu.open(r.id, index)}
                  >
                    <MoreHorizontal size={22} aria-hidden="true" />
                  </button>
                }
              />
            );
          })}
        </div>
      )}
      {records.length > 0 && !shown.length && (
        <p className="empty" role="status">
          {t("routines.noMatch")}
        </p>
      )}
      {!records.length && !edit && (
        <p className="empty">{t("routines.empty")}</p>
      )}
      {edit && !open && (
        <p className="draft-receipt" role="status">
          {t("routines.unfinished", {
            name: edit.data.name || t("routines.untitled"),
          })}{" "}
          {draft.retained ? t("routines.keptOnPhone") : t("routines.keepOpen")}
        </p>
      )}
      <button type="button" className="btn-dashed" onClick={create}>
        <Plus size={20} aria-hidden="true" />
        {edit ? t("routines.resumeDraft") : t("routines.new")}
      </button>
      <div className="list">
        <Link className="row shared-routines-row" to="/library/shared">
          <Globe size={20} aria-hidden="true" />
          <span className="row-main">
            <span className="row-title">{t("library.sharedRow")}</span>
            <span className="row-sub">{t("library.sharedRowText")}</span>
          </span>
          <ChevronRight className="chev" size={20} aria-hidden="true" />
        </Link>
      </div>
      {routineMenu.sheet}
      <Dialog
        open={open && !!edit}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (!value) setPicker(false);
          }
        }}
      >
        <DialogContent size="full" className="routine-dialog">
          <DialogHeader className="has-close">
            <div className="dialog-header-text">
              <DialogTitle>
                {edit && state.records[edit.id]
                  ? t("routines.edit")
                  : t("routines.create")}
              </DialogTitle>
              <DialogDescription>
                {t("routines.editorDescription")}
              </DialogDescription>
            </div>
            <DialogCloseButton />
          </DialogHeader>
          {edit && (
            <>
              <label>
                {t("routines.name")}
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
              {edit.data.exercises.map((ex) => (
                <RoutinePlan
                  key={ex.id}
                  exercise={ex}
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
                />
              ))}
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
              <div className="button-row">
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  {t("routines.closeKeep")}
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    setEdit(null);
                    setOpen(false);
                  }}
                >
                  {t("routines.discardDraft")}
                </button>
              </div>
              {/* Last, so it can stick to the bottom edge of the long form. */}
              <div className="sheet-footer">
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
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
            setEdit({
              ...edit,
              data: {
                ...edit.data,
                exercises: [
                  ...edit.data.exercises,
                  ...items.map((item) => ({
                    id: crypto.randomUUID(),
                    exerciseId: item.id,
                    name: item.name,
                    sets: [initialSet(item.id, item)],
                  })),
                ],
              },
            });
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
