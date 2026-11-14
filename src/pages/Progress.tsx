import ExerciseRow from "@/components/items/ExerciseRow";
import RecordPill from "@/components/items/RecordPill";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import {
  cardioProgressFor,
  exerciseStats,
  progressFor,
  recentBests,
} from "@/data/analytics";
import { rankedKindsText, rankedRecords } from "@/data/record-rank";
import { labelSet, today } from "@/data/model";
import { historyPeriod } from "@/data/summary";
import GoalStrip from "@/components/goals/GoalStrip";
import PageHeader from "@/components/PageHeader";
import ProgressSummary from "@/components/ProgressSummary";
import MuscleSets from "@/components/MuscleSets";
import Sparkline from "@/components/Sparkline";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import { localizedDate } from "@/lib/dates";
import { exercisePath, historyPath } from "@/lib/routes";
import { countLabel } from "@/lib/labels";
import { totalsLabel } from "@/lib/cardio";
import { useCardioFields } from "@/hooks/useCardioFields";
import { useGoals } from "@/hooks/useGoals";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { useT } from "@/i18n/useT";
import { useExerciseMenu } from "@/components/gestures/ExerciseMenu";
import { useHiddenExercises } from "@/hooks/useHiddenExercises";
import { libraryExercises } from "@/lib/library";

const periods = [
  { value: "4w", label: "progress.p4w", before: "progress.before4w" },
  { value: "3m", label: "progress.p3m", before: "progress.before3m" },
  { value: "12m", label: "progress.p12m", before: "progress.before12m" },
] as const;
type Period = (typeof periods)[number]["value"];

/**
 * Progress: am I getting stronger. One scroll: the period in a header chip,
 * goal rings (the full goals are the /progress/goals subscreen), the 2×2
 * tiles, recent records and the exercises trained in the period.
 */
export default function Progress() {
  const { state } = useData();
  // Press and hold an exercise row: its menu by the row.
  const exerciseMenu = useExerciseMenu();
  const { hidden } = useHiddenExercises();
  const library = useMemo(
    () => libraryExercises(state.records, hidden),
    [state.records, hidden],
  );
  const holdRow = (row: { id: string; name: string }, anchor: HTMLElement) =>
    exerciseMenu.open(
      library.find((e) => e.id === row.id) ?? {
        id: row.id,
        name: row.name,
        category: "Other",
        custom: false,
        favourite: false,
      },
      anchor,
    );
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Period>("4w");
  const [choosing, setChoosing] = useState(false);
  const { t } = useT();
  const now = today();
  const [preferences] = useTrainingPreferences();
  const goals = useGoals(preferences.weeklyGoal, now);
  const records = useMemo(() => Object.values(state.records), [state.records]);
  // Recomputed only when the log changes, not while typing in the search box.
  const { bodyWeightKg } = useProfile();
  const items = useMemo(
    () => progressFor(records, bodyWeightKg),
    [records, bodyWeightKg],
  );
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
          // Every comparable session ever, not just the period's.
          trend: stats.comparable.map(stats.valueOf),
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
          trend: item.sessions.map((x) => x.durationSec),
        };
      }),
    ]
      .filter((row) => row.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  }, [items, cardioItems, period.start, period.end, t, fieldsFor]);
  const prs = useMemo(() => rankedRecords(records), [records]);
  const bests = useMemo(
    () => recentBests(prs, period.start, period.end),
    [prs, period.start, period.end],
  );
  const query = search.trim().toLocaleLowerCase();
  const shown = rows.filter((row) =>
    row.name.toLocaleLowerCase().includes(query),
  );
  const hasData = items.length > 0 || cardioItems.length > 0;
  const current = periods.find((p) => p.value === range)!;
  return (
    <div className="page progress-page">
      {exerciseMenu.menu}
      <PageHeader
        eyebrow={
          hasData
            ? t("progress.comparedWith", { before: t(current.before) })
            : undefined
        }
        title={t("progress.title")}
        action={
          hasData && (
            <button
              type="button"
              className="period-chip"
              aria-haspopup="dialog"
              aria-label={t("progress.periodChoose", {
                period: t(current.label),
              })}
              onClick={() => setChoosing(true)}
            >
              {t(current.label)}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )
        }
      />
      <ChoiceSheet<Period>
        open={choosing}
        onClose={() => setChoosing(false)}
        title={t("progress.period")}
        value={range}
        options={periods.map(({ value, label }) => ({
          value,
          label: t(label),
        }))}
        onChoose={setRange}
      />
      <section aria-labelledby="goals-heading">
        <div className="section-head">
          <h2 id="goals-heading">{t("progress.goalsHeading")}</h2>
          <Link className="text-link" to="/progress/goals">
            {t("progress.allGoals")}
          </Link>
        </div>
        <GoalStrip weekly={goals.weekly} open={goals.open} />
      </section>
      {hasData && (
        <>
          <MuscleSets records={records} now={now} />
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
              <div className="record-pills">
                {bests.map((best) => {
                  const set = labelSet(best.set, false);
                  return (
                    <Link
                      key={best.exerciseId}
                      className="record-link"
                      to={historyPath(best.workoutId, best.set.id)}
                      aria-label={t("progress.recordOpen", {
                        name: best.name,
                        set,
                        kinds: rankedKindsText(best.kinds),
                        date:
                          best.date === now
                            ? t("common.todayCap")
                            : localizedDate(best.date, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              }),
                      })}
                    >
                      <RecordPill quiet={best.top === "e1rm"}>
                        {best.name} {set}
                      </RecordPill>
                    </Link>
                  );
                })}
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
                        {row.trend.length >= 2 ? (
                          <Sparkline values={row.trend} />
                        ) : (
                          // One session is no trend: the space stays, so
                          // the chevrons line up.
                          <span className="sparkline" aria-hidden="true" />
                        )}
                        <ChevronRight
                          className="chev"
                          size={20}
                          aria-hidden="true"
                        />
                      </>
                    }
                    to={exercisePath(row.id)}
                    onLongPress={(anchor) => holdRow(row, anchor)}
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
      {!hasData && (
        <div className="empty-card">
          <TrendingUp size={30} />
          <h2>{t("progress.emptyTitle")}</h2>
          <p>{t("progress.emptyText")}</p>
          <Link className="btn-primary" to="/">
            {t("progress.startWorkout")}
          </Link>
        </div>
      )}
    </div>
  );
}
