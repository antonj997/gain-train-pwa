import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import {
  type Workout,
  type Exercise,
  type WorkoutSet,
  validSet,
  isFromNewerApp,
} from "@/data/model";
import { completedWorkouts, doneSetCount, setCount } from "@/data/selectors";
import { hasLoggedExercise, priorWorkouts } from "@/data/workouts";
import {
  RECORD_KINDS,
  liveRankedRecords,
  recordSetKinds,
} from "@/data/record-rank";
import { finishSummary, weekWorkoutNumber } from "@/lib/finish-summary";
import { workoutTargets } from "@/data/targets";
import {
  fatigueNote,
  fatigueTargetText,
  lowerTarget,
  lowerTargets,
  restoreTargets,
  type FatigueNote,
} from "@/data/fatigue";
import type { SetTarget } from "@/data/targets";
import type { FatigueRowState } from "@/components/workout/FatigueRow";
import {
  draftKey,
  parseFatigueDismissed,
  readDraft,
  writeDraft,
} from "@/lib/drafts";
import { local } from "@/lib/storage";
import { summarize } from "@/data/summary";
import { loadKeyOf } from "@/lib/load-keys";
import { targetRowText, targetSource, targetValueText } from "@/lib/set-target";
import { nextLine } from "@/lib/rest-dock";
import { useWorkoutGoals } from "@/hooks/useWorkoutGoals";
import { addExercises, type ExerciseTarget } from "@/lib/workout-editor";
import { effectiveRest, trainingHaptic } from "@/lib/preferences";
import { restTier } from "@/data/rest-tiers";
import { catalogueById } from "@/data/catalogue";
import { musclesLookup } from "@/data/exercise-muscles";
import { historyPath, planStatusPath } from "@/lib/routes";
import { usePreviousResults } from "@/hooks/usePreviousResults";
import { useRestTimer } from "@/hooks/useRestTimer";
import { useCardioFields } from "@/hooks/useCardioFields";
import { useRepHold } from "@/hooks/useRepHold";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useWorkoutActions } from "@/hooks/useWorkoutActions";
import { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import ExercisePicker from "@/components/ExercisePicker";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import { usePageBack } from "@/hooks/usePageTransitions";
import ExerciseCard from "@/components/ExerciseCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import ChangeExercisePicker from "@/components/workout/ChangeExercisePicker";
import ReorderExercisesSheet from "@/components/workout/ReorderExercisesSheet";
import { reorderByIds } from "@/lib/exercise-order";
import { notify } from "@/lib/message-store";
import EditSaveDialog from "@/components/workout/EditSaveDialog";
import FinishSheet from "@/components/workout/FinishSheet";
import RewardSheet from "@/components/workout/RewardSheet";
import NextSetChip from "@/components/workout/NextSetChip";
import WorkoutDock from "@/components/workout/WorkoutDock";
import { NumberPadContext } from "@/components/workout/number-pad-context";
import {
  WorkoutToastContext,
  type WorkoutToastMessage,
} from "@/components/workout/workout-toast";
import WorkoutToast from "@/components/workout/WorkoutToast";
import type { DockNext } from "@/components/workout/RestDock";
import type { PadField, PadTarget } from "@/lib/number-pad";
import { setBadge } from "@/data/drops";
import { labelSet } from "@/data/model";
import { durationLabel } from "@/lib/labels";
import { primeRestSound } from "@/lib/rest-sound";
import { useKeepScreenOn, useWakeLock } from "@/hooks/useWakeLock";
import { wakeLockSupported } from "@/lib/keep-screen-on";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { useWeightUnits } from "@/hooks/useWeightUnits";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import { carryWeight } from "@/lib/set-editing";
import type { WeightUnit } from "@/lib/units";
import WorkoutBanners from "@/components/workout/WorkoutBanners";
import WorkoutDetailsSheet from "@/components/workout/WorkoutDetailsSheet";
import LogChoiceSheet from "@/components/workout/LogChoiceSheet";
import WorkoutTopBar from "@/components/workout/WorkoutTopBar";
import "@/styles/workout.css";
import { useT } from "@/i18n/useT";
import { workoutTitle } from "@/lib/workout-name";
import { planNote } from "@/lib/plan-note";
import { exerciseDisplayName } from "@/lib/exercise-name";

export default function ActiveWorkout() {
  const { id } = useParams();
  const { state } = useData();
  const { account } = useAuth();
  const { t } = useT();
  const doc = id ? state.records[id] : null;
  if (!doc || doc.deleted || doc.kind !== "workout")
    return (
      <WorkoutUnavailable title={t("workout.notFound")}>
        <p>{t("workout.notFoundText")}</p>
      </WorkoutUnavailable>
    );
  if (isFromNewerApp(doc.payload))
    return (
      <WorkoutUnavailable title={t("workout.newerTitle")}>
        <p>{t("workout.newerText")}</p>
      </WorkoutUnavailable>
    );
  return (
    <Editor
      key={`${account}:${id}`}
      id={id!}
      account={account}
      initial={doc.payload}
    />
  );
}

/** A workout that cannot open here: the shared page header and a way back. */
function WorkoutUnavailable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { t } = useT();
  const back = usePageBack("/");
  return (
    <div className="page">
      <PageHeader
        eyebrow={t("workout.eyebrow")}
        title={title}
        notices={false}
        leading={<BackButton onClick={back} />}
      />
      <div className="empty-card" role="status">
        {children}
        <Link to="/" className="btn-secondary">
          {t("workout.backToWorkouts")}
        </Link>
      </div>
    </div>
  );
}

