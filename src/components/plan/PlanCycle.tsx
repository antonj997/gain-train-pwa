import Segmented from "@/components/ui/Segmented";
import type { Plan } from "@/data/model";
import {
  type CyclePreset,
  cyclePreset,
  deloadOf,
  kindsForCycle,
  weekKindsOf,
  withCyclePreset,
} from "@/data/phase";
import { withCycle } from "@/data/plans";
import { t } from "@/i18n";
import { deloadText } from "@/lib/plan-note";

const cycleOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));
const presets: { value: CyclePreset; key: Parameters<typeof t>[0] }[] = [
  { value: "3+1", key: "plan.preset31" },
  { value: "5+1", key: "plan.preset51" },
  { value: "none", key: "plan.presetNone" },
];
const LOAD_OPTIONS = [0, 5, 10, 15, 20, 25, 30];
const SETS_OPTIONS = [40, 50, 60, 75, 100];

/**
 * The cycle: how many weeks repeat, quick presets ("3 + 1 deload"), and how a
 * deload week lightens routines once one is marked.
 */
export default function PlanCycle({
  plan,
  onChange,
}: {
  plan: Plan;
  onChange: (update: (plan: Plan) => Plan) => void;
}) {
  const preset = cyclePreset(plan);
  const hasDeload = weekKindsOf(plan).includes("deload");
  const deload = deloadOf(plan);
  const setDeload = (change: Partial<typeof deload>) =>
    onChange((p) => ({ ...p, deload: { ...deloadOf(p), ...change } }));
  return (
    <section className="plan-field" aria-labelledby="cycle-heading">
      <span className="group-title" id="cycle-heading">
        {t("plan.repeatsEvery")}
      </span>
      <Segmented
        label={t("plan.weeksInCycle")}
        value={String(plan.cycleWeeks)}
        options={cycleOptions}
        onChange={(value) =>
          onChange((p) =>
            kindsForCycle(withCycle(p, Number(value)), Number(value)),
          )
        }
      />
      <div className="plan-presets" role="group" aria-label={t("plan.presets")}>
        {presets.map((option) => (
          <button
            key={option.value}
            type="button"
            className="filter-chip"
            aria-pressed={preset === option.value}
            onClick={() => onChange((p) => withCyclePreset(p, option.value))}
          >
            {t(option.key)}
          </button>
        ))}
      </div>
      {hasDeload && (
        <div className="plan-deload">
          <p className="row-sub">
            {t("plan.deloadWeeks")}: {deloadText(deload)}.{" "}
            {t("plan.deloadNote")}
          </p>
          <div className="field-row">
            <label>
              {t("plan.deloadLoad")}
              <select
                value={String(deload.loadPct)}
                onChange={(e) => setDeload({ loadPct: Number(e.target.value) })}
              >
                {LOAD_OPTIONS.map((pct) => (
                  <option key={pct} value={String(pct)}>
                    {pct
                      ? t("plan.deloadLighter", { pct })
                      : t("plan.deloadSameLoad")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("plan.deloadSets")}
              <select
                value={String(deload.setsPct)}
                onChange={(e) => setDeload({ setsPct: Number(e.target.value) })}
              >
                {SETS_OPTIONS.map((pct) => (
                  <option key={pct} value={String(pct)}>
                    {t("plan.deloadSetsOption", { pct })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
