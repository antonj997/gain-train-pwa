import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import PlanEditor, { PLANS_SCOPE } from "@/components/plan/PlanEditor";
import PlanPanel from "@/components/plan/PlanPanel";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import MotionList from "@/components/motion/MotionList";
import ListRow from "@/components/ui/ListRow";
import type { PanelRequest } from "@/components/library/ExercisesPanel";
import { useWithUndo } from "@/hooks/useMessages";
import { today as todayDate } from "@/data/model";
import { activePlans } from "@/data/plans";
import { doneDatesOf } from "@/data/plan-status";
import { planRowStatus, weeksFulfilledOf } from "@/lib/plan-rows";
import { planStatusPath } from "@/lib/routes";
import { useT } from "@/i18n/useT";

/**
 * Library → Scheman (v6 §E2): each plan as a row (its name, a status line
 * and a status word, "Aktivt" in the accent), opening its status page; the
 * dashed "Nytt schema" with a note on what a plan is; and the groups under
 * Advanced. The header's + also makes a plan. Plans are not shared.
 */
export default function PlansTab({
  request = null,
}: {
  request?: PanelRequest;
}) {
  const { state } = useData();
  const { t } = useT();
  const today = todayDate();
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const doneDates = useMemo(() => doneDatesOf(state.records), [state.records]);
  // A deleted plan's row keeps an Undo for a few seconds.
  const slots = useWithUndo(PLANS_SCOPE, plans);
  const [open, setOpen] = useState(false);
  // A new key each time, so a reopened editor starts afresh.
  const [session, setSession] = useState(0);
  const create = () => {
    setSession((n) => n + 1);
    setOpen(true);
  };

  // Library's header: + makes a plan.
  const handled = useRef(request?.n ?? 0);
  useEffect(() => {
    if (!request || request.n === handled.current) return;
    handled.current = request.n;
    if (request.kind !== "new") return;
    setSession((n) => n + 1);
    setOpen(true);
  }, [request]);

  return (
    <div className="plan-panel plans-tab">
      <section aria-labelledby="plans-heading">
        {/* The tab already says Scheman; the heading is for screen readers. */}
        <h2 className="sr-only" id="plans-heading">
          {t("plan.plans")}
        </h2>
        {slots.length > 0 && (
          <MotionList className="list plans-list">
            {slots.map((slot) => {
              if (slot.kind === "undo")
                return (
                  <UndoPlaceholder
                    key={`u${slot.entry.id}`}
                    entry={slot.entry}
                    className="in-list"
                  />
                );
              const p = slot.item;
              const status = planRowStatus(
                p,
                today,
                p.endDate < today
                  ? weeksFulfilledOf(p, doneDates, today)
                  : null,
              );
              return (
                <ListRow
                  key={p.id}
                  className="plans-row"
                  to={planStatusPath(p.id)}
                  title={p.name}
                  sub={
                    <>
                      <span className="plans-row-line">{status.line}</span>
                      <span
                        className={
                          "plans-row-word" +
                          (status.kind === "active" ? " is-active" : "")
                        }
                      >
                        {status.word}
                      </span>
                    </>
                  }
                  chevron
                />
              );
            })}
          </MotionList>
        )}
        <button type="button" className="btn-dashed" onClick={create}>
          <Plus size={20} aria-hidden="true" />
          {t("plan.new")}
        </button>
        <p className="plans-note">{t("library.plansNote")}</p>
      </section>
      <PlanPanel />
      {session > 0 && (
        <PlanEditor
          key={session}
          open={open}
          plan={null}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
