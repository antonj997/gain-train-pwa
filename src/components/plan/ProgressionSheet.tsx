import { useMemo, useState } from "react";
import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import { useData } from "@/contexts/useData";
import {
  levels,
  today as todayDate,
  type Level,
  type Plan,
  type ProgressionItem,
} from "@/data/model";
import { deloadWeeks, phaseWeeks, progressionWeeks, weekKindsOf } from "@/data/phase";
import { detectLevel, estimateStartLoad, exerciseInfo } from "@/data/progression";
import {
  loadIncrement,
  pctFromTarget,
  suggestProgression,
  targetFromPct,
} from "@/lib/progression";
import { localizedDate } from "@/lib/dates";
import { parseSetNumber } from "@/lib/set-input";
import { formatDecimal, t } from "@/i18n";

/** Kilograms as the plan editor shows them: "82.5", "82,5". Entry is in kg, like goals. */
export const kgText = (kg: number) => formatDecimal(Math.round(kg * 100) / 100);

const levelKey = {
  beginner: "prog.levelBeginner",
  intermediate: "prog.levelIntermediate",
  experienced: "prog.levelExperienced",
} as const;
export const levelLabel = (level: Level) => t(levelKey[level]);

type Mode = "pct" | "kg";

/** A positive number typed in a field, or null. */
const positive = (text: string) => {
  const value = parseSetNumber(text);
  return value !== null && Number.isFinite(value) && value > 0 && value <= 10000
    ? value
    : null;
};

/**
 * One lift of a phase's progression: reps, start and target, the level, the
 * suggestion with its reasons, a warning when the target is faster than
 * usual, and the week-by-week weights, each of which can be typed over.
 */
