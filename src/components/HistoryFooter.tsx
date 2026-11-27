import { X } from "lucide-react";
import { t } from "@/i18n";

/**
 * Under both calendar views: the compact grid's hint while nothing is
 * chosen, what the marks mean (Workout, Planned, Today: a dot in the compact
 * grid, a ring in the month), then the caption line, with Clear only when
 * something is chosen, and the active plan's line. The caption is left out
 * while History shows the chosen period on its own.
 */
export default function HistoryFooter({
  caption,
  canReset,
  resetTitle,
  onReset,
  compact = false,
  hint = false,
  planLine,
}: {
  caption: string | null;
  canReset: boolean;
  resetTitle: string;
  onReset: () => void;
  /** The compact grid, where today is a dot (C1). */
  compact?: boolean;
  /** "Håll in och dra …", while nothing is chosen in the compact grid. */
  hint?: boolean;
  /** The active plan's line, "Styrkeblock: 13 pass sedan 19 okt". */
  planLine?: string | null;
}) {
  return (
    <div className="history-footer">
      {hint && <p className="history-hint">{t("history.dragHint")}</p>}
      <ul className="calendar-legend" aria-label={t("history.legend")}>
        <li>
          <span className="legend-mark is-trained" aria-hidden="true" />
          {t("history.legendWorkout")}
        </li>
        <li>
          <span className="legend-mark is-planned" aria-hidden="true" />
          {t("history.legendPlanned")}
        </li>
        <li>
          <span
            className={"legend-mark " + (compact ? "is-today-dot" : "is-today")}
            aria-hidden="true"
          />
          {t("history.legendToday")}
        </li>
      </ul>
      {(caption !== null || canReset) && (
        <div className="history-caption-line">
          {caption !== null && (
            <p className="history-caption" aria-live="polite">
              {caption}
            </p>
          )}
          {canReset && (
            <button
              type="button"
              className="text-button calendar-reset"
              title={resetTitle}
              onClick={onReset}
            >
              <X size={14} aria-hidden="true" />
              {t("history.clearSelection")}
            </button>
          )}
        </div>
      )}
      {compact && planLine && <p className="history-plan-line">{planLine}</p>}
    </div>
  );
}
