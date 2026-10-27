import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Play, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import type { RoutineRecord } from "@/data/model";
import {
  completedWorkouts,
  doneSetCount,
  draftWorkouts,
  routines as routineRecords,
  setCount,
} from "@/data/selectors";
import { newWorkout } from "@/data/start";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { historyPath, workoutPath } from "@/lib/routes";

export default function Home() {
  const { state } = useData();
  const {
    start: requestStart,
    busy: starting,
    confirmation,
  } = useStartWorkout();
  const drafts = draftWorkouts(state.records);
  const last = completedWorkouts(state.records)[0];
  const routines = routineRecords(state.records);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const handledShortcut = useRef(false);
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
  return (
    <div className="stack home-page">
      {confirmation}
      <div className="page-title">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1>Ready for your next set?</h1>
        </div>
      </div>
      {drafts.map((r, i) => (
        <Link
          key={r.id}
          to={workoutPath(r.id)}
          className={"resume-card" + (i === 0 ? " resume-primary" : "")}
        >
          <span>
            <small>Resume workout</small>
            <strong>{r.payload.name}</strong>
            <span className="resume-meta">
              {localizedDate(r.payload.date)} · {doneSetCount(r.payload)} of{" "}
              {setCount(r.payload)} sets done
            </span>
          </span>
          <Play size={24} />
        </Link>
      ))}
      <div className="home-actions">
        <button
          className={drafts.length ? "secondary" : "primary large"}
          disabled={starting}
          onClick={() => void start()}
        >
          <Plus size={21} />
          {starting
            ? "Starting…"
            : drafts.length
              ? "Start a new workout"
              : "Start workout"}
        </button>
        <button
          className="text-button"
          disabled={starting}
          onClick={() => void start(true)}
        >
          Log a past workout
        </button>
      </div>
      <section>
        <div className="section-heading">
          <h2>Your routines</h2>
          <Link to="/routines">Manage</Link>
        </div>
        {routines.length ? (
          routines.map((r) => (
            <button
              className="list-card"
              disabled={starting}
              key={r.id}
              onClick={() => void start(false, r)}
            >
              <span>
                <strong>{r.payload.name}</strong>
                <small>
                  {countLabel(r.payload.exercises.length, "exercise")} ·{" "}
                  {r.payload.exercises
                    .slice(0, 3)
                    .map((exercise) => exercise.name)
                    .join(" · ")}
                </small>
              </span>
              <Play size={19} />
            </button>
          ))
        ) : (
          <div className="empty-card">
            <h3>A routine makes next time easier</h3>
            <p>
              Save a workout as a routine after finishing, or create one now.
            </p>
            <Link className="secondary" to="/routines">
              Create a routine
            </Link>
          </div>
        )}
      </section>
      {last && (
        <section>
          <div className="section-heading">
            <h2>Last workout</h2>
            <Link to="/history">View all</Link>
          </div>
          <Link className="list-card" to={historyPath(last.id)}>
            <span>
              <strong>{last.payload.name}</strong>
              <small>
                {localizedDate(last.payload.date)} ·{" "}
                {countLabel(doneSetCount(last.payload), "set")}
                {last.payload.duration !== null &&
                  ` · ${durationLabel(last.payload.duration)}`}
              </small>
            </span>
            <ChevronRight size={20} />
          </Link>
        </section>
      )}
    </div>
  );
}
