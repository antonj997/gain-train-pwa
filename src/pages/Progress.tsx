import ExerciseRow from "@/components/items/ExerciseRow";
import RecordPill from "@/components/items/RecordPill";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Target, TrendingUp } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "@/contexts/useData";
import {
  cardioProgressFor,
  exerciseStats,
  progressFor,
  recentBests,
} from "@/data/analytics";
import { prEvents } from "@/data/exercise-records";
import { labelSet, today } from "@/data/model";
import { historyPeriod } from "@/data/summary";
import GoalsPanel from "@/components/goals/GoalsPanel";
import PageHeader from "@/components/PageHeader";
import ProgressSummary from "@/components/ProgressSummary";
import Sparkline from "@/components/Sparkline";
import Segmented from "@/components/ui/Segmented";
import { localizedDate } from "@/lib/dates";
import { prKindsText } from "@/lib/record-labels";
import { exercisePath, historyPath } from "@/lib/routes";
import { countLabel } from "@/lib/labels";
import { totalsLabel } from "@/lib/cardio";
import { useCardioFields } from "@/hooks/useCardioFields";
import { useGoalEditor } from "@/hooks/useGoalEditor";
import { useGoals } from "@/hooks/useGoals";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { useT } from "@/i18n/useT";

const periods = [
  { value: "4w", label: "progress.p4w", before: "progress.before4w" },
  { value: "3m", label: "progress.p3m", before: "progress.before3m" },
  { value: "12m", label: "progress.p12m", before: "progress.before12m" },
] as const;
type Period = (typeof periods)[number]["value"];

type Tab = "stats" | "goals";
const tabs = [
  { value: "stats", label: "goals.tabStats" },
  { value: "goals", label: "goals.tabGoals" },
] as const;

