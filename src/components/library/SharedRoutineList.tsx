import { Link } from "react-router-dom";
import type { SharedRoutineStatus } from "@/hooks/useSharedRoutines";
import {
  sharedRoutineSummary,
  type SharedRoutineRow,
} from "@/lib/shared-routines";
import { sharedByLine } from "@/lib/display-name";
import { countLabel } from "@/lib/labels";
import { t } from "@/i18n";

const PREVIEW_NAMES = 3;

/** Library → Routines → Shared: routines people shared, each with Add. */
export default function SharedRoutineList({
  canShare,
  ready,
  status,
  hasRows,
  rows,
  added,
  adding,
  onRetry,
  onAdd,
}: {
  /** Signed in, so shared routines can be read. */
  canShare: boolean;
  /** Signed in and online. */
  ready: boolean;
  status: SharedRoutineStatus;
  /** Rows were fetched before, so a failed refresh still shows them. */
  hasRows: boolean;
  rows: SharedRoutineRow[];
  /** Ids of shared routines the user already has a copy of. */
  added: ReadonlySet<string>;
  /** The id being added, or "". */
  adding: string;
  onRetry: () => void;
  onAdd: (id: string) => void;
}) {
  if (!ready)
    return (
      <p className="empty" role="status">
        {canShare ? (
          t("sharedRoutines.offline")
        ) : (
          <>
            {t("sharedRoutines.signIn")}{" "}
            <Link className="text-button" to="/auth">
              {t("shared.signInLink")}
            </Link>
          </>
        )}
      </p>
    );
  if (status === "loading" && !hasRows)
    return (
      <p className="empty" role="status">
        {t("sharedRoutines.loading")}
      </p>
    );
  if (status === "error" && !hasRows)
    return (
      <p className="empty" role="status">
        {t("sharedRoutines.loadFailed")}{" "}
        <button type="button" className="text-button" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </p>
    );
  if (!rows.length)
    return (
      <p className="empty" role="status">
        {t("sharedRoutines.empty")}
      </p>
    );
  return (
    <div className="list">
      {rows.map((row) => {
        const { count, names } = sharedRoutineSummary(row);
        const preview =
          names.slice(0, PREVIEW_NAMES).join(", ") +
          (names.length > PREVIEW_NAMES ? " …" : "");
        const isAdded = added.has(row.id);
        return (
          <div className="row exercise-row shared-routine-row" key={row.id}>
            <span className="row-main">
              <span className="row-title exercise-name">
                {row.name}
                {row.mine && (
                  <span className="stat-chip">{t("exercises.yours")}</span>
                )}
              </span>
              {!row.mine && (
                <span className="row-sub">{sharedByLine(row.by_name)}</span>
              )}
              <span className="row-sub">
                {countLabel(count, "exercise")}
                {preview && ` · ${preview}`}
              </span>
              {row.note && <span className="row-sub">{row.note}</span>}
            </span>
            {!row.mine &&
              (isAdded ? (
                <span className="row-value">{t("sharedRoutines.added")}</span>
              ) : (
                <button
                  type="button"
                  className="unhide"
                  aria-label={t("shared.addNamed", { name: row.name })}
                  disabled={!!adding || !count}
                  onClick={() => onAdd(row.id)}
                >
                  {adding === row.id ? t("shared.adding") : t("shared.add")}
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}
