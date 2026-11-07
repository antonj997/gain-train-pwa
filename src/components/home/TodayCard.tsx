import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Dumbbell,
  History,
  Layers,
  MoreHorizontal,
  Play,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useData } from "@/contexts/useData";
import type { RoutineRecord } from "@/data/model";
import type { TodayPick } from "@/data/today";
import Sheet from "@/components/ui/Sheet";
import ListRow from "@/components/ui/ListRow";
import { categoryLabel } from "@/lib/catalogue-labels";
import { lastUsedLabel } from "@/lib/library";
import { routineAverageMinutes, routineMeta } from "@/lib/routine-preview";
import { useT } from "@/i18n/useT";

type Props = {
  pick: TodayPick;
  /** Where today sits in the active plan's phase, if it does. */
  phase: { week: number; weeks: number; deload: boolean } | null;
  /** The user's routines in saved order. */
  routines: RoutineRecord[];
  lastDone: ReadonlyMap<string, string>;
  day: string;
  starting: boolean;
  onStartRoutine: (routine: RoutineRecord) => void;
  /** An empty workout with the picker on these categories. */
  onStartSuggestions: (categories: string[], title: string) => void;
  onStartEmpty: () => void;
  onLogPast: () => void;
};

/**
 * Train's "Today" card: the plan's routine, day type or group for today, or
 * a suggestion when nothing is planned (see `todayPick`). One big Start, and
 * ⋯ with Change workout, View plan and Log a past workout.
 */
export default function TodayCard({
  pick,
  phase,
  routines,
  lastDone,
  day,
  starting,
  onStartRoutine,
  onStartSuggestions,
  onStartEmpty,
  onLogPast,
}: Props) {
  const { state } = useData();
  const { t } = useT();
  const [sheet, setSheet] = useState<"menu" | "switch" | null>(null);
  const close = () => setSheet(null);
  const routineById = (id: string | null) =>
    id ? (routines.find((r) => r.id === id) ?? null) : null;
  const meta = (routine: RoutineRecord) => {
    const done = lastDone.get(routine.id);
    return [
      routineMeta(
        routine.payload.exercises.length,
        routineAverageMinutes(routine.id, state.records),
      ),
      done && t("routines.lastDone", { when: lastUsedLabel(done, day) }),
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const routine =
    pick.kind === "none" ? null : routineById(pick.routineId ?? null);
  const planned = pick.kind === "planned" ? pick.day : null;
  const categories = planned?.categories ?? [];
  const rest = pick.kind !== "planned" && pick.rest;
  const label = [
    t("home.today"),
    phase && t("plan.weekOf", { week: phase.week, weeks: phase.weeks }),
    phase?.deload && t("plan.deload"),
    rest
      ? t("home.todayRest")
      : pick.kind === "suggested"
        ? t("home.todaySuggested")
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let title: string;
  let sub: string;
  let why: string | null = null;
  if (planned?.kind === "group") {
    title = planned.title;
    sub = routine
      ? t("home.groupNext", { name: routine.payload.name }) +
        " · " +
        meta(routine)
      : t("home.typeText", {
          categories: categories.map(categoryLabel).join(", "),
        });
  } else if (planned?.kind === "type") {
    title = planned.title;
    sub = t("home.typeText", {
      categories: categories.map(categoryLabel).join(", "),
    });
  } else if (routine) {
    title = routine.payload.name;
    sub = meta(routine);
    if (pick.kind === "suggested")
      why =
        pick.reason === "first"
          ? t("home.suggestFirst")
          : rest
            ? t("home.suggestRotationRest")
            : t("home.suggestRotation");
  } else {
    title = t("home.nothingPlanned");
    sub = t("home.nothingPlannedText");
  }

  const start = () => {
    if (routine) onStartRoutine(routine);
    else if (planned && categories.length)
      onStartSuggestions(categories, planned.title);
    else onStartEmpty();
  };
  const Icon = routine ? Layers : planned ? Sparkles : Dumbbell;

  return (
    <section className="today-card" aria-labelledby="today-heading">
      <div className="today-card-head">
        <h2 id="today-heading" className="today-label">
          {label}
        </h2>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("home.todayMenu")}
          aria-haspopup="dialog"
          onClick={() => setSheet("menu")}
        >
          <MoreHorizontal size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="today-main">
        <span className="today-tile" aria-hidden="true">
          <Icon size={26} />
        </span>
        <span className="today-text">
          <strong className="today-title">{title}</strong>
          <span className="row-sub">{sub}</span>
        </span>
      </div>
      {why && <p className="today-why">{why}</p>}
      <button
        type="button"
        className="btn-primary btn-block btn-lg"
        disabled={starting}
        onClick={start}
      >
        <Play size={18} fill="currentColor" stroke="none" aria-hidden="true" />
        {starting ? t("home.starting") : t("home.start")}
      </button>
      {planned?.kind === "group" && routine && categories.length > 0 && (
        <button
          type="button"
          className="btn-quiet"
          disabled={starting}
          onClick={() => onStartSuggestions(categories, planned.title)}
        >
          {t("home.startSuggestions")}
        </button>
      )}
      <Sheet open={sheet === "menu"} onClose={close} title={label}>
        <div className="sheet-menu">
          {routines.length > 0 && (
            <button
              type="button"
              className="sheet-menu-item"
              onClick={() => setSheet("switch")}
            >
              <Shuffle size={20} aria-hidden="true" />
              {t("home.switchWorkout")}
            </button>
          )}
          <Link className="sheet-menu-item" to="/library/plan">
            <CalendarDays size={20} aria-hidden="true" />
            {t("home.showPlan")}
          </Link>
          <button
            type="button"
            className="sheet-menu-item"
            disabled={starting}
            onClick={() => {
              close();
              onLogPast();
            }}
          >
            <History size={20} aria-hidden="true" />
            {t("home.logPast")}
          </button>
        </div>
      </Sheet>
      <Sheet
        open={sheet === "switch"}
        onClose={close}
        title={t("home.switchWorkout")}
        description={t("home.switchText")}
        size={routines.length > 5 ? "full" : undefined}
      >
        <div className="list">
          {routines.map((r) => (
            <ListRow
              key={r.id}
              title={r.payload.name}
              sub={meta(r)}
              trailing={
                <Play
                  className="row-play"
                  size={18}
                  fill="currentColor"
                  stroke="none"
                  aria-hidden="true"
                />
              }
              disabled={starting}
              onClick={() => {
                close();
                onStartRoutine(r);
              }}
            />
          ))}
          {planned && categories.length > 0 && (
            <ListRow
              title={t("home.startSuggestions")}
              sub={t("home.typeText", {
                categories: categories.map(categoryLabel).join(", "),
              })}
              leading={<Sparkles size={20} aria-hidden="true" />}
              disabled={starting}
              onClick={() => {
                close();
                onStartSuggestions(categories, planned.title);
              }}
            />
          )}
        </div>
      </Sheet>
    </section>
  );
}
