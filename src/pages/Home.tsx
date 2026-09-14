import { suggestedExercises } from "@/data/start";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Play, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import {
  today,
  repeatExercises,
  type Workout,
  type Routine,
} from "@/data/model";
export default function Home() {
  const { state, save } = useData(),
    navigate = useNavigate();
  const records = Object.values(state.records).filter((r) => !r.deleted);
  const drafts = records.filter(
    (r) => r.kind === "workout" && (r.payload as Workout).status === "draft",
  );
  const recent = records
    .filter(
      (r) =>
        r.kind === "workout" && (r.payload as Workout).status === "completed",
    )
    .sort((a, b) =>
      (b.payload as Workout).date.localeCompare((a.payload as Workout).date),
    );
  const routines = records.filter((r) => r.kind === "routine");
  const start = async (past = false, routine?: Routine, routineId?: string) => {
    const id = crypto.randomUUID();
    await save(id, "workout", {
      routineId,
      name: routine?.name || "Workout",
      date: today(),
      duration: null,
      startedAt: past ? null : Date.now(),
      status: "draft",
      exercises: routine
        ? suggestedExercises(routine.exercises, Object.values(state.records))
        : [],
    });
    navigate("/workout/" + id);
  };
  return (
    <div className="stack home-page">
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
      {drafts.map((r) => (
        <Link key={r.id} to={"/workout/" + r.id} className="resume-card">
          <span>
            <small>IN PROGRESS</small>
            <strong>{r.payload.name}</strong>
            <span>
              {(r.payload as Workout).exercises.length} exercises · Resume where
              you left off
            </span>
          </span>
          <Play size={24} />
        </Link>
      ))}
      <button className="primary large" onClick={() => void start()}>
        <Plus size={21} />
        Start workout
      </button>
      <button className="text-button" onClick={() => void start(true)}>
        Log a past workout
      </button>
      <section>
        <div className="section-heading">
          <h2>Your routines</h2>
          <Link to="/routines">Manage</Link>
        </div>
        {routines.length ? (
          routines.map((r) => (
            <button
              className="list-card"
              key={r.id}
              onClick={() => void start(false, r.payload as Routine, r.id)}
            >
              <span>
                <strong>{r.payload.name}</strong>
                <small>
                  {(r.payload as Routine).exercises.length} exercises
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
                {(recent[0].payload as Workout).date} ·{" "}
                {(recent[0].payload as Workout).exercises.reduce(
                  (n, e) => n + e.sets.filter((s) => s.done).length,
                  0,
                )}{" "}
                sets
              </small>
            </span>
            <ChevronRight size={20} />
          </Link>
        </section>
      )}
    </div>
  );
}
