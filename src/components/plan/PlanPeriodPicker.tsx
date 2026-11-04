import { useState } from "react";
import { X } from "lucide-react";
import PlanCalendar from "@/components/PlanCalendar";
import type { Plan } from "@/data/model";
import { shiftDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { PHASE_LENGTHS, endsOnWeek, phaseEnd, phaseWeeks } from "@/data/phase";
import { t } from "@/i18n";

type Props = {
  startDate: string;
  endDate: string;
  today: string;
  onChange: (period: Partial<Pick<Plan, "startDate" | "endDate">>) => void;
};

/**
 * The phase's period: From and To fields, a length in weeks (which sets To to
 * the Sunday of the last week), and a calendar where two taps pick the first
 * and last day.
 */
export default function PlanPeriodPicker({
  startDate,
  endDate,
  today,
  onChange,
}: Props) {
  // Which day of the period the calendar asks for next.
  const [step, setStep] = useState<"start" | "end">("start");
  const pickDay = (date: string) => {
    if (step === "start" || !startDate || date < startDate) {
      onChange({ startDate: date, endDate: "" });
      setStep("end");
    } else {
      onChange({ endDate: date });
      setStep("start");
    }
  };
  const valid = !!startDate && !!endDate && startDate <= endDate;
  const weeks = valid ? phaseWeeks({ startDate, endDate }) : 0;
  // A length names the period when it ends on the Sunday of a week the list has.
  const lengthValue =
    valid && endsOnWeek({ startDate, endDate }) && PHASE_LENGTHS.includes(weeks)
      ? String(weeks)
      : "";
  const range = startDate
    ? { start: startDate, end: endDate >= startDate ? endDate : startDate }
    : null;
  return (
    <>
      <div className="field-row">
        <label>
          {t("plan.from")}
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </label>
        <label>
          {t("plan.to")}
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </label>
      </div>
      <label>
        {t("plan.length")}
        <select
          value={lengthValue}
          disabled={!startDate}
          onChange={(e) =>
            e.target.value &&
            onChange({ endDate: phaseEnd(startDate, Number(e.target.value)) })
          }
        >
          {!lengthValue && (
            <option value="">
              {weeks ? t("plan.lengthCustom", { count: weeks }) : "—"}
            </option>
          )}
          {PHASE_LENGTHS.map((n) => (
            <option key={n} value={String(n)}>
              {countLabel(n, "week")}
            </option>
          ))}
        </select>
      </label>
      <section aria-labelledby="period-heading">
        <div className="section-head">
          <h3 className="group-title" id="period-heading">
            {step === "start" ? t("plan.tapFirst") : t("plan.tapLast")}
          </h3>
          <button
            type="button"
            className="btn-quiet btn-sm"
            onClick={() => {
              onChange({ startDate: "", endDate: "" });
              setStep("start");
            }}
          >
            <X size={16} aria-hidden="true" />
            {t("plan.clear")}
          </button>
        </div>
        <PlanCalendar
          today={today}
          first={shiftDate(
            startDate && startDate < today ? startDate : today,
            -366,
          )}
          last={shiftDate(today, 5 * 366)}
          range={range}
          label={t("plan.period")}
          initialMonth={(startDate || today).slice(0, 7)}
          onPick={pickDay}
        />
      </section>
    </>
  );
}
