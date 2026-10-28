import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { routines as routineRecords } from "@/data/selectors";
import { today as todayDate } from "@/data/model";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import PlanCalendar, { type PlanDay } from "@/components/PlanCalendar";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { localizedDate } from "@/lib/dates";
import {
  REST,
  emptyPlan,
  hasPlan,
  plannedFor,
  planHorizon,
  readPlan,
  savePlan,
  weeklyFor,
  type PlanEntry,
  type TrainingPlan,
} from "@/lib/plan";

/** The day a sheet is changing: a weekday of the weekly plan, or one date. */
type Target = { weekday: number } | { date: string };

const weekdays = Array.from({ length: 7 }, (_, i) =>
  new Date(Date.UTC(2024, 0, i + 1)).toLocaleDateString(undefined, {
    weekday: "long",
    timeZone: "UTC",
  }),
);

/** Library → Training plan: a weekly template and dated changes, stored on this device. */
export default function Plan() {
  const { state } = useData();
  const { account } = useAuth();
  const [plan, setPlan] = useState<TrainingPlan>(
    () => readPlan(account) ?? emptyPlan(),
  );
  const [target, setTarget] = useState<Target | null>(null);
  const [clearing, setClearing] = useState(false);
  const today = todayDate();
  const last = planHorizon(today);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const names = useMemo(
    () => new Map(routines.map((r) => [r.id, r.payload.name])),
    [routines],
  );

  const commit = (next: TrainingPlan) => {
    setPlan(next);
    if (!savePlan(account, next, today))
      toast.error("Could not save the plan on this phone.");
  };
  const entryLabel = (entry: PlanEntry | null) =>
    entry === null
      ? "Not planned"
      : entry === REST
        ? "Rest"
        : (names.get(entry) ?? "Deleted routine");
  const choose = (entry: PlanEntry | null) => {
    if (!target) return;
    if ("weekday" in target) {
      const weekly = [...plan.weekly];
      weekly[target.weekday] = entry;
      commit({ ...plan, weekly });
    } else {
      const dated = { ...plan.dated };
      if (entry === null) delete dated[target.date];
      else dated[target.date] = entry;
      commit({ ...plan, dated });
    }
    setTarget(null);
  };

  const describe = (date: string): PlanDay => {
    const entry = plannedFor(plan, date);
    const kind =
      entry === REST ? "rest" : entry && names.has(entry) ? "routine" : null;
    return {
      kind,
      label:
        entry === null
          ? "nothing planned"
          : entry === REST
            ? "rest day"
            : (names.get(entry) ?? "deleted routine"),
      override: date in plan.dated,
    };
  };

  const selected =
    target === null
      ? undefined
      : "weekday" in target
        ? plan.weekly[target.weekday]
        : (plan.dated[target.date] ?? null);
  const sheetTitle =
    target === null
      ? ""
      : "weekday" in target
        ? weekdays[target.weekday]
        : localizedDate(target.date, {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
  const option = (
    entry: PlanEntry | null,
    title: string,
    sub?: string,
    key = entry ?? "none",
  ) => (
    <ListRow
      key={key}
      title={title}
      sub={sub}
      onClick={() => choose(entry)}
      trailing={
        selected === entry ? (
          <Check size={20} className="plan-check" aria-label="Selected" />
        ) : undefined
      }
    />
  );

  return (
    <div className="page plan-page">
      <PageHeader
        eyebrow="Optional"
        title="Training plan"
        leading={
          <Link to="/library" className="icon-btn" aria-label="Back to Library">
            <ChevronLeft size={22} aria-hidden="true" />
          </Link>
        }
      />
      <p className="row-sub">
        Choose what you usually train each day and Train shows what is up next.
        Nothing changes anywhere while the plan is empty.
      </p>
      {!routines.length && (
        <div className="card col-12">
          <h3 className="card-title">Plan with routines</h3>
          <p className="row-sub">
            Create a routine first. Until then you can still mark rest days.
          </p>
          <Link className="btn-secondary" to="/library">
            Open Library
          </Link>
        </div>
      )}
      <section aria-labelledby="weekly-heading">
        <h2 className="group-title" id="weekly-heading">
          Every week
        </h2>
        <div className="list">
          {weekdays.map((name, weekday) => (
            <ListRow
              key={name}
              title={name}
              value={entryLabel(plan.weekly[weekday])}
              chevron
              onClick={() => setTarget({ weekday })}
            />
          ))}
        </div>
      </section>
      <section aria-labelledby="upcoming-heading">
        <h2 className="group-title" id="upcoming-heading">
          Upcoming
        </h2>
        <PlanCalendar
          today={today}
          last={last}
          describe={describe}
          onPick={(date) => setTarget({ date })}
        />
        <p className="row-sub group-note">
          Tap a day to change just that date, up to{" "}
          {localizedDate(last, { day: "numeric", month: "long" })}. Past days
          cannot be changed.
        </p>
      </section>
      {hasPlan(plan) && (
        <button
          type="button"
          className="btn-danger btn-block"
          onClick={() => setClearing(true)}
        >
          Clear plan
        </button>
      )}
      <Sheet
        open={target !== null}
        onClose={() => setTarget(null)}
        title={sheetTitle}
      >
        <div className="list">
          {routines.map((r) => option(r.id, r.payload.name))}
          {option(REST, "Rest")}
          {target !== null && "date" in target
            ? option(
                null,
                "Use weekly plan",
                entryLabel(weeklyFor(plan, target.date)),
              )
            : option(null, "Not planned")}
        </div>
      </Sheet>
      <ConfirmDialog
        open={clearing}
        title="Clear the whole plan?"
        description="This removes the weekly plan and every dated change from this phone. Your routines and workouts stay."
        cancelLabel="Keep plan"
        confirmLabel="Clear plan"
        tone="danger"
        onCancel={() => setClearing(false)}
        onConfirm={() => {
          setClearing(false);
          setPlan(emptyPlan());
          savePlan(account, null, today);
          toast("Plan cleared");
        }}
      />
    </div>
  );
}
