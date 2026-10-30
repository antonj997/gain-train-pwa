import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import GoalEditor from "@/components/goals/GoalEditor";
import {
  type GoalItem,
  activeGoals,
  goalProgress,
  goalTitle,
} from "@/data/goals";
import { today as todayDate } from "@/data/model";
import { completedWorkouts } from "@/data/selectors";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { formatDecimal, t } from "@/i18n";

const kg = (value: number) => `${formatDecimal(Number(value.toFixed(1)))} kg`;

/** Progress → Goals: a card per goal and "+ Add goal". Needs no plan and no workouts. */
export default function GoalsSection() {
  const { state, save } = useData();
  const { bodyWeightKg } = useProfile();
  const today = todayDate();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  const goals = useMemo(() => activeGoals(state.records), [state.records]);
  const [editing, setEditing] = useState<GoalItem | "new" | null>(null);
  const [session, setSession] = useState(0);
  const shown = useRef(editing);
  if (editing) shown.current = editing;
  const edit = (next: GoalItem | "new") => {
    setSession((n) => n + 1);
    setEditing(next);
  };

  // Each goal reads the whole log; only redo it when the log or profile changes.
  const cards = useMemo(() => {
    const completed = completedWorkouts(records);
    return goals.map((goal) => ({
      goal,
      progress: goalProgress(goal, completed, { bodyWeightKg }, today),
    }));
  }, [goals, records, bodyWeightKg, today]);

  // A bodyweight goal has no history to read the day it was reached from, so
  // the day is saved on the goal the first time it shows as reached. Once per
  // goal: re-renders while that save is in flight must not send it again.
  const written = useRef(new Set<string>());
  useEffect(() => {
    for (const { goal, progress } of cards)
      if (
        goal.kind === "bodyweight" &&
        progress.met &&
        !goal.reachedOn &&
        !written.current.has(goal.id)
      ) {
        written.current.add(goal.id);
        const { id, ...payload } = goal;
        void save(id, "goal", { ...payload, reachedOn: today }).catch(() =>
          written.current.delete(id),
        );
      }
  }, [cards, save, today]);

  const current = shown.current;
  return (
    <section aria-labelledby="goals-heading">
      <div className="section-head">
        <h2 id="goals-heading">{t("goals.title")}</h2>
        <button type="button" className="text-link" onClick={() => edit("new")}>
          <Plus size={18} aria-hidden="true" />
          {t("goals.add")}
        </button>
      </div>
      {cards.length > 0 && (
        <div className="goal-list">
          {cards.map(({ goal, progress }) => (
            <button
              type="button"
              key={goal.id}
              className="card goal-card"
              onClick={() => edit(goal)}
            >
              <span className="card-head">
                <strong className="card-title">{goalTitle(goal)}</strong>
                <span className={"stat-chip" + (progress.met ? " done" : "")}>
                  {progress.met
                    ? t("goals.reached")
                    : localizedDate(goal.byDate, {
                        day: "numeric",
                        month: "short",
                      })}
                </span>
              </span>
              <span
                className={"goal-bar" + (progress.met ? " is-done" : "")}
                role="progressbar"
                aria-label={t("goals.progressLabel", {
                  title: goalTitle(goal),
                })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.fraction * 100)}
              >
                <span style={{ width: `${progress.fraction * 100}%` }} />
              </span>
              <span className="row-sub">
                {progress.current === null
                  ? goal.kind === "bodyweight"
                    ? t("goals.addBodyweight")
                    : t("goals.noSets")
                  : t("goals.now", { value: kg(progress.current) })}
                {" · "}
                {t(
                  progress.unit === "kg e1RM"
                    ? "goals.targetE1rm"
                    : "goals.target",
                  { value: kg(progress.target) },
                )}
              </span>
              <span className="row-sub">
                {progress.met && progress.reachedOn
                  ? t("goals.reachedOn", {
                      date: localizedDate(progress.reachedOn),
                    })
                  : progress.daysLeft >= 0
                    ? t("goals.left", {
                        days: countLabel(progress.daysLeft, "day"),
                      })
                    : t("goals.past", {
                        days: countLabel(-progress.daysLeft, "day"),
                      })}
              </span>
            </button>
          ))}
        </div>
      )}
      {!cards.length && <p className="row-sub">{t("goals.empty")}</p>}
      {current && (
        <GoalEditor
          key={session}
          open={editing !== null}
          goal={current === "new" ? null : current}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
