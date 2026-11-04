import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, MoreHorizontal, Play, Star } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { cardioProgressFor, progressFor } from "@/data/analytics";
import { exerciseRecords, exerciseSessions } from "@/data/exercise-records";
import { favouriteChange } from "@/data/exercises";
import { today } from "@/data/model";
import { completedWorkouts, customDefaults } from "@/data/selectors";
import { newWorkout } from "@/data/start";
import { lastSessions } from "@/data/workouts";
import CardioProgressDetail from "@/components/CardioProgressDetail";
import ExerciseProgressDetail from "@/components/ExerciseProgressDetail";
import ExerciseHistory from "@/components/exercise/ExerciseHistory";
import ExerciseRecords from "@/components/exercise/ExerciseRecords";
import LibraryExerciseMenu from "@/components/library/LibraryExerciseMenu";
import PageHeader from "@/components/PageHeader";
import Segmented from "@/components/ui/Segmented";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import { usePageBack } from "@/hooks/usePageTransitions";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { useSharedExercises } from "@/hooks/useSharedExercises";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { categoryLabel, equipmentLabel } from "@/lib/catalogue-labels";
import { daysAgo } from "@/lib/dates";
import { draftKey, parseCustomDraft } from "@/lib/drafts";
import { libraryExercises, type LibraryExercise } from "@/lib/library";
import { exerciseEditPath } from "@/lib/routes";
import { addExercises } from "@/lib/workout-editor";
import { autoWorkoutName } from "@/lib/workout-name";
import { useT } from "@/i18n/useT";

type Tab = "overview" | "history" | "records";
const tabs = [
  { value: "overview", label: "exercise.overview" },
  { value: "history", label: "exercise.history" },
  { value: "records", label: "exercise.records" },
] as const;

/**
 * One exercise, from anywhere it is shown: its Overview (the latest and best
 * results and the chart), its History (every session's sets) and its Records.
 * The header holds the Library row's actions. `?tab=` picks the segment.
 */
