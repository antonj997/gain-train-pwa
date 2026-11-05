import { newWorkout } from "@/data/start";
import {
  completedWorkouts,
  customDefaults,
  routines,
  setCount,
} from "@/data/selectors";
import { today } from "@/data/model";
import { errorMessage } from "@/lib/errors";
import { toastWithUndo } from "@/lib/undo-toast";
import { reorderByIds } from "@/lib/exercise-order";
import ReorderExercisesSheet from "@/components/workout/ReorderExercisesSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { Plus, Play, Trash2, MoreHorizontal, Share2 } from "lucide-react";
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
import SharedRoutineList from "@/components/library/SharedRoutineList";
import SharedRoutinePreviewSheet from "@/components/library/SharedRoutinePreview";
import { routineAverageMinutes } from "@/lib/routine-preview";
import { useSharedRoutines } from "@/hooks/useSharedRoutines";
import { unpublishRoutine } from "@/data/shared-routines";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { t, type MessageKey } from "@/i18n";

type View = "mine" | "shared";
const views = [
  { value: "mine", label: "routines.viewMine" },
  { value: "shared", label: "routines.viewShared" },
] as const satisfies readonly { value: View; label: MessageKey }[];

/** Library → Routines: a card per routine, the routine editor and a link to the training plan. */
export default function RoutinesPanel() {
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
  const [view, setView] = useState<View>("mine");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const shared = useSharedRoutines({
    browsing: view === "shared",
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
  const [menu, setMenu] = useState<string | null>(null);
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
  const menuRoutine = records.find((r) => r.id === menu);
  // The shared row being previewed and, for the user's own, its routine here.
  const previewRow =
    view === "shared"
      ? (shared.rows.find((r) => r.id === previewId) ?? null)
      : null;
  const previewOwn = previewRow?.mine
    ? records.find((r) => r.payload.sharedId === previewRow.id)
    : undefined;
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
  const saveOrder = (ids: string[]) => {
    const before = edit?.data.exercises.map((ex) => ex.id) ?? [];
    reorderTo(ids);
    toastWithUndo(
      t("exercise.reordered"),
      async () => reorderTo(before),
      t("exercise.reorderUndoFailed"),
    );
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      const message = errorMessage(cause, t("routines.saveFailed"));
      setError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const startEdit = (id: string, data: Routine) => {
    if (edit && edit.id !== id) {
      toast(t("routines.resumeFirst"));
      setOpen(true);
      return;
    }
    if (!edit) setEdit({ id, data: structuredClone(data) });
    setError(null);
    setOpen(true);
  };
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
  const remove = (r: (typeof records)[number]) => {
    const sharedId = r.payload.sharedId;
    // A shared routine leaves the shared library first, while its record
    // still holds the id needed to remove it.
    if (sharedId && !shared.ready) {
      toast.error(t("exercises.stopSharingFirst", { name: r.payload.name }));
      return;
    }
    return run(async () => {
      if (sharedId)
        try {
          await unpublishRoutine(sharedId);
        } catch {
          toast.error(t("exercises.unpublishFailed", { name: r.payload.name }));
          return;
        }
      await deleteRecord(r.id);
      setMenu(null);
      // Undo brings the routine back unshared: its shared row is gone.
      const restored = structuredClone(r.payload);
      delete restored.sharedId;
      toastWithUndo(
        t("routines.deleted"),
        () => save(r.id, "routine", restored),
        t("routines.restoreFailed"),
      );
    });
  };
  return (
    <div className="col-12">
      {workoutStart.confirmation}
      <div className="filters" role="group" aria-label={t("routines.view")}>
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            className="filter-chip"
            aria-pressed={view === v.value}
            onClick={() => setView(v.value)}
          >
            {t(v.label)}
          </button>
        ))}
      </div>
      {view === "shared" && (
        <SharedRoutineList
          canShare={shared.canShare}
          ready={shared.ready}
          status={shared.status}
          hasRows={shared.hasRows}
          rows={shared.rows}
          added={shared.added}
          adding={shared.adding}
          onRetry={shared.retry}
          onAdd={(id) => void shared.add(id)}
          onPreview={setPreviewId}
        />
      )}
      <SharedRoutinePreviewSheet
        row={previewRow}
        records={state.records}
        minutes={
          previewOwn
            ? routineAverageMinutes(previewOwn.id, state.records)
            : null
        }
        added={!!previewRow && shared.added.has(previewRow.id)}
        adding={!!previewRow && shared.adding === previewRow.id}
        busy={
          busy ||
          shared.sharing ||
          (!!shared.adding && shared.adding !== previewRow?.id)
        }
        canEdit={!!previewOwn}
        onClose={() => setPreviewId(null)}
        onAdd={async () => {
          if (previewRow && (await shared.add(previewRow.id)))
            setPreviewId(null);
        }}
        onEdit={() => {
          if (!previewOwn) return;
          setPreviewId(null);
          setView("mine");
          startEdit(previewOwn.id, previewOwn.payload);
        }}
        onStopSharing={async () => {
          if (previewRow && (await shared.unshare(previewRow.id)))
            setPreviewId(null);
        }}
      />
      {view === "mine" &&
        records.map((r) => {
          const done = lastDone.get(r.id);
          return (
            <section className="card col-12" key={r.id}>
              <div className="card-head routine-head">
                <div className="routine-title">
                  <h2 className="card-title routine-name">
                    {r.payload.name}
                    {r.payload.sharedId && (
                      <span className="stat-chip strong">
                        {t("exercises.shared")}
                      </span>
                    )}
                  </h2>
                  <span className="row-sub">
                    {countLabel(r.payload.exercises.length, "exercise")} ·{" "}
                    {countLabel(setCount(r.payload), "set")} ·{" "}
                    {done
                      ? t("routines.lastDone", {
                          when: lastUsedLabel(done, now),
                        })
                      : t("routines.neverDone")}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-btn routine-more"
                  aria-label={t("routines.options", { name: r.payload.name })}
                  disabled={busy}
                  onClick={() => setMenu(r.id)}
                >
                  <MoreHorizontal size={22} aria-hidden="true" />
                </button>
              </div>
              <p className="routine-exercises">
                {r.payload.exercises.map((ex) => ex.name).join(" · ")}
              </p>
              <div className="routine-actions">
                <button
                  className="btn-primary"
                  disabled={busy || workoutStart.busy}
                  onClick={() =>
                    void workoutStart.start(
                      newWorkout(Object.values(state.records), { routine: r }),
                    )
                  }
                >
                  <Play size={16} fill="currentColor" stroke="none" />
                  {t("common.start")}
                </button>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => startEdit(r.id, r.payload)}
                >
                  {t("common.edit")}
                </button>
              </div>
            </section>
          );
        })}
      {view === "mine" && !records.length && !edit && (
        <p className="empty">{t("routines.empty")}</p>
      )}
      {view === "mine" && edit && !open && (
        <p className="draft-receipt" role="status">
          {t("routines.unfinished", {
            name: edit.data.name || t("routines.untitled"),
          })}{" "}
          {draft.retained ? t("routines.keptOnPhone") : t("routines.keepOpen")}
        </p>
      )}
      {view === "mine" && (
        <button type="button" className="btn-dashed" onClick={create}>
          <Plus size={20} aria-hidden="true" />
          {edit ? t("routines.resumeDraft") : t("routines.new")}
        </button>
      )}
      <Sheet
        open={!!menuRoutine}
        onClose={() => setMenu(null)}
        title={menuRoutine?.payload.name}
      >
        {menuRoutine && (
          <>
            <div className="list">
              {shared.canShare ? (
                <ListRow
                  title={
                    shared.sharing
                      ? t("exercises.working")
                      : menuRoutine.payload.sharedId
                        ? t("exercises.stopSharing")
                        : t("exercises.shareToLibrary")
                  }
                  leading={<Share2 size={20} aria-hidden="true" />}
                  disabled={busy || shared.sharing}
                  onClick={async () => {
                    const done = menuRoutine.payload.sharedId
                      ? await shared.stopSharing(menuRoutine.id)
                      : await shared.share(menuRoutine.id);
                    if (done) setMenu(null);
                  }}
                />
              ) : (
                <ListRow
                  title={t("exercises.signInToShare")}
                  leading={<Share2 size={20} aria-hidden="true" />}
                  to="/auth"
                />
              )}
              <ListRow
                tone="danger"
                title={t("routines.delete")}
                leading={<Trash2 size={20} aria-hidden="true" />}
                disabled={busy}
                onClick={() => void remove(menuRoutine)}
              />
            </div>
            {shared.canShare && (
              <p className="row-sub">{t("sharedRoutines.menuNote")}</p>
            )}
          </>
        )}
      </Sheet>
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
                      toast.success(t("routines.saved"));
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
