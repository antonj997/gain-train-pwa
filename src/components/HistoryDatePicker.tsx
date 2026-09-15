import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { today } from "@/data/model";

const presets = [
  { value: "", label: "Last 30 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];
export default function HistoryDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const now = today();
  const currentYear = Number(now.slice(0, 4));
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(currentYear);
  const trigger = useRef<HTMLButtonElement>(null);
  const label =
    presets.find((preset) => preset.value === value)?.label ??
    new Date(value + "-01T12:00:00").toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <>
      <div className="date-picker-field">
        <span id="history-date-label">Period</span>
        <button
          ref={trigger}
          className="secondary date-picker-trigger"
          aria-labelledby="history-date-label history-date-value"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setYear(
              /^\d{4}-\d{2}$/.test(value)
                ? Number(value.slice(0, 4))
                : currentYear,
            );
            setOpen(true);
          }}
        >
          <span id="history-date-value">{label}</span>
          <CalendarDays size={19} />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="history-date-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Choose a period</DialogTitle>
            <DialogDescription>
              Select a recent range or a calendar month.
            </DialogDescription>
          </DialogHeader>
          <div className="date-presets">
            {presets.map((preset) => (
              <button
                key={preset.value}
                className={value === preset.value ? "primary" : "secondary"}
                aria-pressed={value === preset.value}
                onClick={() => choose(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="date-year">
            <button
              className="icon-button"
              aria-label="Previous year"
              disabled={year <= 1900}
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <strong aria-live="polite">{year}</strong>
            <button
              className="icon-button"
              aria-label="Next year"
              disabled={year >= currentYear}
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="date-months">
            {Array.from({ length: 12 }, (_, index) => {
              const month = `${year}-${String(index + 1).padStart(2, "0")}`;
              const date = new Date(year, index, 1, 12);
              return (
                <button
                  key={month}
                  className={value === month ? "primary" : "secondary"}
                  aria-label={date.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                  aria-pressed={value === month}
                  disabled={month > now.slice(0, 7)}
                  onClick={() => choose(month)}
                >
                  {date.toLocaleDateString(undefined, { month: "short" })}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
