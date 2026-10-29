import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { recordLabel } from "@/data/model";
import { errorMessage } from "@/lib/errors";
import { kindName, versionSummary } from "@/lib/record-summary";

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
      toast.error(errorMessage(error, "Could not save your choice."));
    }
  };

  return (
    <>
      {parked > 0 && (
        <div className="banner">
          {parked === 1
            ? "1 synced record needs"
            : `${parked} synced records need`}{" "}
          a newer version of Gain Train. Close and reopen the app to update;
          they appear once it can read them.
        </div>
      )}
      {rejected.length > 0 && (
        <section className="card col-12">
          <h2 className="card-title">Changes the server didn't accept</h2>
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
                toast.error(errorMessage(error, "Could not retry."));
              }
            }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Retry
          </button>
        </section>
      )}
      {conflicts.map((r) => (
        <section key={r.id} className="card col-12">
          <h2 className="card-title">Choose which version to keep</h2>
          <p className="row-sub">
            {kindName(r.kind)} “{recordLabel(r)}” changed on another device.
            Export a backup first to keep your local version separately.
          </p>
          <ul className="sync-rejections">
            <li>
              <strong>This phone</strong>
              <small>{versionSummary(r.kind, r.payload, r.deleted)}</small>
            </li>
            <li>
              <strong>Server</strong>
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
            Use server version
          </button>
          <button
            className="btn-secondary"
            onClick={() => void choose(r.id, true)}
          >
            Keep this phone's version
          </button>
        </section>
      ))}
    </>
  );
}
