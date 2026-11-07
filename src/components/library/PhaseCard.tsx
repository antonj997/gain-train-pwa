import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/useData";
import { today as todayDate } from "@/data/model";
import { activePlans, plannedFor } from "@/data/plans";
import { phaseSegments, phaseWeek } from "@/data/phase";
import PhaseBar from "@/components/items/PhaseBar";
import { localizedDate } from "@/lib/dates";
import { useT } from "@/i18n/useT";

/**
 * The top of Library → Routines: the plan running today ("Strength phase ·
 * week 3 of 12" over its phase bar), else the next one to start, else a
 * paused one covering today; with none, "Plan a phase". It opens the Plan
 * subscreen.
 */
export default function PhaseCard() {
  const { state } = useData();
  const { t } = useT();
  const today = todayDate();
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const running = plannedFor(plans, today)?.plan;
  const next = plans.find((p) => !p.paused && p.startDate > today);
  const paused = plans.find(
    (p) => p.paused && p.startDate <= today && today <= p.endDate,
  );
  const plan = running ?? next ?? paused ?? null;
  let line: string;
  if (running) {
    const at = phaseWeek(running, today)!;
    line = `${running.name} · ${t("plan.weekOf", { week: at.week, weeks: at.weeks }).toLocaleLowerCase()}`;
  } else if (next)
    line = t("library.phaseStarts", {
      name: next.name,
      date: localizedDate(next.startDate, { day: "numeric", month: "short" }),
    });
  else if (paused) line = t("library.phasePaused", { name: paused.name });
  else line = t("library.phaseNone");
  return (
    <Link
      to="/library/plan"
      className="card phase-card"
      aria-label={t("library.phaseOpen", { text: line })}
    >
      {!plan && (
        <span className="phase-card-icon" aria-hidden="true">
          <CalendarPlus size={22} />
        </span>
      )}
      <span className="phase-card-text">
        <span className="phase-card-eyebrow">{t("library.plan")}</span>
        <strong className="phase-card-title">{line}</strong>
        {plan ? (
          <PhaseBar segments={phaseSegments(plan, today)} />
        ) : (
          <span className="row-sub">{t("library.phaseNoneText")}</span>
        )}
      </span>
      <ChevronRight className="chev" size={20} aria-hidden="true" />
    </Link>
  );
}