export default function ExercisePage() {
  const { id = "" } = useParams();
  const { state, save } = useData();
  const { account } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const back = usePageBack("/library?tab=exercises");
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab =
    requested === "history" || requested === "records" ? requested : "overview";
  const { hidden, setHidden } = useHiddenExercises();
  const [menu, setMenu] = useState<LibraryExercise | null>(null);
  const workoutStart = useStartWorkout();
  const draft = useRetainedDraft(
    draftKey(account, "exercise"),
    parseCustomDraft,
  );
  const shared = useSharedExercises({
    browsing: false,
    // A draft of this exercise in the Library editor follows its shared id.
    onSharedId: (exerciseId, sharedId) => {
      const edit = draft.value;
      if (edit?.id !== exerciseId) return;
      const data = structuredClone(edit.data);
      if (sharedId) data.sharedId = sharedId;
      else delete data.sharedId;
      draft.replace({ ...edit, data });
    },
  });
  const now = today();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  const exercise = useMemo(
    () => libraryExercises(state.records, hidden).find((e) => e.id === id),
    [state.records, hidden, id],
  );
  const strength = useMemo(
    () => progressFor(records).find((item) => item.id === id),
    [records, id],
  );
  const cardio = useMemo(
    () => cardioProgressFor(records).find((item) => item.id === id),
    [records, id],
  );
  const sessions = useMemo(() => exerciseSessions(records, id), [records, id]);
  const best = useMemo(() => exerciseRecords(records, id), [records, id]);
  // A deleted custom exercise still has its sessions, under the name it had.
  const name = exercise?.name ?? strength?.name ?? cardio?.name ?? null;

  const header = (
    <PageHeader
      eyebrow={t("exercise.eyebrow")}
      title={name ?? t("exercise.notFoundTitle")}
      notices={false}
      leading={
        <button
          type="button"
          className="icon-btn"
          aria-label={t("common.back")}
          onClick={back}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      }
      action={
        exercise && (
          <div className="page-header-actions">
            <button
              type="button"
              className={"icon-btn" + (exercise.favourite ? " starred" : "")}
              aria-label={t(
                exercise.favourite
                  ? "exercises.unfavouriteNamed"
                  : "exercises.favouriteNamed",
                { name: exercise.name },
              )}
              aria-pressed={exercise.favourite}
              onClick={() => void toggleFavourite(exercise)}
            >
              <Star
                size={22}
                aria-hidden="true"
                fill={exercise.favourite ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("exercises.moreFor", { name: exercise.name })}
              onClick={() => setMenu(exercise)}
            >
              <MoreHorizontal size={22} aria-hidden="true" />
            </button>
          </div>
        )
      }
    />
  );

  if (name === null)
    return (
      <div className="page exercise-page">
        {header}
        <div className="empty-card" role="status">
          <h2>{t("exercise.notFoundTitle")}</h2>
          <p>{t("exercise.notFoundText")}</p>
          <Link to="/library?tab=exercises" className="btn-secondary">
            {t("exercise.backToLibrary")}
          </Link>
        </div>
      </div>
    );

  async function toggleFavourite(e: LibraryExercise) {
    try {
      const change = favouriteChange(state.records, e);
      await save(change.id, "exercise", change.payload, change.deleted);
    } catch {
      toast.error(t("exercises.favouriteFailed"));
    }
  }
  const toggleHidden = async (e: LibraryExercise, hide: boolean) => {
    try {
      await setHidden(e.id, hide);
      setMenu(null);
      toast(t(hide ? "exercises.hidden" : "exercises.back", { name: e.name }));
    } catch {
      toast.error(
        t(hide ? "exercises.hideFailed" : "exercises.unhideFailed", {
          name: e.name,
        }),
      );
    }
  };
  const startWith = () => {
    const base = newWorkout(records);
    const withExercise = addExercises(
      base,
      [{ id, name, ...customDefaults(state.records).get(id) }],
      lastSessions(completedWorkouts(records)),
    );
    void workoutStart.start({
      ...withExercise,
      name: autoWorkoutName({ name: "", exercises: withExercise.exercises }),
    });
  };

  const categories = exercise
    ? (exercise.categories ?? []).filter((c) => c !== exercise.category)
    : [];
  const logged = sessions.length > 0;
  return (
    <div className="page exercise-page">
      {workoutStart.confirmation}
      {header}
      {exercise && (
        <p className="exercise-meta">
          <span className="exercise-meta-main">
            {categoryLabel(exercise.category)}
          </span>
          {categories.length > 0 && (
            <span>
              {t("exercise.also", {
                categories: categories.map(categoryLabel).join(", "),
              })}
            </span>
          )}
          {exercise.equipment && (
            <span>{equipmentLabel(exercise.equipment)}</span>
          )}
          {exercise.custom && (
            <span className="stat-chip">{t("exercises.mine")}</span>
          )}
          {exercise.sharedId && (
            <span className="stat-chip strong">{t("exercises.shared")}</span>
          )}
          {exercise.hidden && (
            <span className="stat-chip muted">
              {t("exercise.hiddenChip")}
            </span>
          )}
        </p>
      )}
      {exercise?.note && <p className="row-sub">{exercise.note}</p>}
      {logged && (
        <Segmented<Tab>
          label={t("exercise.tabs")}
          value={tab}
          options={tabs.map(({ value, label }) => ({ value, label: t(label) }))}
          onChange={(next) =>
            setParams(next === "overview" ? {} : { tab: next }, {
              replace: true,
            })
          }
        />
      )}
      {!logged && (
        <div className="empty-card" role="status">
          <h2>{t("exercise.neverTitle")}</h2>
          <p>{t("exercise.neverText", { name })}</p>
        </div>
      )}
      {logged && tab === "overview" && strength && (
        <ExerciseProgressDetail
          item={strength}
          cutoffDate={daysAgo(30)}
          records={records}
        />
      )}
      {logged && tab === "overview" && !strength && cardio && (
        <CardioProgressDetail item={cardio} cutoffDate={daysAgo(30)} />
      )}
      {logged && tab === "history" && (
        <ExerciseHistory name={name} sessions={sessions} />
      )}
      {logged && tab === "records" && <ExerciseRecords records={best} />}
      {(tab === "overview" || !logged) && (
        <button
          type="button"
          className="btn-secondary btn-block"
          disabled={workoutStart.busy}
          onClick={startWith}
        >
          <Play size={18} aria-hidden="true" />
          {t("exercise.start")}
        </button>
      )}
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
          navigate(exerciseEditPath(e.id));
        }}
        onShare={async (e) => {
          if (await shared.share(e)) setMenu(null);
        }}
        onStopSharing={async (e) => {
          if (await shared.stopSharing(e)) setMenu(null);
        }}
        onToggleHidden={(e) => void toggleHidden(e, !e.hidden)}
      />
    </div>
  );
}
