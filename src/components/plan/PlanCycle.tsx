import Segmented from "@/components/ui/Segmented";
import type { Plan } from "@/data/model";
import {
  type CyclePreset,
  cyclePreset,
  deloadOf,
  deloadPresets,
  deloadWeeks,
  kindsForCycle,
  phaseWeeks,
  withCyclePreset,
} from "@/data/phase";
import { withCycle } from "@/data/plans";
import { t } from "@/i18n";

const LOAD_OPTIONS = [0, 5, 10, 15, 20, 25, 30];
const SETS_OPTIONS = [40, 50, 60, 75, 100];

/**
 * The new plan's Deload and "Upprepas var" (v6 F1): a 44 px Segmented of
 * three deload presets that follow the phase's length ("Ingen | 7 + 1 | 3 +
 * 1 två gånger" for 8 weeks) with the note on the defaults, how many weeks
 * the template repeats over ("Vecka | 2 veckor | 3 veckor"), and how a deload
 * week lightens routines once there is one.
 */
export default function PlanCycle({
  plan,
  onChange,
}: {
  plan: Plan;
  onChange: (update: (plan: Plan) => Plan) => void;
}) {
  const valid =
    !!plan.startDate && !!plan.endDate && plan.startDate <= plan.endDate;
  const weeks = valid ? phaseWeeks(plan) : 0;
  const presets = deloadPresets(weeks);
  const preset = valid ? cyclePreset(plan) : null;
  const hasDeload = valid && deloadWeeks(plan).length > 0;
  // Weeks the template repeats over: 1–3, and a longer cycle an older plan has.
  const cycles = [1, 2, 3, ...(plan.cycleWeeks > 3 ? [plan.cycleWeeks] : [])];
  const deload = deloadOf(plan);
  const setDeload = (change: Partial<typeof deload>) =>
    onChange((p) => ({ ...p, deload: { ...deloadOf(p), ...change } }));
  return (
    <>
      {valid && (
        <section className="plan-field" aria-labelledby="deload-heading">
          <span className="group-title" id="deload-heading">
            {t("plan.deloadLabel")}
          </span>
          <Segmented<CyclePreset | "">
            label={t("plan.deloadLabel")}
            value={preset ?? ""}
            options={presets.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(value) =>
              value && onChange((p) => withCyclePreset(p, value))
            }
          />
          <p className="row-sub plan-field-note">
            {t("plan.deloadDefaultNote")}
          </p>
          {hasDeload && (
            <div className="field-row plan-deload">
              <label>
                {t("plan.deloadLoad")}
                <select
                  value={String(deload.loadPct)}
                  onChange={(e) =>
                    setDeload({ loadPct: Number(e.target.value) })
                  }
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
                  onChange={(e) =>
                    setDeload({ setsPct: Number(e.target.value) })
                  }
                >
                  {SETS_OPTIONS.map((pct) => (
                    <option key={pct} value={String(pct)}>
                      {t("plan.deloadSetsOption", { pct })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>
      )}
      <section className="plan-field" aria-labelledby="cycle-heading">
        <span className="group-title" id="cycle-heading">
          {t("plan.repeatLabel")}
        </span>
        <Segmented
          label={t("plan.weeksInCycle")}
          value={String(plan.cycleWeeks)}
          options={cycles.map((n) => ({
            value: String(n),
            label:
              n === 1
                ? t("plan.repeatWeek")
                : t("plan.repeatWeeks", { count: n }),
          }))}
          onChange={(value) =>
            onChange((p) =>
              kindsForCycle(withCycle(p, Number(value)), Number(value)),
            )
          }
        />
      </section>
    </>
  );
}
