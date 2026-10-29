import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Play, Repeat, Settings } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import PageHeader from "@/components/PageHeader";
import { RoutineRow, RoutinePreviewSheet } from "@/components/RoutinePreview";
import type { RoutineRecord, Workout } from "@/data/model";
import {
  completedWorkouts,
  doneSetCount,
  draftWorkouts,
  routines as routineRecords,
  setCount,
  workouts as allWorkouts,
} from "@/data/selectors";
import { isDrop } from "@/data/drops";
import { newWorkout } from "@/data/start";
import { today } from "@/data/model";
import { activePlans, groupsOf, plannedFor, resolveCell } from "@/data/plans";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel, timeTrainedLabel } from "@/lib/labels";
import { historyPath, routineEditPath, workoutPath } from "@/lib/routes";
import { routineAverageMinutes } from "@/lib/routine-preview";
import { headlineFor } from "@/lib/headlines";
import { readTrainingPreferences } from "@/lib/preferences";
import { goalStreak, weekStrip, weekTotals } from "@/lib/week-summary";

/** The first unchecked set of a workout, such as "Bench Press set 3". */
function nextSet(workout: Workout) {
  for (const exercise of workout.exercises) {
    let number = 0;
    for (const set of exercise.sets) {
      if (isDrop(set)) continue;
      number++;
      if (!set.done) return `${exercise.name} set ${number}`;
    }
  }
  return null;
}

