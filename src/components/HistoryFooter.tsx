import { X } from "lucide-react";
import { t } from "@/i18n";

/**
 * Under both calendar views: what the marks mean (Workout, Planned, Today),
 * then the caption line, with Clear only when something is chosen. The
 * caption is left out while History shows the chosen period on its own.
 */
export default function HistoryFooter({
  caption,
  canReset,
  resetTitle,
  onReset,
}: {
  caption: string | null;
  canReset: boolean;
  resetTitle: string;
  onReset: () => void;
}) {
  return (
    <div className="history-footer">
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
          <span className="legend-mark is-today" aria-hidden="true" />
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
    </div>
  );
}
