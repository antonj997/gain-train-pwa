import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import Sheet from "@/components/ui/Sheet";
import { copySummary } from "@/data/actions";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";
import { localizedMoment } from "@/lib/dates";

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
      title={t("account.title")}
      description={user?.email}
    >
      <p className="row-sub">
        {dirty
          ? t(online ? "account.waiting" : "account.waitingOffline", {
              count: dirty,
            })
          : t("account.upToDate")}
        {syncHealth.lastSyncedAt &&
          " " +
            t("account.lastSynced", {
              when: localizedMoment(syncHealth.lastSyncedAt, {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              }),
            })}
      </p>
      <button
        className="btn-secondary"
        disabled={syncing || !online}
        onClick={() => void sync()}
      >
        <RefreshCw size={18} aria-hidden="true" />
        {syncing
          ? t("account.syncing")
          : online
            ? t("account.syncNow")
            : t("account.connect")}
      </button>
      <button
        className="btn-quiet"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            toast.success(copySummary(await copyPhoneLog()));
          } catch (error) {
            toast.error(errorMessage(error, t("account.copyFailed")));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("account.copyPhone")}
      </button>
    </Sheet>
  );
}
