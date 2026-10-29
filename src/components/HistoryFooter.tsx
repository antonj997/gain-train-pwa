import { X } from "lucide-react";

/** The caption line under both calendar views, with Clear only when something is chosen. */
export default function HistoryFooter({
  caption,
  canReset,
  resetTitle,
  onReset,
}: {
  caption: string;
  canReset: boolean;
  resetTitle: string;
  onReset: () => void;
}) {
  return (
    <div className="history-footer">
      <p className="history-caption" aria-live="polite">
        {caption}
      </p>
      {canReset && (
        <button
          type="button"
          className="text-button calendar-reset"
          title={resetTitle}
          onClick={onReset}
        >
          <X size={14} aria-hidden="true" />
          Clear selection
        </button>
      )}
    </div>
  );
}
