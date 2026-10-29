import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import GroupEditor from "@/components/plan/GroupEditor";
import PlanEditor from "@/components/plan/PlanEditor";
import ListRow from "@/components/ui/ListRow";
import { libraryOf } from "@/data/exercises";
import { type RoutineGroup, today as todayDate } from "@/data/model";
import { type PlanItem, activePlans, dayTypes, groupsOf } from "@/data/plans";
import { routines as routineRecords } from "@/data/selectors";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";

/** Which editor is open: a plan or a group, an existing one or "new". */
type Editing =
  | { kind: "plan"; plan: PlanItem | null }
  | { kind: "group"; group: RoutineGroup | null }
  | null;

const short = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/** Library → Plan: plans, groups and what day types suggest. Everything here is optional. */
export default function PlanPanel() {
  const { state, saveLibrary } = useData();
  const { account } = useAuth();
  const today = todayDate();
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const groups = useMemo(() => groupsOf(state.records), [state.records]);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const [editing, setEditing] = useState<Editing>(null);
  // A new key each time, so a reopened editor starts from the saved record.
  const [session, setSession] = useState(0);
  const edit = (next: Editing) => {
    setSession((n) => n + 1);
    setEditing(next);
  };
  // The editor keeps its content while the sheet slides out.
  const shown = useRef(editing);
  if (editing) shown.current = editing;
  const current = shown.current;

  const saveGroups = (next: RoutineGroup[]) =>
    saveLibrary({ ...libraryOf(state.records, account), groups: next });

  const status = (p: PlanItem) =>
    p.endDate < today
      ? "Ended"
      : p.startDate > today
        ? `Starts ${short(p.startDate)}`
        : "Active";

  return (
    <div className="plan-panel">
      <p className="row-sub">
        Plan your training if you like: pick what each day holds and Train shows
        it. Nothing changes anywhere while you have no plan.
      </p>
      <section aria-labelledby="plans-heading">
        <h2 className="group-title" id="plans-heading">
          Plans
        </h2>
        {plans.length > 0 && (
          <div className="list">
            {plans.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                sub={`${short(p.startDate)} – ${short(p.endDate)} · ${
                  p.cycleWeeks === 1
                    ? "repeats weekly"
                    : `${p.cycleWeeks}-week cycle`
                }`}
                value={status(p)}
                chevron
                onClick={() => edit({ kind: "plan", plan: p })}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn-dashed"
          onClick={() => edit({ kind: "plan", plan: null })}
        >
          <Plus size={20} aria-hidden="true" />
          New plan
        </button>
      </section>
      <section aria-labelledby="groups-heading">
        <h2 className="group-title" id="groups-heading">
          Groups
        </h2>
        {groups.length > 0 && (
          <div className="list">
            {groups.map((g) => (
              <ListRow
                key={g.id}
                title={g.name}
                sub={[
                  countLabel(g.routineIds.length, "routine"),
                  g.categories.join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                chevron
                onClick={() => edit({ kind: "group", group: g })}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn-dashed"
          onClick={() => edit({ kind: "group", group: null })}
        >
          <Plus size={20} aria-hidden="true" />
          New group
        </button>
        <p className="row-sub group-note">
          A group such as Legday holds the routines you want for that day. You
          can plan it, or one of the day types{" "}
          {dayTypes.map((t) => t.label).join(", ")}, which suggest exercises by
          category.
        </p>
      </section>
      {current?.kind === "plan" && (
        <PlanEditor
          key={session}
          open={editing !== null}
          plan={current.plan}
          onClose={() => setEditing(null)}
        />
      )}
      {current?.kind === "group" && (
        <GroupEditor
          key={session}
          open={editing !== null}
          group={current.group}
          routines={routines}
          onSave={(group) =>
            saveGroups(
              groups.some((g) => g.id === group.id)
                ? groups.map((g) => (g.id === group.id ? group : g))
                : [...groups, group],
            )
          }
          onDelete={(id) => saveGroups(groups.filter((g) => g.id !== id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
