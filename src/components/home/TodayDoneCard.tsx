import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import type { Plan, WorkoutRecord } from "@/data/model";
import {
  activePlans,
  currentPlan,
  plannedFor,
  type PlanItem,
} from "@/data/plans";
import { restoreDay, snapshotDay } from "@/data/plan-moves";
import {
  doneDatesOf,
  pausedCountUntil,
  planAdherence,
  type IsWorkout,
} from "@/data/plan-status";
import { phaseWeek } from "@/data/phase";
import { doneSetCount } from "@/data/selectors";
import {
  weekProgress,
  type TodayStatus,
  type UpcomingDay,
} from "@/data/today-status";
import { usePlanDaySheet } from "@/hooks/usePlanDaySheet";
import Sheet from "@/components/ui/Sheet";
import { WEEK_SCOPE } from "@/components/home/WeekCard";
import { countLabel, durationLabel } from "@/lib/labels";
import { localizedDate, shiftDate } from "@/lib/dates";
import { notify } from "@/lib/message-store";
import { EASE, MOTION, SPRING, play, playSpring } from "@/lib/motion";
import { PLANS_PATH, historyPath, planStatusPath } from "@/lib/routes";
import { workoutTitle } from "@/lib/workout-name";
import { useT } from "@/i18n/useT";

type Done = Exclude<TodayStatus<WorkoutRecord>, { kind: "open" }>;

type Props = {
  status: Done;
  /** The plan running today, with a "planDone" status. */
  plan: PlanItem | null;
  isWorkout: IsWorkout;
  /** The coming planned workout days, the first being the next one. */
  upcoming: readonly UpcomingDay[];
  day: string;
  starting: boolean;
  /** "Log workout": a new one, asking today's or an earlier one first. */
  onLog: () => void;
};

/** A workout finished this recently plays the done card's entrance once. */
const FRESH_MS = 2 * 60_000;
const played = new Set<string>();

const planOf = ({ id: _id, ...plan }: PlanItem): Plan => plan;

/**
 * Train's Today card once a workout is finished today: a calm card with a
 * done-green check, "Done for today" and the newest workout's name and
 * length, in place of the suggestion and its big Start. Without a running
 * plan the card opens the workout in Calendar; inside one it reads the plan
 * week, this week's planned workouts done and the next one, and opens the
 * plan's status page. When today's workout was not the plan's (another
 * workout, a rest day, nothing planned) it says so and offers to move the
 * planned workout with the day sheet, or to count today's workout as a
 * matching day ahead (src/data/today-status.ts). "Log workout" starts a new
 * one, which asks first whether it is another today or an earlier one.
 */
