import { useMemo, useRef, useState } from "react";
import { ListPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import ExercisePicker from "@/components/ExercisePicker";
import ProgressionSheet from "@/components/plan/ProgressionSheet";
import { kgText } from "@/lib/plan-note";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { useData } from "@/contexts/useData";
import {
  type Exercise,
  type Plan,
  type ProgressionItem,
  today as todayDate,
} from "@/data/model";
import {
  deloadWeeks,
  phaseWeeks,
  progressionWeeks,
  weekKindsOf,
} from "@/data/phase";
import {
  exerciseInfo,
  newProgressionItem,
  progressable,
} from "@/data/progression";
import { routines as routineRecords } from "@/data/selectors";
import { countLabel } from "@/lib/labels";
import { t } from "@/i18n";

/**
 * Progression: lifts to raise over the phase. Lifts are added one at a time
 * or all of a routine's at once; the table shows each one's planned working
 * weight week by week, and a row opens its details.
 */
export default function PlanProgression({
  plan,
  onChange,
  goalFor,
  onGoalFor,
  goalTitleOf,
}: {
  plan: Plan;
  onChange: (update: (plan: Plan) => Plan) => void;
  /** Exercise ids with "Also add as a goal" on. */
  goalFor: ReadonlySet<string>;
  onGoalFor: (exerciseId: string, on: boolean) => void;
  /** The title of the live goal with this id, or null when it is gone. */
  goalTitleOf: (goalId: string | undefined) => string | null;
}) {
  const { state } = useData();
  const today = todayDate();
  const items = plan.progression ?? [];
  const weeks = phaseWeeks(plan);
  const deloads = deloadWeeks(plan);
  const phase = {
    weeks,
    deloadWeeks: deloads,
    cycle: weekKindsOf(plan).map((k) => k === "deload"),
  };
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const [picking, setPicking] = useState(false);
  const [choosingRoutine, setChoosingRoutine] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // The sheet keeps its row while it slides out.
  const shownId = useRef<string | null>(null);
  if (openId) shownId.current = openId;
  const shown = items.find((i) => i.exerciseId === shownId.current) ?? null;

  const setItems = (next: (items: ProgressionItem[]) => ProgressionItem[]) =>
    onChange((p) => {
      const list = next(p.progression ?? []);
      const copy: Plan = { ...p, progression: list };
      if (!list.length) delete copy.progression;
      return copy;
    });
  const add = (
    exercises: { id: string; name: string; routineExercise?: Exercise }[],
  ) => {
    const have = new Set(items.map((i) => i.exerciseId));
    const fresh = exercises
      .filter((e) => !have.has(e.id))
      .map((e) =>
        newProgressionItem(state.records, e, phase, today, e.routineExercise),
      );
    if (fresh.length) setItems((list) => [...list, ...fresh]);
    return fresh;
  };

  const weekNumbers = Array.from({ length: weeks }, (_, i) => i + 1);

  return (
    <section className="plan-field" aria-labelledby="progression-heading">
      <h3 className="group-title" id="progression-heading">
        {t("prog.heading")}
      </h3>
      <p className="row-sub">{t("prog.intro")}</p>
      {items.length > 0 && (
        <div
          className="prog-table-wrap"
          role="region"
          aria-label={t("prog.tableLabel")}
          tabIndex={0}
        >
          <table className="prog-table">
            <thead>
              <tr>
                <th scope="col">{t("prog.lift")}</th>
                {weekNumbers.map((w) => (
                  <th
                    key={w}
                    scope="col"
                    className={deloads.includes(w) ? "is-deload" : undefined}
                    title={
                      deloads.includes(w) ? t("plan.deloadWeek") : undefined
                    }
                  >
                    {t("prog.weekShort", { n: w })}
                    {deloads.includes(w) && (
                      <span className="prog-d">{t("prog.deloadShort")}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const missing = !(item.startKg > 0) || !(item.targetKg > 0);
                const cells = missing
                  ? []
                  : progressionWeeks(
                      plan,
                      item,
                      exerciseInfo(state.records, item.exerciseId).equipment,
                    );
                return (
                  <tr key={item.exerciseId}>
                    <th scope="row">
                      <button
                        type="button"
                        className="prog-lift"
                        onClick={() => setOpenId(item.exerciseId)}
                      >
                        <span className="prog-lift-name">{item.name}</span>
                        <span className="row-sub">
                          {missing
                            ? t("prog.enterStart")
                            : `${kgText(item.startKg)} → ${kgText(item.targetKg)} kg × ${item.reps}`}
                        </span>
                      </button>
                    </th>
                    {missing ? (
                      <td colSpan={weeks} className="prog-missing">
                        —
                      </td>
                    ) : (
                      cells.map((c) => (
                        <td
                          key={c.week}
                          className={
                            (c.deload ? "is-deload" : "") +
                            (c.edited ? " is-edited" : "")
                          }
                        >
                          <button
                            type="button"
                            className="prog-cell"
                            aria-label={t("prog.cellLabel", {
                              name: item.name,
                              n: c.week,
                              kg: kgText(c.kg),
                            })}
                            onClick={() => setOpenId(item.exerciseId)}
                          >
                            {kgText(c.kg)}
                          </button>
                        </td>
                      ))
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {items.length > 0 && (
        <p className="row-sub group-note">
          {t("prog.tableNote", {
            lifts: countLabel(items.length, "progression"),
          })}
        </p>
      )}
      <div className="prog-add">
        <button
          type="button"
          className="btn-dashed"
          onClick={() => setPicking(true)}
        >
          <Plus size={20} aria-hidden="true" />
          {t("prog.addExercise")}
        </button>
        {routines.length > 0 && (
          <button
            type="button"
            className="btn-dashed"
            onClick={() => setChoosingRoutine(true)}
          >
            <ListPlus size={20} aria-hidden="true" />
            {t("prog.addRoutine")}
          </button>
        )}
      </div>
      <ExercisePicker
        single
        open={picking}
        onClose={() => setPicking(false)}
        onAdd={([item]) => {
          if (!item) return;
          const existing = items.find((i) => i.exerciseId === item.id);
          add([{ id: item.id, name: item.name }]);
          setOpenId(existing?.exerciseId ?? item.id);
        }}
      />
      <Sheet
        open={choosingRoutine}
        onClose={() => setChoosingRoutine(false)}
        title={t("prog.addRoutine")}
        description={t("prog.addRoutineNote")}
      >
        <div className="list">
          {routines.map((r) => (
            <ListRow
              key={r.id}
              title={r.payload.name}
              sub={r.payload.exercises.map((e) => e.name).join(" · ")}
              onClick={() => {
                const fresh = add(
                  r.payload.exercises.filter(progressable).map((e) => ({
                    id: e.exerciseId,
                    name: e.name,
                    routineExercise: e,
                  })),
                );
                setChoosingRoutine(false);
                toast(
                  fresh.length
                    ? t("prog.addedFromRoutine", {
                        lifts: countLabel(fresh.length, "progression"),
                        name: r.payload.name,
                      })
                    : t("prog.nothingToAdd", { name: r.payload.name }),
                );
              }}
            />
          ))}
        </div>
      </Sheet>
      {shown && (
        <ProgressionSheet
          key={shown.exerciseId}
          open={openId !== null}
          plan={plan}
          item={shown}
          addGoal={goalFor.has(shown.exerciseId)}
          linkedGoal={goalTitleOf(shown.goalId)}
          onChange={(next) =>
            setItems((list) =>
              list.map((i) => (i.exerciseId === next.exerciseId ? next : i)),
            )
          }
          onAddGoal={(on) => onGoalFor(shown.exerciseId, on)}
          onRemove={() => {
            const id = shown.exerciseId;
            setOpenId(null);
            onGoalFor(id, false);
            setItems((list) => list.filter((i) => i.exerciseId !== id));
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
