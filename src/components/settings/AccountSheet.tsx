import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import Sheet from "@/components/ui/Sheet";
import { copySummary } from "@/data/actions";
import { errorMessage } from "@/lib/errors";

/** The signed-in account: sync state, Sync now and copying the phone-only log. */
export default function AccountSheet({
  open,
  onClose,
  dirty,
}: {
  open: boolean;
  onClose: () => void;
  dirty: number;
}) {
  const { user } = useAuth();
  const { sync, syncing, online, syncHealth, copyPhoneLog } = useData();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Account"
      description={user?.email}
    >
      <p className="row-sub">
        {dirty
          ? `${dirty} changes waiting to sync${!online ? " when you reconnect" : ""}.`
          : "Your local log is up to date."}
        {syncHealth.lastSyncedAt &&
          ` Last synced ${new Date(syncHealth.lastSyncedAt).toLocaleString(
            undefined,
            {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            },
          )}.`}
      </p>
      <button
        className="btn-secondary"
        disabled={syncing || !online}
        onClick={() => void sync()}
      >
        <RefreshCw size={18} aria-hidden="true" />
        {syncing ? "Syncing…" : online ? "Sync now" : "Connect to sync"}
      </button>
      <button
        className="btn-quiet"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            toast.success(copySummary(await copyPhoneLog()));
          } catch (error) {
            toast.error(
              errorMessage(
                error,
                "Could not copy this phone’s log. Try again.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Copy this phone's unsigned-in workouts to my account
      </button>
    </Sheet>
  );
}
