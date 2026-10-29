import { useState } from "react";
import { X } from "lucide-react";
import PlanCalendar from "@/components/PlanCalendar";
import type { Plan } from "@/data/model";
import { shiftDate } from "@/lib/dates";

type Props = {
  startDate: string;
  endDate: string;
  today: string;
  onChange: (period: Partial<Pick<Plan, "startDate" | "endDate">>) => void;
};

/** The plan's period: From and To fields, and a calendar where two taps pick the first and last day. */
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
  const range = startDate
    ? { start: startDate, end: endDate >= startDate ? endDate : startDate }
    : null;
  return (
    <>
      <div className="field-row">
        <label>
          From
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </label>
      </div>
      <section aria-labelledby="period-heading">
        <div className="section-head">
          <h3 className="group-title" id="period-heading">
            {step === "start" ? "Tap the first day" : "Now tap the last day"}
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
            Clear
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
          label="Plan period"
          initialMonth={(startDate || today).slice(0, 7)}
          onPick={pickDay}
        />
      </section>
    </>
  );
}
