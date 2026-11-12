import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import PageHeader from "@/components/PageHeader";
import ProfileButton from "@/components/ProfileButton";
import ResumeCards from "@/components/home/ResumeCards";
import RoutinesSection from "@/components/home/RoutinesSection";
import TodayCard from "@/components/home/TodayCard";
import WeekCard from "@/components/home/WeekCard";
import type { RoutineRecord } from "@/data/model";
import {
  completedWorkouts,
  draftWorkouts,
  routines as routineRecords,
  runningWorkouts,
} from "@/data/selectors";
import { newWorkout } from "@/data/start";
import { today } from "@/data/model";
import { activePlans, plannedFor } from "@/data/plans";
import { usePlanned } from "@/hooks/usePlanned";
import { phaseWeek } from "@/data/phase";
import { lastDoneByRoutine, todayPick } from "@/data/today";
import { workoutPath } from "@/lib/routes";
import { readTrainingPreferences } from "@/lib/preferences";
import { autoWorkoutName } from "@/lib/workout-name";
import { useT } from "@/i18n/useT";

/** Swedish weekdays are lower case; as the page title the date starts upper case. */
const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * Train: start training now. The date and the profile avatar, this week (a
 * link to History), the running workout or the Today card, your routines and
 * an empty workout.
 */
export default function Home() {
  const { state } = useData();
  const {
    start: requestStart,
    busy: starting,
    confirmation,
  } = useStartWorkout();
  // The most recently started workout is the running one. Another started
  // workout can arrive from a second device; it is offered separately below.
  const [running, ...otherRunning] = runningWorkouts(state.records);
  const drafts = draftWorkouts(state.records).filter(
    (r) => !otherRunning.includes(r),
  );
  const completed = useMemo(
    () => completedWorkouts(state.records),
    [state.records],
  );
  const navigate = useNavigate();
  const { locale, t } = useT();
  const [params, setParams] = useSearchParams();
  const handledShortcut = useRef(false);
  const [goal] = useState(() => readTrainingPreferences().weeklyGoal);
  const start = (past = false, routine?: RoutineRecord) =>
    requestStart(newWorkout(Object.values(state.records), { routine, past }));
  // The home-screen shortcut resumes a running workout instead of replacing it.
  useEffect(() => {
    if (params.get("start") !== "workout" || handledShortcut.current) return;
    handledShortcut.current = true;
    setParams({}, { replace: true });
    if (running) navigate(workoutPath(running.id), { replace: true });
    else void start();
  });

  const day = today();
  const planned = usePlanned();
  const todayPlan = planned(day);
  // "Week 3 of 12", and whether it is a deload week, for the Today card.
  const todayPhase = useMemo(() => {
    const plan = plannedFor(activePlans(state.records), day)?.plan;
    return plan ? phaseWeek(plan, day) : null;
  }, [state.records, day]);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const lastDone = useMemo(() => lastDoneByRoutine(completed), [completed]);
  const pick = todayPick(
    todayPlan,
    routines.map((r) => r.id),
    lastDone,
  );
  // A day type or group with categories starts an empty workout and opens the
  // picker on those categories.
  const startWithSuggestions = (categories: string[], title: string) =>
    void requestStart(
      {
        ...newWorkout(Object.values(state.records)),
        name: autoWorkoutName({ name: "", exercises: [] }, { plan: title }),
      },
      categories,
    );

  return (
    <div className="page home-page">
      {confirmation}
      <PageHeader
        title={capitalize(
          new Date().toLocaleDateString(locale, {
            weekday: "long",
            month: "long",
            day: "numeric",
          }),
        )}
        align="first-line"
        action={<ProfileButton />}
      />
      {/* The running workout comes first (v5 A2), then the week. */}
      <ResumeCards
        running={running}
        otherRunning={otherRunning}
        drafts={drafts}
      />
      <WeekCard completed={completed} goal={goal} day={day} planned={planned} />
      {!running && (
        <TodayCard
          pick={pick}
          phase={todayPhase}
          routines={routines}
          lastDone={lastDone}
          day={day}
          starting={starting}
          onStartRoutine={(routine) => void start(false, routine)}
          onStartSuggestions={startWithSuggestions}
          onStartEmpty={() => void start()}
          onLogPast={() => void start(true)}
        />
      )}
      <RoutinesSection
        completed={completed}
        day={day}
        exclude={!running && pick.kind === "planned" ? pick.routineId : null}
        starting={starting}
        onStart={(routine) => void start(false, routine)}
      />
      <button
        type="button"
        className="btn-dashed"
        disabled={starting}
        onClick={() => void start()}
      >
        <Plus size={20} aria-hidden="true" />
        {starting ? t("home.starting") : t("home.emptyWorkout")}
      </button>
      {/* While a workout runs the Today card and its ⋯ step aside; logging an
          earlier workout stays one tap away. */}
      {running && (
        <button
          type="button"
          className="btn-quiet home-log-past"
          disabled={starting}
          onClick={() => void start(true)}
        >
          {t("home.logPast")}
        </button>
      )}
    </div>
  );
}
