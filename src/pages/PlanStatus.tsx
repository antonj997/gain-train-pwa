import { useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import PlanEditor from "@/components/plan/PlanEditor";
import {
  AdherenceCard,
  GoalsCard,
  MuscleCard,
  NextWorkoutCard,
  PhaseCard,
  ProgressionCard,
} from "@/components/plan/PlanStatusCards";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { useGoalEditor } from "@/hooks/useGoalEditor";
import { useGoals } from "@/hooks/useGoals";
import { usePageBack } from "@/hooks/usePageTransitions";
import { today as todayDate } from "@/data/model";
import {
  activePlans,
  groupsOf,
  planDay,
  resolveCell,
  type PlanItem,
} from "@/data/plans";
import {
  doneDatesOf,
  nextPlannedDay,
  otherLifts,
  pausedCountUntil,
  phaseStatus,
  planAdherence,
  planLifts,
  planMuscleSets,
  workoutsPerWeek,
  type PlanLift,
} from "@/data/plan-status";
import { categoriesLookup } from "@/data/muscle-sets";
import { equipmentLookup } from "@/data/progression";
import { completedWorkouts, routines as routineRecords } from "@/data/selectors";
import { newWorkout } from "@/data/start";
import { lastDoneByRoutine, todayPick } from "@/data/today";
import { categoryLabel } from "@/lib/catalogue-labels";
import { localizedDate, shiftDate } from "@/lib/dates";
import { PLANS_PATH } from "@/lib/routes";
import { routineAverageMinutes, routineMeta } from "@/lib/routine-preview";
import { autoWorkoutName } from "@/lib/workout-name";
import { useT } from "@/i18n/useT";

const short = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/**
 * One plan's status page (/library/plan/:id), opened from the phase card on
 * Library → Routines and Train's Today ⋯: where the phase is, how well it is
 * followed, the lifts against the planned progression, the weekly sets per
 * muscle group, the plan's goals and the next workout. Edit (top right and at
 * the bottom) opens the same editor sheet as the plans list, where Pause and
 * Delete stay; the list is one tap further.
 */
export default function PlanStatus() {
  const { id = "" } = useParams();
  const { state } = useData();
  const plan = useMemo(
    () => activePlans(state.records).find((p) => p.id === id) ?? null,
    [state.records, id],
  );
  // A deleted plan (or an unknown id) goes to the list, where its Undo waits.
  if (!plan) return <Navigate to={PLANS_PATH} replace />;
  return <PlanStatusView plan={plan} />;
}

function PlanStatusView({ plan }: { plan: PlanItem }) {
  const { t } = useT();
  const { state } = useData();
  const { bodyWeightKg } = useProfile();
  const back = usePageBack("/library");
  const today = todayDate();
  const tomorrow = shiftDate(today, 1);
  const records = useMemo(() => Object.values(state.records), [state.records]);
  const routines = useMemo(() => routineRecords(state.records), [state.records]);
  const groups = useMemo(() => groupsOf(state.records), [state.records]);
  const isWorkout = useMemo(() => {
    const names = { routines, groups };
    return (cell: string | null | undefined) => {
      const day = resolveCell(cell, names);
      return !!day && day.kind !== "rest";
    };
  }, [routines, groups]);

  // The editor sheet, as on the plans list: a fresh form each time it opens.
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState(0);
  const edit = () => {
    setSession((n) => n + 1);
    setEditing(true);
  };
  const opened = useRef(false);
  if (editing) opened.current = true;

  const phase = phaseStatus(plan, today);
  const started = phase.kind !== "upcoming";
  const doneDates = useMemo(() => doneDatesOf(records), [records]);
  const adherence = useMemo(
    () =>
      planAdherence(plan, doneDates, today, {
        isWorkout,
        countUntil: pausedCountUntil(plan, doneDates, today),
      }),
    [plan, doneDates, today, isWorkout],
  );
  const equipmentOf = useMemo(() => equipmentLookup(records), [records]);
  const lifts = useMemo(
    () => planLifts(plan, records, today, equipmentOf, bodyWeightKg),
    [plan, records, today, equipmentOf, bodyWeightKg],
  );
  const others = useMemo(
    () => otherLifts(plan, records, today, 4, bodyWeightKg),
    [plan, records, today, bodyWeightKg],
  );
  const muscle = useMemo(
    () => planMuscleSets(plan, records, today, categoriesLookup(records)),
    [plan, records, today],
  );
  const goalCards = useGoals(null, today);
  const goals = [...goalCards.open, ...goalCards.reached].filter((c) =>
    plan.goalIds.includes(c.goal.id),
  );
  const goalEditor = useGoalEditor();

  // The next workout, started the way the Today card starts it.
  const { start, busy: starting, confirmation } = useStartWorkout();
  const completed = useMemo(() => completedWorkouts(records), [records]);
  const lastDone = useMemo(() => lastDoneByRoutine(completed), [completed]);
  const nextDate = nextPlannedDay(plan, today, doneDates.has(today), isWorkout);
  const nextDay = nextDate
    ? resolveCell(planDay(plan, nextDate).cell, { routines, groups })
    : null;
  const pick = nextDay
    ? todayPick(
        nextDay,
        routines.map((r) => r.id),
        lastDone,
      )
    : null;
  const nextRoutine =
    pick?.kind === "planned" && pick.routineId
      ? (routines.find((r) => r.id === pick.routineId) ?? null)
      : null;
  const routineSub = (id: string, exercises: number) =>
    routineMeta(exercises, routineAverageMinutes(id, state.records));
  let nextTitle = nextDay?.title ?? "";
  let nextSub = "";
  if (nextDay?.kind === "routine" && nextRoutine) {
    nextTitle = nextRoutine.payload.name;
    nextSub = routineSub(nextRoutine.id, nextRoutine.payload.exercises.length);
  } else if (nextDay?.kind === "group" && nextRoutine)
    nextSub =
      t("home.groupNext", { name: nextRoutine.payload.name }) +
      " · " +
      routineSub(nextRoutine.id, nextRoutine.payload.exercises.length);
  else if (nextDay?.categories.length)
    nextSub = t("home.typeText", {
      categories: nextDay.categories.map(categoryLabel).join(", "),
    });
  const startNext = () => {
    if (nextRoutine)
      void start(newWorkout(records, { routine: nextRoutine }));
    else if (nextDay)
      void start(
        {
          ...newWorkout(records),
          name: autoWorkoutName(
            { name: "", exercises: [] },
            { plan: nextDay.title },
          ),
        },
        nextDay.categories.length ? nextDay.categories : undefined,
      );
  };

  const perWeek = workoutsPerWeek(plan, isWorkout);
  const subline = [
    `${short(plan.startDate)} – ${short(plan.endDate)}`,
    perWeek &&
      (perWeek.min === perWeek.max
        ? t("planStatus.perWeek", { count: perWeek.max })
        : t("planStatus.perWeekRange", { min: perWeek.min, max: perWeek.max })),
  ]
    .filter(Boolean)
    .join(" · ");
  const isBodyweightLift = (lift: PlanLift) => {
    const set = lift.now ?? lift.start;
    if (set) return set.load !== "weight";
    return equipmentOf(lift.exerciseId) === "bodyweight";
  };
  const hasWorkoutDays = adherence.weeks.some((w) => w.days.length > 0);

  return (
    <div className="page library-page plan-status-page">
      {confirmation}
      <PageHeader
        eyebrow={t("library.plan")}
        title={plan.name}
        leading={<BackButton onClick={back} />}
        action={
          <button
            type="button"
            className="btn-secondary btn-sm plan-status-edit"
            aria-label={t("planStatus.editLabel", { name: plan.name })}
            onClick={edit}
          >
            <Pencil size={16} aria-hidden="true" />
            {t("planStatus.edit")}
          </button>
        }
      />
      <p className="row-sub plan-status-sub">{subline}</p>
      <PhaseCard plan={plan} status={phase} today={today} />
      {started && hasWorkoutDays && (
        <AdherenceCard adherence={adherence} paused={!!plan.paused} />
      )}
      {started && lifts.length + others.length > 0 && (
        <ProgressionCard
          lifts={lifts}
          others={others}
          bodyweight={isBodyweightLift}
        />
      )}
      {muscle && <MuscleCard muscle={muscle} />}
      {goals.length > 0 && (
        <GoalsCard goals={goals} today={today} onOpen={goalEditor.edit} />
      )}
      {nextDate && nextDay && (
        <NextWorkoutCard
          date={nextDate}
          today={today}
          tomorrow={tomorrow}
          title={nextTitle}
          sub={nextSub}
          starting={starting}
          onStart={startNext}
        />
      )}
      <div className="plan-status-actions">
        <button
          type="button"
          className="btn-secondary btn-block"
          onClick={edit}
        >
          <Pencil size={18} aria-hidden="true" />
          {t("plan.edit")}
        </button>
        <Link className="btn-quiet btn-block" to={PLANS_PATH}>
          {t("planStatus.allPlans")}
        </Link>
      </div>
      {opened.current && (
        <PlanEditor
          key={session}
          open={editing}
          plan={plan}
          onClose={() => setEditing(false)}
        />
      )}
      {goalEditor.editor}
    </div>
  );
}
