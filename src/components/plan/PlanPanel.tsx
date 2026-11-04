import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import GroupEditor from "@/components/plan/GroupEditor";
import PlanEditor from "@/components/plan/PlanEditor";
import ListRow from "@/components/ui/ListRow";
import { libraryOf } from "@/data/exercises";
import { type RoutineGroup, today as todayDate } from "@/data/model";
import {
  type PlanItem,
  activePlans,
  dayTypeLabel,
  dayTypes,
  findOverlap,
  groupsOf,
  overlapMessage,
  withPaused,
} from "@/data/plans";
import { routines as routineRecords } from "@/data/selectors";
import { phaseWeek, phaseWeeks, weekKindsOf } from "@/data/phase";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { t } from "@/i18n";
import { categoryLabel } from "@/lib/catalogue-labels";

/** Which editor is open: a plan or a group, an existing one or "new". */
type Editing =
  | { kind: "plan"; plan: PlanItem | null }
  | { kind: "group"; group: RoutineGroup | null }
  | null;

const short = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/** Library → Plan: plans, groups and what day types suggest. Everything here is optional. */
export default function PlanPanel() {
  const { state, save, saveLibrary } = useData();
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

  // The phase in a line: dates, "week 3 of 12" (or its length), the cycle and progressions.
  const summary = (p: PlanItem) => {
    const at = !p.paused ? phaseWeek(p, today) : null;
    const deloads = weekKindsOf(p).filter((k) => k === "deload").length;
    return [
      `${short(p.startDate)} – ${short(p.endDate)}`,
      at
        ? t("plan.weekOf", { week: at.week, weeks: at.weeks })
        : countLabel(phaseWeeks(p), "week"),
      p.cycleWeeks === 1
        ? t("plan.repeatsWeekly")
        : deloads
          ? t("plan.cycleDeload", {
              normal: p.cycleWeeks - deloads,
              deload: deloads,
            })
          : t("plan.cycle", { count: p.cycleWeeks }),
      p.progression?.length
        ? countLabel(p.progression.length, "progression")
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const status = (p: PlanItem) =>
    p.paused
      ? t("plan.paused")
      : p.endDate < today
        ? t("plan.ended")
        : p.startDate > today
          ? t("plan.starts", { date: short(p.startDate) })
          : t("plan.active");

  // Pausing frees the plan's dates; resuming is refused while another plan holds them.
  const [pausing, setPausing] = useState<string | null>(null);
  const togglePause = async (p: PlanItem) => {
    if (pausing) return;
    const { id, ...plan } = p;
    const next = withPaused(plan, !p.paused);
    const blocking = p.paused ? findOverlap(plans, next, id) : null;
    if (blocking) {
      toast.error(overlapMessage(blocking));
      return;
    }
    setPausing(id);
    try {
      await save(id, "plan", next);
      toast.success(t(p.paused ? "plan.resumedToast" : "plan.pausedToast"));
    } catch {
      toast.error(t("plan.saveFailed"));
    } finally {
      setPausing(null);
    }
  };

  return (
    <div className="plan-panel">
      <p className="row-sub">{t("plan.intro")}</p>
      <section aria-labelledby="plans-heading">
        <h2 className="group-title" id="plans-heading">
          {t("plan.plans")}
        </h2>
        {plans.length > 0 && (
          <div className="list">
            {plans.map((p) => (
              <div
                key={p.id}
                className={"plan-row" + (p.paused ? " is-paused" : "")}
              >
                <button
                  type="button"
                  className="row plan-row-open"
                  onClick={() => edit({ kind: "plan", plan: p })}
                >
                  <span className="row-main">
                    <span className="row-title">{p.name}</span>
                    <span className="row-sub">{summary(p)}</span>
                  </span>
                  <span className="row-value">{status(p)}</span>
                  <ChevronRight className="chev" size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t(
                    p.paused ? "plan.resumeNamed" : "plan.pauseNamed",
                    {
                      name: p.name,
                    },
                  )}
                  disabled={pausing !== null}
                  onClick={() => void togglePause(p)}
                >
                  {p.paused ? (
                    <Play size={20} aria-hidden="true" />
                  ) : (
                    <Pause size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn-dashed"
          onClick={() => edit({ kind: "plan", plan: null })}
        >
          <Plus size={20} aria-hidden="true" />
          {t("plan.new")}
        </button>
      </section>
      {/* Groups are for one plan day offering a choice of routines; deload
          weeks and progression live in the plan itself, so groups sit here. */}
      <details className="plan-advanced">
        <summary>
          <span className="row-main">
            <span className="row-title">{t("plan.advanced")}</span>
            <span className="row-sub">
              {groups.length
                ? `${t("plan.groups")} · ${groups.length}`
                : t("plan.groups")}
            </span>
          </span>
          <ChevronDown className="chev" size={20} aria-hidden="true" />
        </summary>
      <section aria-labelledby="groups-heading">
        <h2 className="group-title" id="groups-heading">
          {t("plan.groups")}
        </h2>
        <p className="row-sub">{t("plan.groupsExplain")}</p>
        {groups.length > 0 && (
          <div className="list">
            {groups.map((g) => (
              <ListRow
                key={g.id}
                title={g.name}
                sub={[
                  countLabel(g.routineIds.length, "routine"),
                  g.categories.map(categoryLabel).join(", "),
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
          {t("plan.newGroup")}
        </button>
        <p className="row-sub group-note">
          {t("plan.groupNote", {
            types: dayTypes.map(dayTypeLabel).join(", "),
          })}
        </p>
      </section>
      </details>
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
