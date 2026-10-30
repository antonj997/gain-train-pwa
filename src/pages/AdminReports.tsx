import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bug, ChevronLeft, Image as ImageIcon, Lightbulb } from "lucide-react";
import { useData } from "@/contexts/useData";
import FacetChips from "@/components/FacetChips";
import PageHeader from "@/components/PageHeader";
import ReportDetailSheet from "@/components/admin/ReportDetailSheet";
import StatusChip from "@/components/admin/StatusChip";
import ListRow from "@/components/ui/ListRow";
import { fetchAllReports } from "@/data/feedback";
import { useAdmin } from "@/hooks/useAdmin";
import {
  FEEDBACK_STATUSES,
  filterReports,
  relativeAge,
  statusCounts,
  type FeedbackKind,
  type FeedbackRow,
  type StatusFilter,
} from "@/lib/feedback";
import { useT } from "@/i18n/useT";

/** Settings → Admin: every report, filtered by status and kind, with a detail sheet. */
export default function AdminReports() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { online } = useData();
  const { isAdmin } = useAdmin();
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [kind, setKind] = useState<FeedbackKind | "">("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetchAllReports()
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (isAdmin && online) load();
  }, [isAdmin, online, load]);

  const shown = useMemo(
    () => filterReports(rows ?? [], status, kind),
    [rows, status, kind],
  );
  const counts = useMemo(() => statusCounts(rows ?? []), [rows]);
  const report = rows?.find((r) => r.id === selected) ?? null;
  const back = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/settings");
  };
  const header = (
    <PageHeader
      eyebrow={t("admin.eyebrow")}
      title={t("admin.title")}
      notices={false}
      leading={
        <button
          type="button"
          className="icon-btn"
          aria-label={t("common.back")}
          onClick={back}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      }
    />
  );

  if (isAdmin === false)
    return (
      <div className="page admin-page">
        {header}
        <div className="empty-card" role="status">
          <h2>{t("admin.notAvailableTitle")}</h2>
          <p>{t("admin.notAvailableText")}</p>
          <Link to="/settings" className="btn-secondary">
            {t("admin.backToSettings")}
          </Link>
        </div>
      </div>
    );

  const note =
    isAdmin === undefined
      ? online
        ? t("admin.loading")
        : t("admin.offline")
      : !rows
        ? failed
          ? t("admin.loadFailed")
          : online
            ? t("admin.loading")
            : t("admin.offline")
        : !shown.length
          ? t("admin.empty")
          : "";
  const now = Date.now();
  const filters: StatusFilter[] = [...FEEDBACK_STATUSES, "all"];
  return (
    <div className="page admin-page">
      {header}
      <div className="facet-chips" role="group" aria-label={t("admin.status")}>
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            className="filter-chip"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value === "all" ? t("admin.all") : t(`feedback.status.${value}`)}
            {rows && value !== "all" && (
              <span className="chip-count">{counts[value]}</span>
            )}
          </button>
        ))}
      </div>
      <FacetChips
        name={t("admin.kinds")}
        allLabel={t("admin.allKinds")}
        options={["bug", "feature"]}
        format={(k) => (k === "bug" ? t("admin.bugs") : t("admin.features"))}
        value={kind}
        onChange={(k) => setKind(k as FeedbackKind | "")}
      />
      {note ? (
        <p className="empty" role="status">
          {note}
          {failed && !rows && (
            <>
              {" "}
              <button type="button" className="text-button" onClick={load}>
                {t("common.retry")}
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="list">
          {shown.map((row) => (
            <ListRow
              key={row.id}
              className="report-row"
              leading={
                <span
                  className={"report-kind " + row.kind}
                  role="img"
                  aria-label={
                    row.kind === "bug"
                      ? t("feedback.bug")
                      : t("feedback.feature")
                  }
                >
                  {row.kind === "bug" ? (
                    <Bug size={18} aria-hidden="true" />
                  ) : (
                    <Lightbulb size={18} aria-hidden="true" />
                  )}
                </span>
              }
              title={row.title}
              sub={
                <>
                  {t("admin.sentBy", {
                    who:
                      row.reporter_name ||
                      row.reporter_email ||
                      t("admin.someone"),
                    when: relativeAge(row.created_at, now, locale),
                  })}
                  {row.images.length > 0 && (
                    <span className="report-images-count">
                      {" · "}
                      <ImageIcon size={13} aria-hidden="true" />
                      {t("feedback.imageCount", { count: row.images.length })}
                    </span>
                  )}
                </>
              }
              trailing={
                status === "all" ? <StatusChip status={row.status} /> : null
              }
              chevron
              onClick={() => setSelected(row.id)}
            />
          ))}
        </div>
      )}
      <ReportDetailSheet
        report={report}
        onClose={() => setSelected(null)}
        onUpdated={(change) =>
          setRows(
            (current) =>
              current?.map((r) =>
                r.id === change.id ? { ...r, ...change } : r,
              ) ?? null,
          )
        }
        onDeleted={(id) => {
          setSelected(null);
          setRows((current) => current?.filter((r) => r.id !== id) ?? null);
        }}
      />
    </div>
  );
}
