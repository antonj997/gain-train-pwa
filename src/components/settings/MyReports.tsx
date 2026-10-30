import { useEffect, useState } from "react";
import { useData } from "@/contexts/useData";
import StatusChip from "@/components/admin/StatusChip";
import { fetchMyReports } from "@/data/feedback";
import { relativeAge, type FeedbackRow } from "@/lib/feedback";
import { useT } from "@/i18n/useT";

/** The user's own reports with their status and the admin's reply, under the feedback form. */
export default function MyReports({
  active,
  userId,
  refresh,
}: {
  /** Fetch while the sheet is open. */
  active: boolean;
  userId: string;
  /** Changes after a report was sent, to fetch again. */
  refresh: number;
}) {
  const { online } = useData();
  const { t, locale } = useT();
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active || !online || !userId) return;
    let current = true;
    setFailed(false);
    fetchMyReports(userId)
      .then((next) => current && setRows(next))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [active, online, userId, refresh]);

  const note =
    !online && !rows
      ? t("feedback.mineOffline")
      : failed && !rows
        ? t("feedback.mineFailed")
        : !rows
          ? t("feedback.mineLoading")
          : !rows.length
            ? t("feedback.mineEmpty")
            : "";
  const now = Date.now();
  return (
    <section className="my-reports" aria-labelledby="my-reports-title">
      <h2 id="my-reports-title" className="group-title">
        {t("feedback.mine")}
      </h2>
      {note ? (
        <p className="small-note" role="status">
          {note}
        </p>
      ) : (
        <ul className="list">
          {rows!.map((row) => (
            <li key={row.id} className="row my-report">
              <span className="row-main">
                <span className="row-title">{row.title}</span>
                <span className="row-sub">
                  {(row.kind === "bug"
                    ? t("feedback.bug")
                    : t("feedback.feature")) +
                    " · " +
                    relativeAge(row.created_at, now, locale)}
                </span>
                {row.admin_note && (
                  <span className="row-sub my-report-reply">
                    {t("feedback.reply", { note: row.admin_note })}
                  </span>
                )}
              </span>
              <StatusChip status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
