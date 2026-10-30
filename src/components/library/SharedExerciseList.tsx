import type { SharedStatus } from "@/hooks/useSharedExercises";
import type { LibraryExercise } from "@/lib/library";
import { t } from "@/i18n";
import { categoryLabel, equipmentLabel } from "@/lib/catalogue-labels";

/** Library → Exercises → Shared: what other people shared, each with Add. */
export default function SharedExerciseList({
  canShare,
  ready,
  status,
  hasRows,
  items,
  narrowed,
  adding,
  onRetry,
  onAdd,
}: {
  canShare: boolean;
  /** Signed in and online. */
  ready: boolean;
  status: SharedStatus;
  /** Rows were fetched before, so a failed refresh still shows them. */
  hasRows: boolean;
  items: LibraryExercise[];
  /** A search or a facet narrows the list. */
  narrowed: boolean;
  /** The id being added, or "". */
  adding: string;
  onRetry: () => void;
  onAdd: (id: string) => void;
}) {
  if (!ready)
    return (
      <p className="empty" role="status">
        {canShare ? t("shared.offline") : t("shared.signIn")}
      </p>
    );
  if (status === "loading" && !hasRows)
    return (
      <p className="empty" role="status">
        {t("shared.loading")}
      </p>
    );
  if (status === "error" && !hasRows)
    return (
      <p className="empty" role="status">
        {t("shared.loadFailed")}{" "}
        <button type="button" className="text-button" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </p>
    );
  if (!items.length)
    return (
      <p className="empty" role="status">
        {narrowed ? t("shared.noMatch") : t("shared.nothingNew")}
      </p>
    );
  return (
    <div className="list">
      {items.map((e) => (
        <div className="row exercise-row" key={e.id}>
          <span className="row-main">
            <span className="row-title exercise-name">{e.name}</span>
            <span className="row-sub">
              {[
                categoryLabel(e.category),
                e.equipment && equipmentLabel(e.equipment),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <button
            type="button"
            className="unhide"
            aria-label={t("shared.addNamed", { name: e.name })}
            disabled={!!adding}
            onClick={() => onAdd(e.id)}
          >
            {adding === e.id ? t("shared.adding") : t("shared.add")}
          </button>
        </div>
      ))}
    </div>
  );
}
