import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Settings } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import PageHeader from "@/components/PageHeader";
import LastWorkoutCard from "@/components/home/LastWorkoutCard";
import ResumeCards from "@/components/home/ResumeCards";
import RoutinesSection from "@/components/home/RoutinesSection";
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
import { activePlans, groupsOf, plannedFor, resolveCell } from "@/data/plans";
import { phaseWeek } from "@/data/phase";
import { workoutPath } from "@/lib/routes";
import { readTrainingPreferences } from "@/lib/preferences";
import { autoWorkoutName } from "@/lib/workout-name";
import { useT } from "@/i18n/useT";

/** Swedish weekdays are lower case; as the page title the date starts upper case. */
const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

export default function Home() {
  const { state } = useData();
  const {
    start: requestStart,
    repeat,
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
  const last = completed[0];
  const navigate = useNavigate();
  const { t, locale } = useT();
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
  // What the plans hold for a date. A deleted routine or group is ignored, as if
  // nothing were planned.
  const planned = useMemo(() => {
    const plans = activePlans(state.records);
    const names = {
      routines: routineRecords(state.records),
      groups: groupsOf(state.records),
    };
    return (date: string) =>
      plans.length ? resolveCell(plannedFor(plans, date)?.cell, names) : null;
  }, [state.records]);
  const todayPlan = planned(day);
  // "Week 3 of 12", and whether it is a deload week, for today's plan row.
  const todayPhase = useMemo(() => {
    const plan = plannedFor(activePlans(state.records), day)?.plan;
    return plan ? phaseWeek(plan, day) : null;
  }, [state.records, day]);
  // A day type or group with categories starts an empty workout and opens the
  // picker on those categories.
  const startWithSuggestions = () =>
    todayPlan &&
    void requestStart(
      {
        ...newWorkout(Object.values(state.records)),
        name: autoWorkoutName(
          { name: "", exercises: [] },
          { plan: todayPlan.title },
        ),
      },
      todayPlan.categories,
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
        status
        action={
          <Link
            to="/settings"
            className="icon-btn filled"
            aria-label={t("home.settings")}
          >
            <Settings size={22} aria-hidden="true" />
          </Link>
        }
      />
      <ResumeCards
        running={running}
        otherRunning={otherRunning}
        drafts={drafts}
      />
      <div className="home-actions">
        <button
          className={
            drafts.length
              ? "btn-secondary btn-block"
              : "btn-primary btn-block btn-lg"
          }
          disabled={starting}
          onClick={() => void start()}
        >
          <Plus size={20} aria-hidden="true" />
          {starting
            ? t("home.starting")
            : drafts.length
              ? t("home.startNew")
              : t("home.start")}
        </button>
        <button
          className="btn-quiet"
          disabled={starting}
          onClick={() => void start(true)}
        >
          {t("home.logPast")}
        </button>
      </div>
      <WeekCard completed={completed} goal={goal} day={day} planned={planned} />
      <RoutinesSection
        completed={completed}
        day={day}
        todayPlan={todayPlan}
        todayPhase={todayPhase}
        starting={starting}
        onStart={(routine) => void start(false, routine)}
        onStartSuggestions={startWithSuggestions}
      />
      {last && (
        <LastWorkoutCard
          last={last}
          disabled={starting}
          onRepeat={() => void repeat(last.payload)}
        />
      )}
    </div>
  );
}
