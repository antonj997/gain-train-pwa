import PlanCalendar, { type PlanDay } from "@/components/PlanCalendar";
import type { Plan } from "@/data/model";
import { plannedFor, resolveCell } from "@/data/plans";

type Names = Parameters<typeof resolveCell>[1];

/** The plan's days from today on, each marked; tapping one changes just that date. */
export default function PlanUpcoming({
  plan,
  names,
  today,
  onPick,
}: {
  plan: Plan;
  names: Names;
  today: string;
  onPick: (date: string) => void;
}) {
  const first = plan.startDate > today ? plan.startDate : today;
  if (first > plan.endDate) return null;
  const describe = (date: string): PlanDay => {
    const planned = plannedFor([plan], date);
    const day = resolveCell(planned?.cell, names);
    return {
      kind: day ? (day.kind === "rest" ? "rest" : "planned") : null,
      label: day ? day.title : "nothing planned",
      override: !!planned?.override,
    };
  };
  return (
    <section aria-labelledby="upcoming-heading">
      <h3 className="group-title" id="upcoming-heading">
        Upcoming
      </h3>
      <PlanCalendar
        today={today}
        first={first}
        last={plan.endDate}
        describe={describe}
        onPick={onPick}
      />
      <p className="row-sub group-note">
        Tap a day to change just that date. Past days cannot be changed.
      </p>
    </section>
  );
}