/** The current time, refreshed every 30 seconds while a workout runs. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export default function Home() {
  const { state } = useData();
  const {
    start: requestStart,
    repeat,
    busy: starting,
    confirmation,
  } = useStartWorkout();
  const drafts = draftWorkouts(state.records);
  const completed = useMemo(
    () => completedWorkouts(state.records),
    [state.records],
  );
  const last = completed[0];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const handledShortcut = useRef(false);
  const [headline] = useState(() => headlineFor());
  const [goal] = useState(() => readTrainingPreferences().weeklyGoal);
  const now = useNow(drafts.some((r) => r.payload.startedAt !== null));
  const start = (past = false, routine?: RoutineRecord) =>
    requestStart(newWorkout(Object.values(state.records), { routine, past }));
  // The home-screen shortcut resumes a running workout instead of replacing it.
  useEffect(() => {
    if (params.get("start") !== "workout" || handledShortcut.current) return;
    handledShortcut.current = true;
    setParams({}, { replace: true });
    const running = drafts.find((r) => r.payload.startedAt !== null);
    if (running) navigate(workoutPath(running.id), { replace: true });
    else void start();
  });

  const day = today();
  const week = useMemo(() => {
    const dates = completed.map((r) => r.payload.date);
    const totals = weekTotals(
      completed.map((r) => r.payload),
      day,
    );
    return {
      days: weekStrip(dates, day),
      totals,
      streak: goalStreak(dates, goal, day),
    };
  }, [completed, goal, day]);

  // Routines last used first; those never used keep their saved order.
  const recentRoutines = useMemo(() => {
    const lastUsed = new Map<string, number>();
    allWorkouts(state.records).forEach((r, index) => {
      const id = r.payload.routineId;
      if (id && !lastUsed.has(id)) lastUsed.set(id, index);
    });
    return routineRecords(state.records)
      .map((routine, order) => ({ routine, order }))
      .sort(
        (a, b) =>
          (lastUsed.get(a.routine.id) ?? Infinity) -
            (lastUsed.get(b.routine.id) ?? Infinity) || a.order - b.order,
      )
      .slice(0, 3)
      .map(({ routine }) => routine);
  }, [state.records]);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRoutine =
    routineRecords(state.records).find((r) => r.id === previewId) ?? null;
  const routineStats = (id: string) => ({
    minutes: routineAverageMinutes(id, state.records),
    lastDone:
      completed.find((r) => r.payload.routineId === id)?.payload.date ?? null,
  });
  const renderRoutine = (r: RoutineRecord) => (
    <RoutineRow
      key={r.id}
      routine={r}
      stats={routineStats(r.id)}
      disabled={starting}
      onPreview={() => setPreviewId(r.id)}
      onStart={() => void start(false, r)}
    />
  );

  // What the plans hold for a date. A deleted routine or group is ignored, as if
  // nothing were planned.
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const planned = (date: string) =>
    plans.length
      ? resolveCell(plannedFor(plans, date)?.cell, {
          routines: routineRecords(state.records),
          groups: groupsOf(state.records),
        })
      : null;
  const todayPlan = planned(day);
  const planRoutines = todayPlan
    ? todayPlan.routineIds.flatMap((id) => {
        const routine = routineRecords(state.records).find((r) => r.id === id);
        return routine ? [routine] : [];
      })
    : [];
  // A day type or group with categories starts an empty workout and opens the
  // picker on those categories.
  const startWithSuggestions = () =>
    todayPlan &&
    void requestStart(
      {
        ...newWorkout(Object.values(state.records)),
        name: todayPlan.title,
      },
      todayPlan.categories,
    );

  const { totals } = week;
  const goalMet = goal !== null && totals.workouts >= goal;

  return (
    <div className="page home-page">
      {confirmation}
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={headline}
        status
        action={
          <Link
            to="/settings"
            className="icon-btn filled"
            aria-label="Settings"
          >
            <Settings size={22} aria-hidden="true" />
          </Link>
        }
      />
      {drafts.map((r, i) => {
        const running = r.payload.startedAt !== null;
        const next = nextSet(r.payload);
        return (
          <Link
            key={r.id}
            to={workoutPath(r.id)}
            className={
              "resume-card" +
              (i === 0 ? " resume-primary" : "") +
              // A past workout has no start time and is not "live".
              (running ? " is-running" : "")
            }
          >
            <span>
              <small>
                {running && <span className="resume-live" aria-hidden="true" />}
                {running
                  ? `In progress · ${timeTrainedLabel(
                      Math.max(
                        0,
                        Math.floor((now - r.payload.startedAt!) / 60000),
                      ),
                    )}`
                  : "Resume workout"}
              </small>
              <strong>{r.payload.name}</strong>
              <span className="resume-meta">
                {!running && `${localizedDate(r.payload.date)} · `}
                {doneSetCount(r.payload)} of {setCount(r.payload)} sets
                {next && ` · next: ${next}`}
              </span>
            </span>
            <Play className="resume-play" fill="currentColor" stroke="none" />
          </Link>
        );
      })}
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
            ? "Starting…"
            : drafts.length
              ? "Start a new workout"
              : "Start workout"}
        </button>
        <button
          className="btn-quiet"
          disabled={starting}
          onClick={() => void start(true)}
        >
          Log a past workout
        </button>
      </div>
      <section className="card col-12" aria-labelledby="week-heading">
        <div className="card-head">
          <h2 id="week-heading">This week</h2>
          <span className="card-head-end">
            <span className={"stat-chip" + (goalMet ? " done" : "")}>
              {goal !== null
                ? `${totals.workouts} of ${goal} workouts`
                : countLabel(totals.workouts, "workout")}
            </span>
            <Link className="text-link" to="/library?tab=plan">
              Plan
            </Link>
          </span>
        </div>
        <ol className="week">
          {week.days.map((d) => {
            const entry = planned(d.date);
            const outlined = entry !== null && entry.kind !== "rest";
            return (
              <li
                key={d.date}
                className="day"
                aria-label={
                  localizedDate(d.date, { weekday: "long", day: "numeric" }) +
                  (d.done ? ", workout done" : "") +
                  (d.today ? ", today" : "") +
                  (entry ? `, planned: ${entry.title}` : "")
                }
              >
                <span aria-hidden="true">{d.label}</span>
                <span
                  className={
                    "dot" +
                    (d.done ? " done" : "") +
                    (d.today ? " today" : "") +
                    (outlined ? " planned" : "")
                  }
                  aria-hidden="true"
                >
                  {d.day}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="row-sub">
          {totals.workouts
            ? [
                countLabel(totals.sets, "set"),
                timeTrainedLabel(totals.minutes),
                week.streak >= 2 && `${week.streak} weeks in a row on goal`,
              ]
                .filter(Boolean)
                .join(" · ")
            : week.streak >= 2
              ? `${week.streak} weeks in a row on goal`
              : "Nothing logged yet this week."}
        </p>
      </section>
      <section aria-labelledby="routines-heading">
        <div className="section-head">
          <h2 id="routines-heading">Start a routine</h2>
          <Link className="text-link" to="/library">
            All routines
          </Link>
        </div>
        {todayPlan && (
          <div className="card plan-today">
            <span className="plan-today-text">
              <span className="row-sub">From your plan</span>
              <strong className="card-title">Today: {todayPlan.title}</strong>
            </span>
            {todayPlan.kind === "routine" && planRoutines[0] && (
              <button
                className="btn-primary btn-sm"
                disabled={starting}
                onClick={() => void start(false, planRoutines[0])}
              >
                Start
              </button>
            )}
            {todayPlan.kind === "type" && (
              <button
                className="btn-primary btn-sm"
                disabled={starting}
                onClick={startWithSuggestions}
              >
                Start with suggestions
              </button>
            )}
          </div>
        )}
        {todayPlan?.kind === "group" && (
          <div className="plan-today-group">
            {planRoutines.length > 0 && (
              <div className="list">{planRoutines.map(renderRoutine)}</div>
            )}
            {todayPlan.categories.length > 0 && (
              <button
                className="btn-secondary btn-block"
                disabled={starting}
                onClick={startWithSuggestions}
              >
                Start with suggestions
              </button>
            )}
          </div>
        )}
        {recentRoutines.length ? (
          <div className="list">{recentRoutines.map(renderRoutine)}</div>
        ) : (
          <div className="card col-12">
            <h3 className="card-title">A routine makes next time easier</h3>
            <p className="row-sub">
              Save a workout as a routine after finishing, or create one now.
            </p>
            <Link className="btn-secondary" to="/library">
              Create a routine
            </Link>
          </div>
        )}
      </section>
      <RoutinePreviewSheet
        routine={previewRoutine}
        stats={
          previewRoutine
            ? routineStats(previewRoutine.id)
            : { minutes: null, lastDone: null }
        }
        now={day}
        disabled={starting}
        onClose={() => setPreviewId(null)}
        onStart={() => {
          if (!previewRoutine) return;
          setPreviewId(null);
          void start(false, previewRoutine);
        }}
        onEdit={() => {
          if (previewRoutine) navigate(routineEditPath(previewRoutine.id));
        }}
      />
      {last && (
        <section className="card last-card" aria-label="Last workout">
          <Link className="last-text" to={historyPath(last.id)}>
            <span className="row-sub">
              Last workout ·{" "}
              {localizedDate(last.payload.date, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="card-title">
              {last.payload.name} ·{" "}
              {countLabel(doneSetCount(last.payload), "set")}
              {last.payload.duration !== null &&
                ` · ${durationLabel(last.payload.duration)}`}
            </span>
          </Link>
          <button
            className="btn-secondary"
            disabled={starting}
            onClick={() => void repeat(last.payload)}
          >
            <Repeat size={18} aria-hidden="true" />
            Repeat
          </button>
        </section>
      )}
    </div>
  );
}