/** Progress: stats over a period, or goals with `?tab=goals`. */
export default function Progress() {
  const { state } = useData();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "goals" ? "goals" : "stats";
  const setTab = (next: Tab) =>
    setParams(next === "goals" ? { tab: next } : {}, { replace: true });
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Period>("4w");
  const { t } = useT();
  const periodOptions: { value: Period; label: string }[] = periods.map(
    ({ value, label }) => ({ value, label: t(label) }),
  );
  const now = today();
  const [preferences, updatePreferences] = useTrainingPreferences();
  const goals = useGoals(preferences.weeklyGoal, now);
  const goalEditor = useGoalEditor();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  // Recomputed only when the log changes, not while typing in the search box.
  const items = useMemo(() => progressFor(records), [records]);
  const period = historyPeriod(range, now);
  const cardioItems = useMemo(() => cardioProgressFor(records), [records]);
  const { fieldsFor } = useCardioFields();
  // Strength and cardio exercises share one list, most trained first. A strength
  // row shows its best set; a cardio row shows its latest time and distance.
  const rows = useMemo(() => {
    const inPeriod = ({ date }: { date: string }) =>
      date >= period.start && date <= period.end;
    return [
      ...items.map((item) => {
        const stats = exerciseStats(item);
        return {
          id: item.id,
          name: item.name,
          sessions: item.points.filter(inPeriod).length,
          best: t("progress.best", { set: labelSet(stats.best.set, false) }),
          trend: stats.comparable.slice(-8).map(stats.valueOf),
        };
      }),
      ...cardioItems.map((item) => {
        const latest = item.sessions.at(-1)!;
        return {
          id: item.id,
          name: item.name,
          sessions: item.sessions.filter(inPeriod).length,
          best: t("progress.latest", {
            value: totalsLabel(latest, fieldsFor(item.id).distanceUnit),
          }),
          trend: item.sessions.slice(-8).map((x) => x.durationSec),
        };
      }),
    ]
      .filter((row) => row.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  }, [items, cardioItems, period.start, period.end, t, fieldsFor]);
  const prs = useMemo(() => prEvents(records), [records]);
  const bests = useMemo(
    () => recentBests(prs, period.start, period.end),
    [prs, period.start, period.end],
  );
  const query = search.trim().toLocaleLowerCase();
  const shown = rows.filter((row) =>
    row.name.toLocaleLowerCase().includes(query),
  );
  const hasData = items.length > 0 || cardioItems.length > 0;
  const before = periods.find((p) => p.value === range)!.before;
  // "Goals: 2 active · this week 2/3", only once there is something to show.
  const goalChip = (() => {
    const parts = [
      goals.open.length > 0 &&
        t("goals.chipActive", { count: goals.open.length }),
      goals.weekly &&
        t("goals.chipWeek", {
          done: goals.weekly.done,
          goal: goals.weekly.goal,
        }),
    ].filter(Boolean);
    if (!parts.length && goals.reached.length)
      parts.push(t("goals.chipReached", { count: goals.reached.length }));
    return parts.length ? t("goals.chip", { parts: parts.join(" · ") }) : null;
  })();
  return (
    <div className="page progress-page">
      {tab === "stats" ? (
        <PageHeader
          eyebrow={
            hasData
              ? t("progress.comparedWith", { before: t(before) })
              : undefined
          }
          title={t("progress.title")}
        />
      ) : (
        <PageHeader
          eyebrow={
            goals.open.length
              ? t("goals.eyebrow", { count: goals.open.length })
              : t("progress.title")
          }
          title={t("goals.title")}
          action={
            <button
              type="button"
              className="text-link"
              onClick={() => goalEditor.edit("new")}
            >
              <Plus size={18} aria-hidden="true" />
              {t("goals.add")}
            </button>
          }
        />
      )}
      <Segmented<Tab>
        label={t("goals.tabs")}
        value={tab}
        options={tabs.map(({ value, label }) => ({ value, label: t(label) }))}
        onChange={setTab}
      />
      {tab === "goals" && (
        <GoalsPanel
          {...goals}
          preferences={preferences}
          onPreferences={updatePreferences}
          onEdit={goalEditor.edit}
        />
      )}
      {tab === "stats" && goalChip && (
        <button
          type="button"
          className="goals-chip-link"
          onClick={() => setTab("goals")}
        >
          <Target size={18} aria-hidden="true" />
          <span>{goalChip}</span>
          <ChevronRight className="chev" size={18} aria-hidden="true" />
        </button>
      )}
      {tab === "stats" && hasData && (
        <>
          <Segmented<Period>
            label={t("progress.period")}
            value={range}
            options={periodOptions}
            onChange={setRange}
          />
          <ProgressSummary
            records={records}
            progress={items}
            now={now}
            range={range}
          />
          {bests.length > 0 && (
            <section aria-labelledby="bests-heading">
              <div className="section-head">
                <h2 id="bests-heading">{t("progress.recentBests")}</h2>
              </div>
              <div className="best-grid">
                {bests.map((best) => (
                  <div className="card best-card" key={best.exerciseId}>
                    <Link
                      className="best-card-exercise"
                      to={exercisePath(best.exerciseId)}
                    >
                      {best.name}
                    </Link>
                    <Link
                      className="best-card-open"
                      to={historyPath(best.workoutId, best.set.id)}
                      aria-label={t("progress.openBest", {
                        name: best.name,
                        set: labelSet(best.set, false),
                      })}
                    >
                      <RecordPill small>{t("history.newBest")}</RecordPill>
                      <strong>{labelSet(best.set, false)}</strong>
                      <span className="row-sub">{prKindsText(best.kinds)}</span>
                      <time className="row-sub" dateTime={best.date}>
                        {best.date === now
                          ? t("common.todayCap")
                          : localizedDate(best.date, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                      </time>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="exercises-heading">
            <div className="section-head">
              <h2 id="exercises-heading">{t("progress.exercises")}</h2>
              <span className="row-sub">{t("progress.mostTrained")}</span>
            </div>
            {rows.length > 0 && (
              <input
                aria-label={t("progress.find")}
                placeholder={t("progress.findPlaceholder")}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {shown.length > 0 && (
              <div className="flat-list">
                {shown.map((row) => (
                  <ExerciseRow
                    key={row.id}
                    exerciseId={row.id}
                    title={row.name}
                    meta={`${row.best} · ${countLabel(row.sessions, "session")}`}
                    end={
                      <>
                        <Sparkline values={row.trend} />
                        <ChevronRight
                          className="chev"
                          size={20}
                          aria-hidden="true"
                        />
                      </>
                    }
                    to={exercisePath(row.id)}
                  />
                ))}
              </div>
            )}
            {rows.length === 0 && (
              <div className="card col-12" role="status">
                <h3 className="card-title">{t("progress.noSessions")}</h3>
                <p className="row-sub">{t("progress.longerPeriod")}</p>
              </div>
            )}
            {rows.length > 0 && shown.length === 0 && (
              <div className="card col-12" role="status">
                <h3 className="card-title">{t("progress.noMatch")}</h3>
                <p className="row-sub">{t("progress.noMatchText")}</p>
                <button className="btn-secondary" onClick={() => setSearch("")}>
                  {t("progress.clearSearch")}
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {tab === "stats" && !hasData && (
        <div className="empty-card">
          <TrendingUp size={30} />
          <h2>{t("progress.emptyTitle")}</h2>
          <p>{t("progress.emptyText")}</p>
          <Link className="btn-primary" to="/">
            {t("progress.startWorkout")}
          </Link>
        </div>
      )}
      {goalEditor.editor}
    </div>
  );
}
