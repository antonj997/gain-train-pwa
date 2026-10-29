import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localizedDate } from "@/lib/dates";

/** A small popover under the calendar title: pick a year, then a month. */
export default function MonthPicker({
  month,
  max,
  onPick,
  onClose,
}: {
  month: string;
  max: string;
  onPick: (month: string) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const root = useRef<HTMLDivElement>(null);
  const maxYear = Number(max.slice(0, 4));

  useEffect(() => {
    root.current
      ?.querySelector<HTMLButtonElement>("[aria-pressed=true]")
      ?.focus();
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !root.current?.contains(target) &&
        !(target as Element).closest?.(".month-title-button")
      )
        onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);

  return (
    <div
      className="month-picker"
      role="dialog"
      aria-label="Choose month and year"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="month-picker-year">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous year"
          disabled={year <= 1900}
          onClick={() => setYear(year - 1)}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <strong aria-live="polite">{year}</strong>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next year"
          disabled={year >= maxYear}
          onClick={() => setYear(year + 1)}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="month-picker-grid">
        {Array.from({ length: 12 }, (_, index) => {
          const value = `${year}-${String(index + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={value}
              className="month-picker-month"
              aria-pressed={value === month}
              disabled={value > max}
              onClick={() => onPick(value)}
            >
              {localizedDate(value + "-01", { month: "short" })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
