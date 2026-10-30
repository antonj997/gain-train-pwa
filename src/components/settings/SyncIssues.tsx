import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { recordLabel } from "@/data/model";
import { errorMessage } from "@/lib/errors";
import { kindName, versionSummary } from "@/lib/record-summary";
import { t } from "@/i18n";

/** Sync problems that need the user: records parked for a newer app, changes the server rejected, and conflicts. */
export default function SyncIssues() {
  const { state, sync, online, resolve, retryRejected } = useData();
  const conflicts = Object.values(state.records).filter((r) => r.conflict);
  const rejected = Object.values(state.records).filter((r) => r.syncError);
  const parked = Object.keys(state.quarantine ?? {}).length;
  const choose = async (id: string, mine: boolean) => {
    try {
      await resolve(id, mine);
    } catch (error) {
      toast.error(errorMessage(error, t("issues.choiceFailed")));
    }
  };

  return (
    <>
      {parked > 0 && (
        <div className="banner">{t("issues.parked", { count: parked })}</div>
      )}
      {rejected.length > 0 && (
        <section className="card col-12">
          <h2 className="card-title">{t("issues.rejectedTitle")}</h2>
          <p className="row-sub">
            These stay saved on this phone. Editing one sends it again; Retry
            sends them all, for example after an app update.
          </p>
          <ul className="sync-rejections">
            {rejected.map((r) => (
              <li key={r.id}>
                <strong>{recordLabel(r)}</strong>
                <small>{r.syncError}</small>
              </li>
            ))}
          </ul>
          <button
            className="btn-secondary"
            disabled={!online}
            onClick={async () => {
              try {
                await retryRejected();
                void sync();
              } catch (error) {
                toast.error(errorMessage(error, t("issues.retryFailed")));
              }
            }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {t("common.retry")}
          </button>
        </section>
      )}
      {conflicts.map((r) => (
        <section key={r.id} className="card col-12">
          <h2 className="card-title">{t("issues.chooseTitle")}</h2>
          <p className="row-sub">
            {t("issues.changedElsewhere", {
              kind: kindName(r.kind),
              name: recordLabel(r),
            })}
          </p>
          <ul className="sync-rejections">
            <li>
              <strong>{t("issues.thisPhone")}</strong>
              <small>{versionSummary(r.kind, r.payload, r.deleted)}</small>
            </li>
            <li>
              <strong>{t("issues.server")}</strong>
              <small>
                {versionSummary(
                  r.conflict!.kind,
                  r.conflict!.payload,
                  r.conflict!.deleted,
                )}
              </small>
            </li>
          </ul>
          <button
            className="btn-secondary"
            onClick={() => void choose(r.id, false)}
          >
            {t("issues.useServer")}
          </button>
          <button
            className="btn-secondary"
            onClick={() => void choose(r.id, true)}
          >
            {t("issues.keepPhone")}
          </button>
        </section>
      ))}
    </>
  );
}