export default function ProgressionSheet({
  open,
  plan,
  item,
  addGoal,
  linkedGoal,
  onChange,
  onAddGoal,
  onRemove,
  onClose,
}: {
  open: boolean;
  plan: Plan;
  item: ProgressionItem;
  /** "Also add as a goal" is on. */
  addGoal: boolean;
  /** The goal this row already made, as a title. */
  linkedGoal: string | null;
  onChange: (item: ProgressionItem) => void;
  onAddGoal: (on: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { state } = useData();
  const today = todayDate();
  const info = useMemo(
    () => exerciseInfo(state.records, item.exerciseId),
    [state.records, item.exerciseId],
  );
  const detected = useMemo(
    () => detectLevel(state.records, today),
    [state.records, today],
  );
  const estimate = useMemo(
    () => estimateStartLoad(state.records, item.exerciseId, item.reps, today),
    [state.records, item.exerciseId, item.reps, today],
  );
  const weeks = phaseWeeks(plan);
  const deloads = deloadWeeks(plan);
  const increment = loadIncrement(info.equipment, item.startKg);
  const hasStart = item.startKg > 0;
  const suggestion = hasStart
    ? suggestProgression({
        exercise: info,
        startKg: item.startKg,
        reps: item.reps,
        weeks,
        deloadWeeks: deloads,
        level: item.level,
        equipment: info.equipment,
        targetKg: item.targetKg > 0 ? item.targetKg : undefined,
        cycle: weekKindsOf(plan).map((k) => k === "deload"),
      })
    : null;
  const table = hasStart && item.targetKg > 0 ? progressionWeeks(plan, item, info.equipment) : [];

  const [mode, setMode] = useState<Mode>("pct");
  const [repsText, setRepsText] = useState(String(item.reps));
  const [startText, setStartText] = useState(hasStart ? kgText(item.startKg) : "");
  const [targetText, setTargetText] = useState(() =>
    item.targetKg > 0
      ? mode === "pct"
        ? kgText(pctFromTarget(item.startKg, item.targetKg))
        : kgText(item.targetKg)
      : "",
  );
  // The week cell being typed in, so its text is not reformatted mid-entry.
  const [typing, setTyping] = useState<{ week: number; text: string } | null>(null);

  const update = (change: Partial<ProgressionItem>) => onChange({ ...item, ...change });
  const showTarget = (targetKg: number, as: Mode = mode, startKg = item.startKg) =>
    setTargetText(
      targetKg > 0
        ? as === "pct"
          ? kgText(pctFromTarget(startKg, targetKg))
          : kgText(targetKg)
        : "",
    );
  const setTarget = (targetKg: number) => {
    update({ targetKg });
    showTarget(targetKg);
  };
  const setStart = (startKg: number) => {
    // A percentage target keeps its percentage on the new start.
    const pct = mode === "pct" ? parseSetNumber(targetText) : null;
    const step = loadIncrement(info.equipment, startKg);
    const targetKg =
      pct !== null && Number.isFinite(pct)
        ? targetFromPct(startKg, pct, step)
        : item.targetKg;
    update({ startKg, targetKg });
    setStartText(kgText(startKg));
    if (mode === "kg") showTarget(targetKg, "kg", startKg);
  };

  const levelOptions = levels.map((value) => ({ value, label: levelLabel(value) }));
  const typedReps = positive(repsText);

  return (
    <Sheet
      open={open}
      size="full"
      onClose={onClose}
      title={item.name}
      description={t("prog.sheetDescription")}
    >
      <div className="field-row">
        <label>
          {t("prog.reps")}
          <input
            inputMode="numeric"
            autoComplete="off"
            value={repsText}
            aria-invalid={typedReps === null || !Number.isInteger(typedReps) || typedReps > 100}
            onChange={(e) => {
              setRepsText(e.target.value);
              const reps = positive(e.target.value);
              if (reps !== null && Number.isInteger(reps) && reps <= 100) update({ reps });
            }}
          />
        </label>
        <label>
          {t("prog.startKg")}
          <input
            inputMode="decimal"
            autoComplete="off"
            value={startText}
            placeholder={estimate ? kgText(estimate.kg) : "60"}
            aria-invalid={!hasStart}
            onChange={(e) => {
              setStartText(e.target.value);
              const kg = positive(e.target.value);
              if (kg !== null) {
                const pct = mode === "pct" ? parseSetNumber(targetText) : null;
                const step = loadIncrement(info.equipment, kg);
                update({
                  startKg: kg,
                  targetKg:
                    pct !== null && Number.isFinite(pct)
                      ? targetFromPct(kg, pct, step)
                      : item.targetKg,
                });
              }
            }}
          />
        </label>
      </div>
      <p className="row-sub">
        {estimate ? (
          <>
            {t(estimate.from === "set" ? "prog.fromSet" : "prog.fromE1rm", {
              kg: kgText(estimate.kg),
              set: `${kgText(estimate.setKg)} kg × ${estimate.setReps}`,
              date: localizedDate(estimate.date, { day: "numeric", month: "short" }),
            })}
            {estimate.kg !== item.startKg && (
              <>
                {" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setStart(estimate.kg)}
                >
                  {t("prog.useIt")}
                </button>
              </>
            )}
          </>
        ) : (
          t("prog.noHistory")
        )}
      </p>
      <div className="plan-field">
        <span className="group-title">{t("prog.target")}</span>
        <Segmented<Mode>
          label={t("prog.targetAs")}
          value={mode}
          options={[
            { value: "pct", label: t("prog.asPct") },
            { value: "kg", label: t("prog.asKg") },
          ]}
          onChange={(next) => {
            setMode(next);
            showTarget(item.targetKg, next);
          }}
        />
        <label>
          {mode === "pct" ? t("prog.increasePct") : t("prog.targetKg")}
          <input
            inputMode="decimal"
            autoComplete="off"
            value={targetText}
            disabled={!hasStart}
            onChange={(e) => {
              setTargetText(e.target.value);
              const value = parseSetNumber(e.target.value);
              if (value === null || !Number.isFinite(value)) return;
              if (mode === "pct") {
                if (value > -50 && value <= 200)
                  update({ targetKg: targetFromPct(item.startKg, value, increment) });
              } else if (value > 0 && value <= 10000) update({ targetKg: value });
            }}
          />
        </label>
      </div>
      <div className="plan-field">
        <span className="group-title">{t("prog.level")}</span>
        <Segmented<Level>
          label={t("prog.level")}
          value={item.level}
          options={levelOptions}
          onChange={(level) => update({ level })}
        />
        <p className="row-sub">
          {t("prog.detected", {
            level: levelLabel(detected.level),
            months: detected.months,
            sessions: detected.sessions,
          })}
        </p>
      </div>
      {suggestion && (
        <div className="card prog-suggestion" aria-live="polite">
          <strong className="card-title">{t("prog.suggestedTimeline")}</strong>
          <p>
            {t("prog.suggestion", {
              kg: kgText(Math.round(suggestion.kgPerWeek * 100) / 100),
              pct: kgText(Math.round(suggestion.pctPerWeek * 100) / 100),
              target: kgText(suggestion.suggestedTargetKg),
              weeks,
            })}
          </p>
          <p className="row-sub">
            {t("prog.basis", {
              level: levelLabel(item.level),
              body: t(suggestion.lower ? "prog.lowerBody" : "prog.upperBody"),
              equipment: t(("prog.class." + suggestion.loadClass) as Parameters<typeof t>[0]),
              step: kgText(suggestion.increment),
              deloads: deloads.length,
            })}
          </p>
          {suggestion.tooFast ? (
            <div className="prog-warning" role="alert">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                {suggestion.weeksNeeded
                  ? t("prog.tooFast", { weeks: suggestion.weeksNeeded })
                  : t("prog.tooFastLong")}
              </span>
            </div>
          ) : null}
          {item.targetKg !== suggestion.suggestedTargetKg && (
            <button
              type="button"
              className={suggestion.tooFast ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              onClick={() => setTarget(suggestion.suggestedTargetKg)}
            >
              {suggestion.tooFast ? t("prog.useTimeline") : t("prog.useSuggestion")}
            </button>
          )}
        </div>
      )}
      {table.length > 0 && (
        <section aria-labelledby="prog-weeks-heading" className="plan-field">
          <span className="group-title" id="prog-weeks-heading">
            {t("prog.weekByWeek")}
          </span>
          <div className="list prog-weeks">
            {table.map((w) => (
              <div
                key={w.week}
                className={
                  "prog-week" + (w.deload ? " is-deload" : "") + (w.edited ? " is-edited" : "")
                }
              >
                <span className="prog-week-name">
                  {t("plan.weekN", { n: w.week })}
                  {w.deload && <span className="prog-tag">{t("plan.deload")}</span>}
                </span>
                {w.edited && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("prog.resetWeek", { n: w.week })}
                    onClick={() => {
                      const overrides = { ...item.overrides };
                      delete overrides[String(w.week)];
                      update({ overrides });
                    }}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                  </button>
                )}
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={t("prog.weekWeight", { n: w.week })}
                  value={typing?.week === w.week ? typing.text : kgText(w.kg)}
                  onFocus={(e) => {
                    setTyping({ week: w.week, text: e.target.value });
                    e.target.select();
                  }}
                  onBlur={() => setTyping(null)}
                  onChange={(e) => {
                    setTyping({ week: w.week, text: e.target.value });
                    const kg = parseSetNumber(e.target.value);
                    if (kg !== null && Number.isFinite(kg) && kg >= 0 && kg <= 10000)
                      update({ overrides: { ...item.overrides, [String(w.week)]: kg } });
                  }}
                />
                <span className="prog-unit" aria-hidden="true">
                  kg
                </span>
              </div>
            ))}
          </div>
          <p className="row-sub group-note">{t("prog.weeksNote")}</p>
        </section>
      )}
      {linkedGoal ? (
        <p className="row-sub">{t("prog.linkedGoal", { goal: linkedGoal })}</p>
      ) : item.reps <= 10 ? (
        <Switch
          label={t("prog.addGoal")}
          checked={addGoal}
          disabled={!hasStart || !(item.targetKg > 0)}
          onChange={onAddGoal}
        />
      ) : (
        <p className="row-sub">{t("prog.goalRepsNote")}</p>
      )}
      <button type="button" className="btn-quiet prog-remove" onClick={onRemove}>
        <Trash2 size={18} aria-hidden="true" />
        {t("prog.remove")}
      </button>
      <div className="sheet-footer">
        <button type="button" className="btn-primary btn-block" onClick={onClose}>
          {t("common.done")}
        </button>
      </div>
    </Sheet>
  );
}
