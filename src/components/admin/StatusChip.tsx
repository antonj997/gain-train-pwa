import type { FeedbackStatus } from "@/lib/feedback";
import { t } from "@/i18n";

const tone: Record<FeedbackStatus, string> = {
  open: "",
  planned: " warm",
  done: " done",
  wontfix: " muted",
};

/** A report's status as a small pill: Open, Planned, Done or Won't fix. */
export default function StatusChip({ status }: { status: FeedbackStatus }) {
  return (
    <span className={"stat-chip" + tone[status]}>
      {t(`feedback.status.${status}`)}
    </span>
  );
}