function Editor({
  id,
  account,
  initial,
}: {
  id: string;
  account: string;
  initial: Workout;
}) {
  const { state } = useData();
  const { bodyWeightKg } = useProfile();
  const navigate = useNavigate();
  const { t } = useT();
  const autosave = useWorkoutAutosave(id, account, initial);
  const { workout: w, change, changeWith, editing, saved, error } = autosave;
  // Starting from a planned day type opens the picker on its categories, and
  // logging a past workout opens its details sheet to pick the date.
  const location = useLocation();
  const [startState] = useState(
    () =>
      location.state as {
        suggest?: string[];
        details?: boolean;
        /** "Log workout" on Train: ask today's or an earlier one first. */
        choose?: boolean;
        /** Added from a long-press menu elsewhere (Library, Progress). */
        add?: ExerciseTarget[];
      } | null,
  );
  const suggested = startState?.suggest;
  const [picker, setPicker] = useState(() => !!suggested?.length);
  useEffect(() => {
    if (startState) navigate(location.pathname, { replace: true, state: null });
    // Only the first render reads the state; it is cleared so a reload starts plain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [finish, setFinish] = useState(false);
  const [details, setDetails] = useState(() => !!startState?.details);
  const [choosing, setChoosing] = useState(() => !!startState?.choose);
  const [discardChanges, setDiscardChanges] = useState(false);
  const [removeExercise, setRemoveExercise] = useState<Exercise | null>(null);
  const [changing, setChanging] = useState<Exercise | null>(null);
  const rest = useRestTimer(account, id);
  const { busy, complete, abandon, saveRoutineAndEnd } = useWorkoutActions(
    id,
    autosave,
    rest,
  );
  // Only an edit of a finished workout has unsaved changes to compare.
  const dirty = useMemo(
    () => editing && JSON.stringify(w) !== JSON.stringify(initial),
    [editing, w, initial],
  );
  const completed = doneSetCount(w);
  const total = setCount(w);
  const invalidChecked = w.exercises.some((ex) =>
    ex.sets.some((s) => s.done && !validSet(s)),
  );
  const nextSet = w.exercises.flatMap((ex) => ex.sets).find((s) => !s.done);
  // The records the checked sets hold so far, as if finished now: History's
  // ranked model, one per exercise (record-rank.ts).
  const liveRecords = useMemo(
    () => liveRankedRecords(state.records, { id, payload: w }),
    [state.records, id, w],
  );
  const recordsKey = liveRecords
    .map((record) => `${record.set.id}:${record.kinds.join(",")}`)
    .join("|");
  const recordKinds = useMemo(
    () => recordSetKinds(liveRecords),
    // A new Map only when a mark changes, so unchanged cards skip a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recordsKey],
  );
  const fromRoutine = !!w.routineId;
  const { previous, defaults, historyKey } = usePreviousResults(
    state.records,
    id,
    initial,
    w.date,
  );
  const [trainingPrefs] = useTrainingPreferences();
  const { askRir } = trainingPrefs;
  // Each exercise's weight unit: its own, else the default from Settings.
  const weightUnits = useWeightUnits();
  const { unitFor } = weightUnits;
  // v6 §D5: each exercise's note, weight step and rest time.
  const exerciseSettings = useExerciseSettings();
  const { stepFor } = exerciseSettings;
  // v6 §D7: each exercise's rest: its own, else the timer's time or its tier.
  const musclesKey = Object.values(state.records)
    .filter((r) => r.kind === "exercise")
    .map((r) => `${r.id}:${r.revision}:${r.localVersion}`)
    .join("|");
  const musclesOf = useMemo(
    () => musclesLookup(state.records),
    // musclesKey stands in for the custom exercises it summarises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [musclesKey],
  );
  const restFor = useCallback(
    (exerciseId: string) => {
      const own = exerciseSettings.restFor(exerciseId);
      const builtin = catalogueById.get(exerciseId);
      const tier = restTier({
        id: exerciseId,
        name: builtin?.name ?? "",
        equipment: exerciseSettings.equipmentFor(exerciseId),
        muscles: musclesOf(exerciseId),
        custom: !builtin,
      });
      return { own, tier, seconds: effectiveRest(trainingPrefs, own, tier) };
    },
    [exerciseSettings, musclesOf, trainingPrefs],
  );
  // Each set's target (double progression, targets.ts), worked out again
  // only when the other finished workouts or the shape of this one change:
  // not on every typed value.
  const latestRecords = useRef(state.records);
  latestRecords.current = state.records;
  const latestWorkout = useRef(w);
  latestWorkout.current = w;
  const shape = w.exercises
    .map(
      (ex) =>
        `${ex.exerciseId}:${ex.repRange ? `${ex.repRange.min}-${ex.repRange.max}` : ""}:${ex.fatigue ?? ""}:` +
        ex.sets
          .map((s) =>
            [s.id, s.section, s.drop ? 1 : 0, loadKeyOf(s), s.measure].join(
              ",",
            ),
          )
          .join(";"),
    )
    .join("|");
  const planKey = JSON.stringify(w.plan ?? null);
  const targets = useMemo(
    () => {
      const workout = latestWorkout.current;
      const found = workoutTargets(
        latestRecords.current,
        { id, payload: workout },
        unitFor,
        stepFor,
      );
      const exerciseOf = new Map(
        workout.exercises.flatMap((ex) =>
          ex.sets.map((s) => [s.id, ex] as const),
        ),
      );
      return new Map(
        [...found].map(([setId, { target, last }]) => {
          const ex = exerciseOf.get(setId);
          // v6 §D10: a target lowered for fatigue is a step lighter today.
          const shown =
            ex?.fatigue === "lowered"
              ? lowerTarget(target, stepFor(ex.exerciseId))
              : target;
          return [
            setId,
            {
              text: targetRowText(shown, last, unitFor(ex?.exerciseId ?? "")),
              // "100 × 6", for the dock's line (v6 B1).
              value: targetValueText(
                shown,
                last,
                unitFor(ex?.exerciseId ?? ""),
              ),
              source: targetSource(shown, last),
            },
          ];
        }),
      );
    },
    // shape, historyKey and planKey stand in for the records they summarise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyKey, shape, planKey, unitFor, stepFor, w.date, id],
  );
  // Lift goals: a mark by the exercise's name, and a check-in or the goal's
  // own lift as a set's target.
  const workoutGoals = useWorkoutGoals({
    records: state.records,
    workout: w,
    historyKey,
    shape,
    unitFor,
    bodyWeightKg,
    targets,
  });
  const deloadWeek = !!w.plan?.deload;

  const cardioFields = useCardioFields();
  const repHold = useRepHold();
  const add = (items: ExerciseTarget[]) =>
    change(addExercises(w, items, previous));
  // An exercise added from another screen's long-press menu: once, on arrival.
  const addedOnArrival = useRef(false);
  useEffect(() => {
    const items = startState?.add;
    if (!items?.length || addedOnArrival.current) return;
    addedOnArrival.current = true;
    add(items);
    notify.success(
      t("menu.addedToWorkout", {
        name: items.map((i) => exerciseDisplayName(i.id, i.name)).join(", "),
      }),
    );
    // Only the first render's state counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // One identity each for the editor's lifetime, so memoised cards only
  // re-render when their own exercise changes.
  const update = useCallback(
    (ex: Exercise) =>
      changeWith((current) => ({
        ...current,
        exercises: current.exercises.map((e) => (e.id === ex.id ? ex : e)),
      })),
    [changeWith],
  );
  const remove = (ex: Exercise) => {
    changeWith((current) => ({
      ...current,
      exercises: current.exercises.filter((e) => e.id !== ex.id),
    }));
    setRemoveExercise(null);
  };
  // Reorder exercises: the card whose menu opened it stays marked while the
  // sheet slides out.
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderFrom, setReorderFrom] = useState<string | null>(null);
  const openReorder = useStableCallback((ex: Exercise) => {
    setReorderFrom(ex.id);
    setReorderOpen(true);
  });
  // The new order shows at once and the top bar says Saved; reordering is
  // its own undo.
  const saveOrder = (ids: string[]) =>
    changeWith((current) => ({
      ...current,
      exercises: reorderByIds(current.exercises, ids),
    }));
  const requestRemove = useStableCallback((ex: Exercise) =>
    hasLoggedExercise(ex) ? setRemoveExercise(ex) : remove(ex),
  );
  const setDone = useStableCallback((exerciseId: string) => {
    if (editing) return;
    // The tap that checks a set lets the rest's tone play later.
    primeRestSound();
    // v6 §D7: the checked exercise's own rest, its tier, or none.
    const checked = w.exercises.find((ex) => ex.id === exerciseId);
    rest.start(checked ? restFor(checked.exerciseId).seconds : 0);
    trainingHaptic(rest.preferences.haptics);
  });
  // Every set checked: no rest, the dock is Finish workout.
  const allChecked = total > 0 && completed === total;
  useEffect(() => {
    if (allChecked && !editing) rest.skip();
    // Only when the last set is checked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChecked]);
  // The screen stays on through a running workout, unless switched off in
  // the workout's details.
  const [keepScreenOn, setKeepScreenOn] = useKeepScreenOn();
  useWakeLock(!editing && keepScreenOn);
  // v6 B2, B13: one toast at the workout's foot; a new one replaces it.
  const [toast, setToast] = useState<
    (WorkoutToastMessage & { id: number }) | null
  >(null);
  const toastId = useRef(0);
  const showToast = useCallback(
    (message: WorkoutToastMessage) =>
      setToast({ ...message, id: ++toastId.current }),
    [],
  );

  // v6 B13, §D10: a muscle already tired before an exercise. The answers
  // ("Behåll målet", or a lowering undone) are kept with this workout's
  // draft on the device.
  const fatigueMode = trainingPrefs.fatigueMode;
  const dismissKey = draftKey(account, "fatigue", id);
  const [dismissed, setDismissed] = useState<string[]>(
    () => readDraft(local, dismissKey, parseFatigueDismissed) ?? [],
  );
  const dismiss = (exerciseId: string, answered = true) =>
    setDismissed((current) => {
      const next = answered
        ? [...new Set([...current, exerciseId])]
        : current.filter((x) => x !== exerciseId);
      writeDraft(local, dismissKey, next.length ? next : null);
      return next;
    });
  // What each lowering changed, for Ångra; and the ones "Automatiskt" made.
  const lowered = useRef(
    new Map<string, { snapshot: Exercise; to: SetTarget }>(),
  );
  const [autoLowered, setAutoLowered] = useState<Record<string, SetTarget>>({});
  // The last finished workout that holds each exercise.
  const earlier = useMemo(
    () =>
      editing
        ? []
        : priorWorkouts(
            Object.values(latestRecords.current),
            {
              id,
              kind: "workout",
              revision: 0,
              deleted: false,
              localVersion: 0,
              dirty: false,
              payload: latestWorkout.current,
            },
            w.date,
          ),
    // historyKey stands in for the records it summarises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyKey, w.date, id, editing],
  );
  const fatigueNotes = new Map<string, FatigueNote>();
  if (!editing && fatigueMode !== "off")
    w.exercises.forEach((ex, index) => {
      if (ex.fatigue === "lowered" || dismissed.includes(ex.id)) return;
      const last = earlier.find((r) =>
        r.payload.exercises.some((e) => e.exerciseId === ex.exerciseId),
      );
      const open = ex.sets.find(
        (s) => s.section === "working" && !s.drop && !s.done,
      );
      const goal = open ? targets.get(open.id)?.source : undefined;
      const note = fatigueNote(
        w,
        index,
        last?.payload ?? null,
        musclesOf,
        stepFor(ex.exerciseId),
        goal && goal.weight != null && goal.reps != null
          ? { weight: goal.weight, reps: goal.reps }
          : null,
      );
      if (note) fatigueNotes.set(ex.id, note);
    });
  // One object per row while it says the same, so memoised cards skip renders.
  const fatigueCache = useRef(new Map<string, [string, FatigueRowState]>());
  const fatigueFor = (ex: Exercise): FatigueRowState => {
    const auto = autoLowered[ex.id];
    const note = fatigueNotes.get(ex.id);
    const state: FatigueRowState =
      auto && ex.fatigue === "lowered"
        ? { kind: "lowered", to: auto }
        : fatigueMode === "suggest" && note
          ? { kind: "suggest", note }
          : null;
    const key = JSON.stringify(state);
    const cached = fatigueCache.current.get(ex.id);
    if (cached && cached[0] === key) return cached[1];
    fatigueCache.current.set(ex.id, [key, state]);
    return state;
  };
  const lowerExercise = (ex: Exercise, to: SetTarget) => {
    lowered.current.set(ex.id, { snapshot: ex, to });
    update(lowerTargets(ex, to));
  };
  const restoreExercise = (exerciseId: string) => {
    const saved = lowered.current.get(exerciseId);
    if (!saved) return;
    lowered.current.delete(exerciseId);
    changeWith((current) => ({
      ...current,
      exercises: current.exercises.map((e) =>
        e.id === exerciseId ? restoreTargets(e, saved.snapshot) : e,
      ),
    }));
  };
  // "Automatiskt": the target is lowered at once, and the row says so.
  const autoKey = [...fatigueNotes.keys()].join("|");
  useEffect(() => {
    if (fatigueMode !== "auto") return;
    for (const ex of latestWorkout.current.exercises) {
      const note = fatigueNotes.get(ex.id);
      if (!note || autoLowered[ex.id]) continue;
      lowerExercise(ex, note.to);
      setAutoLowered((current) => ({ ...current, [ex.id]: note.to }));
    }
    // autoKey stands in for the notes it lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey, fatigueMode]);
  const onFatigue = useStableCallback(
    (ex: Exercise, choice: "lower" | "keep" | "undo") => {
      const current = w.exercises.find((e) => e.id === ex.id) ?? ex;
      if (choice === "keep") return dismiss(ex.id);
      if (choice === "undo") {
        restoreExercise(ex.id);
        dismiss(ex.id);
        setAutoLowered(({ [ex.id]: _gone, ...rest }) => rest);
        return;
      }
      const note = fatigueNotes.get(ex.id);
      if (!note) return;
      lowerExercise(current, note.to);
      showToast({
        text: t("workout.fatigueLowered", {
          to: fatigueTargetText(note.to, unitFor(ex.exerciseId)),
        }),
        // Ångra puts back the weights, the targets and the row.
        undo: () => restoreExercise(ex.id),
      });
    },
  );
  // The number pad of a live workout (NumberPad.tsx).
  const [padTarget, setPadTarget] = useState<PadTarget | null>(null);
  const padApi = useMemo(
    () => ({
      open: (setId: string, field: PadField) =>
        setPadTarget((current) =>
          current?.setId === setId && current.field === field
            ? current
            : { setId, field },
        ),
      coarse:
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches,
    }),
    [],
  );
  const changeSet = useCallback(
    (setId: string, edit: (set: WorkoutSet) => WorkoutSet) =>
      changeWith((current) => ({
        ...current,
        exercises: current.exercises.map((ex) =>
          ex.sets.some((s) => s.id === setId)
            ? {
                ...ex,
                // A raised weight carries to the later open sets (R4-17).
                sets: carryWeight(
                  ex.sets,
                  edit(ex.sets.find((s) => s.id === setId)!),
                ),
              }
            : ex,
        ),
      })),
    [changeWith],
  );
  const dockNext = useMemo((): DockNext | null => {
    for (const ex of w.exercises) {
      const index = ex.sets.findIndex((s) => !s.done);
      if (index < 0) continue;
      const set = ex.sets[index];
      const badge = setBadge(ex.sets, index);
      const title = badge.name;
      // v6 B1: "Nästa: Knäböj · set 2 · Mål 100 × 6 (5–7)", else what the
      // set holds.
      const goal = targets.get(set.id)?.value;
      const value = validSet(set)
        ? labelSet(set, true, unitFor(ex.exerciseId))
        : null;
      const label = nextLine(
        exerciseDisplayName(ex.exerciseId, ex.name),
        badge.tone === "working" ? Number(badge.text) : title,
        goal ?? null,
        goal ? ex.repRange : null,
      );
      return {
        setId: set.id,
        title,
        label: goal || !value ? label : `${label} · ${value}`,
      };
    }
    return null;
  }, [w.exercises, unitFor, targets]);
  // The Finish sheet's numbers, as it opens (v6 B9): the strongest record
  // with last time's best, the sets and the volume.
  const finishData = useMemo(
    () => {
      const ranked = [...liveRecords].sort(
        (a, b) => RECORD_KINDS.indexOf(a.top) - RECORD_KINDS.indexOf(b.top),
      );
      const lines = ranked.map((record) => {
        const unit = unitFor(record.exerciseId);
        // The heaviest working set of the exercise before today.
        let best: WorkoutSet | null = null;
        for (const r of earlier)
          for (const ex of r.payload.exercises) {
            if (ex.exerciseId !== record.exerciseId) continue;
            for (const s of ex.sets)
              if (
                s.done &&
                s.section === "working" &&
                !s.drop &&
                validSet(s) &&
                s.weight !== null &&
                (!best ||
                  s.weight > (best.weight ?? 0) ||
                  (s.weight === best.weight &&
                    (s.reps ?? 0) > (best.reps ?? 0)))
              )
                best = s;
          }
        return {
          text: `${exerciseDisplayName(record.exerciseId, record.name)} ${labelSet(record.set, false, unit)}`,
          previous: best ? labelSet(best, false, unit) : null,
        };
      });
      return finishSummary(w, lines);
    },
    // Read as the sheet opens; typing the note must not recount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish],
  );
  const finishMinutes = useMemo(
    () =>
      w.duration ??
      (w.startedAt
        ? Math.max(0, Math.floor((Date.now() - w.startedAt) / 60000))
        : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish],
  );
  const leave = () => {
    if (editing && dirty) setDiscardChanges(true);
    else navigate(editing ? historyPath(id) : "/");
  };
  // v6 B9, B10: a finished workout shows the reward before Train.
  const [reward, setReward] = useState<{
    first: boolean;
    records: number;
    weekNumber: number;
    done: number;
    volumeKg: number;
    minutes: number | null;
    plan?: { id: string; name: string };
  } | null>(null);
  const save = () => {
    if (editing) return void complete(false);
    const others = completedWorkouts(state.records).filter((r) => r.id !== id);
    const planRecord = w.plan ? state.records[w.plan.planId] : undefined;
    const snapshot = {
      first: others.length === 0,
      records: liveRecords.length,
      weekNumber: weekWorkoutNumber(
        others.map((r) => r.payload.date),
        w.date,
      ),
      done: finishData.done,
      volumeKg: finishData.volumeKg,
      minutes: finishMinutes,
      plan:
        planRecord?.kind === "plan" && !planRecord.deleted
          ? { id: planRecord.id, name: planRecord.payload.name }
          : undefined,
    };
    void complete(false, { stay: true }).then((saved) => {
      if (!saved) return;
      setFinish(false);
      setReward(snapshot);
    });
  };
  const rewardDone = () => {
    setReward(null);
    navigate("/");
    notify.success(t("finish.savedInCalendar"));
  };

  // Checked values are editable while editing, so say why Save is off.
  const saveStatus = editing
    ? invalidChecked
      ? t("workout.fixMarked")
      : dirty
        ? t("workout.unsaved")
        : t("workout.saved")
    : error
      ? t("workout.needsAttention")
      : saved
        ? t("workout.saved")
        : t("workout.saving");

  return (
    <div className="workout-editor" aria-busy={busy}>
      <WorkoutTopBar
        workout={w}
        editing={editing}
        busy={busy}
        completed={completed}
        total={total}
        saveStatus={saveStatus}
        saveError={editing ? invalidChecked : !!error}
        finishDisabled={
          busy || invalidChecked || (!editing && !!error) || (editing && !dirty)
        }
        onLeave={leave}
        onDetails={() => setDetails(true)}
        // v6 B9: with nothing checked the sheet asks what to do.
        onFinish={() => setFinish(true)}
      />
      <WorkoutBanners
        changedElsewhere={autosave.changedElsewhere}
        error={error}
        editing={editing}
        busy={busy}
        onLoadLatest={autosave.loadLatest}
        onKeepMine={autosave.keepMine}
        onRetry={() => change(w)}
      />
      <WorkoutToastContext.Provider value={editing ? null : showToast}>
        <NumberPadContext.Provider value={editing ? null : padApi}>
          {w.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              lastSession={previous.get(ex.exerciseId)}
              bodyWeightKg={bodyWeightKg}
              // Only the card holding the next set needs to know which it is.
              nextSetId={
                ex.sets.some((s) => s.id === nextSet?.id)
                  ? nextSet?.id
                  : undefined
              }
              unlockChecked={editing}
              defaults={defaults.get(ex.exerciseId)}
              // The Deload tag says it; a plain "Deload week" line would repeat it.
              planNote={
                deloadWeek && w.plan?.loads?.[ex.exerciseId] === undefined
                  ? undefined
                  : planNote(w.plan, ex.exerciseId, unitFor(ex.exerciseId))
              }
              deload={deloadWeek}
              targets={editing ? undefined : workoutGoals.targets}
              goalMark={
                editing ? undefined : workoutGoals.marks.get(ex.exerciseId)
              }
              askRir={!editing && askRir}
              onChange={update}
              onReorderExercises={
                w.exercises.length > 1 ? openReorder : undefined
              }
              onRemove={requestRemove}
              onChangeExercise={setChanging}
              onSetDone={setDone}
              records={recordKinds}
              restChip={!editing}
              cardioFields={cardioFields.fieldsFor(ex.exerciseId)}
              onCardioFields={cardioFields.setFields}
              repHold={repHold.holdFor(ex.exerciseId)}
              onRepHold={repHold.setHold}
              weightUnit={unitFor(ex.exerciseId)}
              defaultWeightUnit={weightUnits.defaultUnit}
              onWeightUnit={weightUnits.setUnit}
              equipment={exerciseSettings.equipmentFor(ex.exerciseId)}
              weightStep={exerciseSettings.stepFor(ex.exerciseId)}
              note={exerciseSettings.noteFor(ex.exerciseId)}
              onNote={exerciseSettings.setNote}
              onWeightStep={exerciseSettings.setStep}
              restSeconds={restFor(ex.exerciseId).seconds}
              restOwn={restFor(ex.exerciseId).own}
              restTier={restFor(ex.exerciseId).tier}
              onRestOwn={exerciseSettings.setRest}
              fatigue={editing ? null : fatigueFor(ex)}
              onFatigue={onFatigue}
            />
          ))}
        </NumberPadContext.Provider>
      </WorkoutToastContext.Provider>
      <ReorderExercisesSheet
        open={reorderOpen}
        exercises={w.exercises}
        currentId={reorderFrom}
        onSave={saveOrder}
        onClose={() => setReorderOpen(false)}
      />
      <ChangeExercisePicker
        exercise={changing}
        defaults={defaults}
        onClose={() => setChanging(null)}
        onChange={update}
      />
      {w.exercises.length ? (
        <button
          type="button"
          className="add-exercise"
          onClick={() => setPicker(true)}
          disabled={busy}
        >
          <Plus size={18} aria-hidden="true" />
          {t("workout.addExercise")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary add-first"
          onClick={() => setPicker(true)}
          disabled={busy}
        >
          <Plus size={21} aria-hidden="true" />
          {t("workout.addFirst")}
        </button>
      )}
      <div className="float-stack">
        {/* v6 B2, B13: the toast at the workout's foot. */}
        <WorkoutToast message={toast} onDone={() => setToast(null)} />
        {!padTarget && !toast && (
          <NextSetChip setId={nextSet?.id} pad={editing ? null : padApi} />
        )}
      </div>
      {!editing && (
        <WorkoutDock
          rest={{
            rest,
            allChecked,
            next: dockNext,
            totalSets: total,
            minutes: durationLabel(
              Math.max(
                0,
                Math.floor((Date.now() - (w.startedAt ?? Date.now())) / 60000),
              ),
            ),
            finishDisabled: busy || !!error,
            onFinish: () => setFinish(true),
          }}
          pad={{
            target: padTarget,
            setTarget: setPadTarget,
            workout: w,
            previous,
            unitFor,
            changeSet,
            targets: workoutGoals.targets,
            stepFor: exerciseSettings.stepFor,
            askRir,
          }}
        />
      )}
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={add}
        suggested={suggested}
      />
      <LogChoiceSheet
        open={choosing}
        onToday={() => setChoosing(false)}
        onEarlier={() => {
          setChoosing(false);
          // An earlier workout has no clock: its date and length are picked.
          change({ ...w, startedAt: null });
          setDetails(true);
        }}
      />
      <WorkoutDetailsSheet
        open={details}
        onClose={() => setDetails(false)}
        workout={w}
        onChange={change}
        // Only a running workout, and only where the browser can do it.
        keepScreenOn={
          !editing && wakeLockSupported()
            ? { on: keepScreenOn, onChange: setKeepScreenOn }
            : undefined
        }
      />
      <ConfirmDialog
        open={!!removeExercise}
        title={t("workout.removeTitle", {
          name: removeExercise
            ? exerciseDisplayName(
                removeExercise.exerciseId,
                removeExercise.name,
              )
            : "",
        })}
        description={t("workout.removeText")}
        cancelLabel={t("workout.keepExercise")}
        confirmLabel={t("workout.removeExercise")}
        onCancel={() => setRemoveExercise(null)}
        onConfirm={() => removeExercise && remove(removeExercise)}
      />
      <ConfirmDialog
        open={discardChanges}
        title={t("workout.discardTitle")}
        description={t("workout.discardText")}
        cancelLabel={t("workout.keepEditing")}
        confirmLabel={t("workout.discardChanges")}
        onCancel={() => setDiscardChanges(false)}
        onConfirm={() => {
          autosave.discard();
          navigate(historyPath(id));
        }}
      />
      {editing ? (
        <EditSaveDialog
          open={finish}
          name={workoutTitle(w.name)}
          completed={completed}
          total={total}
          invalidChecked={invalidChecked}
          busy={busy}
          onCancel={() => setFinish(false)}
          onConfirm={save}
        />
      ) : (
        <FinishSheet
          open={finish}
          onClose={() => setFinish(false)}
          name={workoutTitle(w.name)}
          exercises={w.exercises.length}
          summary={finishData}
          minutes={finishMinutes}
          note={w.note ?? ""}
          onNote={(note) => change({ ...w, note })}
          busy={busy}
          onSave={save}
          onSaveRoutine={() => void saveRoutineAndEnd()}
          onAbandon={() => void abandon()}
        />
      )}
      {reward && (
        <RewardSheet
          open
          first={reward.first}
          records={reward.records}
          weekNumber={reward.weekNumber}
          done={reward.done}
          volumeKg={reward.volumeKg}
          minutes={reward.minutes}
          plan={reward.plan?.name}
          onPlan={
            reward.plan
              ? () => {
                  const planId = reward.plan!.id;
                  setReward(null);
                  navigate(planStatusPath(planId));
                }
              : undefined
          }
          onDone={rewardDone}
        />
      )}
    </div>
  );
}