export default function TodayDoneCard({
  status,
  plan,
  isWorkout,
  upcoming,
  day,
  starting,
  onLog,
}: Props) {
  const { t } = useT();
  const { state, save } = useData();
  // Set while "count as" moves a day, which says so itself.
  const counting = useRef(false);
  const days = usePlanDaySheet({
    day,
    // A skip from this sheet leaves its Undo under the week strip, as one
    // from the strip's own sheet does.
    undoScope: WEEK_SCOPE,
    onMoved: ({ text }) => {
      if (!counting.current) notify(text, { key: "today-move" });
    },
  });

  const [latest] = status.workouts;
  const w = latest.payload;
  const title = workoutTitle(w.name);
  const meta = [
    w.duration !== null && w.duration > 0 ? durationLabel(w.duration) : null,
    countLabel(doneSetCount(w), "set"),
  ]
    .filter(Boolean)
    .join(" · ");
  const count = status.workouts.length;

  const planDone = status.kind === "planDone" && plan ? status : null;
  const phase = planDone && plan ? phaseWeek(plan, day) : null;
  const doneDates = useMemo(() => doneDatesOf(state.records), [state.records]);
  const progress = useMemo(() => {
    if (!planDone || !plan || !phase) return null;
    const adherence = planAdherence(plan, doneDates, day, {
      isWorkout,
      countUntil: pausedCountUntil(plan, doneDates, day),
    });
    return weekProgress(adherence, phase.week);
  }, [planDone, plan, phase, doneDates, day, isWorkout]);
  const next = planDone ? upcoming[0] : undefined;
  const when = (date: string) =>
    date === shiftDate(day, 1)
      ? t("planStatus.tomorrow")
      : localizedDate(date, {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

  const label = [
    t("todayDone.title"),
    phase && t("plan.weekOf", { week: phase.week, weeks: phase.weeks }),
    phase?.deload && t("plan.deload"),
  ]
    .filter(Boolean)
    .join(" · ");
  const to =
    planDone && plan ? planStatusPath(plan.id) : historyPath(latest.id);
  const linkLabel =
    planDone && plan
      ? t("todayDone.openPlan", { label, title, name: plan.name })
      : t("todayDone.openWorkout", { label, title });

  // Off plan: what was planned, and what can be done about it.
  const off = planDone && planDone.fit !== "match" ? planDone : null;
  const offText = !off
    ? null
    : off.fit === "other" && off.planned
      ? t("todayDone.plannedWas", { name: off.planned.title })
      : off.fit === "rest"
        ? t("todayDone.restDay")
        : t("todayDone.unplanned");
  const moveName = off?.moveDate
    ? off.moveDate === day
      ? off.planned?.title
      : upcoming.find((u) => u.date === off.moveDate)?.day.title
    : undefined;
  const countAs = off?.countAs ?? null;

  // Count today's workout as a planned day ahead: that day's workout moves to
  // today, and today's planned workout, if any, to its date. Undo puts both
  // days back as they were.
  const countAsDay = (target: UpcomingDay) => {
    const found = plannedFor(days.livePlans(), day);
    if (!found) return;
    const id = found.plan.id;
    const before = [
      snapshotDay(planOf(found.plan), target.date),
      snapshotDay(planOf(found.plan), day),
    ];
    counting.current = true;
    const moved = days.move(target.date, day);
    counting.current = false;
    if (!moved) return;
    notify(t("todayDone.counted", { name: target.day.title }), {
      key: "today-move",
      undo: {
        run: () => {
          const current = days.livePlans().find((p) => p.id === id);
          if (!current) return Promise.resolve();
          return save(id, "plan", before.reduce(restoreDay, planOf(current)));
        },
        failed: t("todayDone.undoFailed"),
      },
    });
  };

  // Coming back to Train right after finishing: the card rises in and the
  // check pops, once per workout. Reduced motion makes both a short fade.
  const card = useRef<HTMLElement>(null);
  const check = useRef<HTMLSpanElement>(null);
  const finished = w.completedAt ?? 0;
  useLayoutEffect(() => {
    if (played.has(latest.id)) return;
    played.add(latest.id);
    const age = Date.now() - finished;
    if (!finished || age < 0 || age > FRESH_MS) return;
    play(
      card.current,
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: MOTION.rise, easing: EASE.out },
    );
    playSpring(check.current, SPRING.check, 0.5, 1, (v) => ({
      transform: `scale(${v})`,
    }));
  }, [latest.id, finished]);

  return (
    <section
      ref={card}
      className="card today-done"
      aria-labelledby="today-heading"
    >
      <div className="today-done-main">
        <span ref={check} className="today-done-check" aria-hidden="true">
          <Check size={22} strokeWidth={3} />
        </span>
        <span className="today-done-text">
          <span className="today-done-head">
            <h2 id="today-heading" className="today-done-label">
              <Link className="today-done-link" to={to} aria-label={linkLabel}>
                {label}
              </Link>
            </h2>
            {count >= 2 && (
              <span className="stat-chip done">
                {t("todayDone.count", { count })}
              </span>
            )}
          </span>
          <strong className="today-done-title">{title}</strong>
          <span className="row-sub">{meta}</span>
          {/* Inside a plan: this week's planned workouts done, and the next. */}
          {(progress || next) && (
            <span className="today-done-plan">
              {progress && (
                <span
                  className={
                    "today-done-week" +
                    (progress.done >= progress.planned ? " is-met" : "")
                  }
                >
                  {t("todayDone.week", {
                    done: progress.done,
                    count: progress.planned,
                  })}
                </span>
              )}
              {progress && next && " · "}
              {next &&
                t("todayDone.next", {
                  name: next.day.title,
                  when: when(next.date),
                })}
            </span>
          )}
        </span>
        <ChevronRight className="chev" size={20} aria-hidden="true" />
      </div>
      {off && offText && (
        <div className="today-done-off">
          <p className="status-note">{offText}</p>
          {(moveName || countAs) && (
            <div className="today-done-actions">
              {off.moveDate && moveName && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  aria-haspopup="dialog"
                  onClick={() => days.open(off.moveDate!)}
                >
                  {t("todayDone.move", { name: moveName })}
                </button>
              )}
              {countAs && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => countAsDay(countAs)}
                >
                  {t("todayDone.countAs", { name: countAs.day.title })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="today-done-foot">
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={starting}
          onClick={onLog}
        >
          <Plus size={18} aria-hidden="true" />
          {starting ? t("home.starting") : t("todayDone.log")}
        </button>
      </div>
      {days.sheetNode}
    </section>
  );
}
