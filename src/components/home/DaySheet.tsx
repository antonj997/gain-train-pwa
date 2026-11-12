import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Moon,
  Play,
  Sparkles,
} from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import RoutineBadge from "@/components/items/RoutineBadge";
import type { RoutineRecord } from "@/data/model";
import type { PlannedDay } from "@/data/plans";
import { localizedDate } from "@/lib/dates";
import { useT } from "@/i18n/useT";

type Props = {
  open: boolean;
  /** The day the sheet is about (it follows the workout as it is stepped). */
  date: string;
  today: string;
  entry: PlannedDay | null;
  /** The routine its badge shows, if the day starts one. */
  routine: RoutineRecord | null;
  /** "Week 3 of 12" and similar, when the plan is a phase. */
  phase: string | null;
  /** The routine's line: exercises and length. */
  meta: string;
  /** Which way the date last stepped, for its slide: -1, 1 or 0. */
  direction: -1 | 0 | 1;
  canEarlier: boolean;
  canLater: boolean;
  busy: boolean;
  onStep: (direction: -1 | 1) => void;
  onDoToday: () => void;
  onSkip: () => void;
  onClose: () => void;
};

/**
 * A planned day from the week strip: ‹ and › step the workout one day at a
 * time (the strip above shows it move, the backdrop stays light), "Do this
 * workout today" brings it to today, and "Skip, make it a rest day" leaves an
 * Undo in the week card. No calendar dialog.
 */
export default function DaySheet({
  open,
  date,
  today,
  entry,
  routine,
  phase,
  meta,
  direction,
  canEarlier,
  canLater,
  busy,
  onStep,
  onDoToday,
  onSkip,
  onClose,
}: Props) {
  const { t } = useT();
  const dateText = localizedDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const title = dateText.charAt(0).toLocaleUpperCase() + dateText.slice(1);
  const status = [
    date === today ? t("home.today") : t("daySheet.planned"),
    phase,
  ]
    .filter(Boolean)
    .join(" · ");
  const name = entry?.title ?? "";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={status}
      backdrop="light"
      className="day-sheet"
    >
      <div className="day-sheet-head">
        <button
          type="button"
          className="day-step"
          aria-label={t("daySheet.earlier")}
          disabled={!canEarlier || busy}
          onClick={() => onStep(-1)}
        >
          <ChevronLeft size={26} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <div
          key={date}
          className="day-sheet-date"
          data-dir={direction || undefined}
          aria-hidden="true"
        >
          <strong>{title}</strong>
          <span className="row-sub">{status}</span>
        </div>
        <button
          type="button"
          className="day-step"
          aria-label={t("daySheet.later")}
          disabled={!canLater || busy}
          onClick={() => onStep(1)}
        >
          <ChevronRight size={26} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
      <div className="day-sheet-item">
        {routine ? (
          <RoutineBadge exercises={routine.payload.exercises} />
        ) : (
          <span className="day-sheet-tile" aria-hidden="true">
            {entry?.kind === "group" ? (
              <Layers size={26} />
            ) : (
              <Sparkles size={26} />
            )}
          </span>
        )}
        <span className="day-sheet-text">
          <strong>{name}</strong>
          {meta && <span className="row-sub">{meta}</span>}
        </span>
      </div>
      <div className="sheet-menu day-sheet-menu">
        {date !== today && (
          <button
            type="button"
            className="sheet-menu-item"
            disabled={busy}
            onClick={onDoToday}
          >
            <Play size={20} aria-hidden="true" />
            {t("daySheet.doToday")}
          </button>
        )}
        <button
          type="button"
          className="sheet-menu-item"
          disabled={busy}
          onClick={onSkip}
        >
          <Moon size={20} aria-hidden="true" />
          {t("daySheet.skip")}
        </button>
      </div>
      <button type="button" className="btn-primary btn-block" onClick={onClose}>
        {t("common.done")}
      </button>
    </Sheet>
  );
}
