import { CalendarClock, Play } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/useT";

/**
 * "Log workout" from Train's done card opens a new workout on this choice:
 * another workout today (its clock already runs) or an earlier one, which
 * stops the clock and opens the details sheet for its date and length.
 * Closing the sheet keeps today's.
 */
export default function LogChoiceSheet({
  open,
  onToday,
  onEarlier,
}: {
  open: boolean;
  onToday: () => void;
  onEarlier: () => void;
}) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onToday} title={t("logChoice.title")}>
      <div className="sheet-menu log-choice">
        <button type="button" className="sheet-menu-item" onClick={onToday}>
          <Play size={20} aria-hidden="true" />
          <span className="log-choice-text">
            {t("logChoice.today")}
            <span className="row-sub">{t("logChoice.todayHint")}</span>
          </span>
        </button>
        <button type="button" className="sheet-menu-item" onClick={onEarlier}>
          <CalendarClock size={20} aria-hidden="true" />
          <span className="log-choice-text">
            {t("logChoice.earlier")}
            <span className="row-sub">{t("logChoice.earlierHint")}</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
