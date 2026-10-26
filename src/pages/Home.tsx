import { suggestedExercises } from "@/data/start";
import { sortWorkoutsNewest } from "@/data/workouts";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { Plus, Play, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/useData";
import { today, type Workout, type Routine } from "@/data/model";
export default function Home() {
  const { state } = useData();
  const {
    start: requestStart,
    busy: starting,
    confirmation,
  } = useStartWorkout();
  const records = Object.values(state.records).filter((r) => !r.deleted);
  const drafts = records
    .filter(
      (r) => r.kind === "workout" && (r.payload as Workout).status === "draft",
    )
    .sort(sortWorkoutsNewest);
  const recent = records
    .filter(
      (r) =>
        r.kind === "workout" && (r.payload as Workout).status === "completed",
    )
    .sort(sortWorkoutsNewest);
  const routines = records.filter((r) => r.kind === "routine");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const handledShortcut = useRef(false);
  const start = async (past = false, routine?: Routine, routineId?: string) => {
    const now = Date.now();
    await requestStart({
      routineId,
      name: routine?.name || "Workout",
      date: today(),
      duration: null,
      startedAt: past ? null : now,
      createdAt: now,
      status: "draft",
      exercises: routine
        ? suggestedExercises(routine.exercises, Object.values(state.records))
        : [],
    });
  };
  // The home-screen shortcut resumes a running workout instead of replacing it.
  useEffect(() => {
    if (params.get("start") !== "workout" || handledShortcut.current) return;
    handledShortcut.current = true;
    setParams({}, { replace: true });
    const running = drafts.find(
      (r) => (r.payload as Workout).startedAt !== null,
    );
    if (running) navigate("/workout/" + running.id, { replace: true });
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
          to={"/workout/" + r.id}
          className={"resume-card" + (i === 0 ? " resume-primary" : "")}
        >
          <span>
            <small>Resume workout</small>
            <strong>{r.payload.name}</strong>
            <span className="resume-meta">
              {localizedDate((r.payload as Workout).date)} ·{" "}
              {(r.payload as Workout).exercises.reduce(
                (n, ex) => n + ex.sets.filter((set) => set.done).length,
                0,
              )}{" "}
              of{" "}
              {(r.payload as Workout).exercises.reduce(
                (n, ex) => n + ex.sets.length,
                0,
              )}{" "}
              sets done
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
              onClick={() => void start(false, r.payload as Routine, r.id)}
            >
              <span>
                <strong>{r.payload.name}</strong>
                <small>
                  {countLabel(
                    (r.payload as Routine).exercises.length,
                    "exercise",
                  )}{" "}
                  ·{" "}
                  {(r.payload as Routine).exercises
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
      {recent.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Last workout</h2>
            <Link to="/history">View all</Link>
          </div>
          <Link className="list-card" to={"/history?workout=" + recent[0].id}>
            <span>
              <strong>{recent[0].payload.name}</strong>
              <small>
                {localizedDate((recent[0].payload as Workout).date)} ·{" "}
                {countLabel(
                  (recent[0].payload as Workout).exercises.reduce(
                    (n, e) => n + e.sets.filter((s) => s.done).length,
                    0,
                  ),
                  "set",
                )}
                {(recent[0].payload as Workout).duration !== null &&
                  ` · ${(recent[0].payload as Workout).duration === 0 ? "<1" : (recent[0].payload as Workout).duration} min`}
              </small>
            </span>
            <ChevronRight size={20} />
          </Link>
        </section>
      )}
    </div>
  );
}
