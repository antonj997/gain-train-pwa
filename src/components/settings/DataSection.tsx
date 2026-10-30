import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import ListRow from "@/components/ui/ListRow";
import { importSummary } from "@/data/actions";
import {
  MAX_BACKUP_BYTES,
  backupFileName,
  parseBackup,
  serializeBackup,
} from "@/lib/backup";
import { errorMessage } from "@/lib/errors";
import { requestPersistentStorage } from "@/lib/persistence";
import { t } from "@/i18n";

/** "Your data": export and restore a backup, and ask the browser to keep the log. */
export default function DataSection() {
  const { state, importRecords } = useData();
  const [importing, setImporting] = useState(false);
  const [protectedStorage, setProtectedStorage] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void (
      globalThis.navigator?.storage?.persisted?.() ?? Promise.resolve(false)
    )
      .then((value) => active && setProtectedStorage(value))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const exportData = async () => {
    try {
      const text = serializeBackup(Object.values(state.records));
      const name = backupFileName();
      // An installed iPhone app cannot download a file; the share sheet can
      // save it to Files instead.
      const file = new File([text], name, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: t("data.backupTitle"),
          });
          toast.success(t("data.exported"));
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      // Slow devices can still be reading the file a second later.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(t("data.savedAs", { name }));
    } catch (error) {
      toast.error(errorMessage(error, t("data.exportFailed")));
    }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw Error(t("data.tooBig"));
      const records = parseBackup(await file.text());
      toast.success(importSummary(await importRecords(records)));
    } catch (e) {
      toast.error(errorMessage(e, t("data.restoreFailed")));
    } finally {
      setImporting(false);
    }
  };
  const keepOnDevice = async () => {
    try {
      const ok = await requestPersistentStorage();
      setProtectedStorage(ok);
      toast(ok ? t("data.persistOn") : t("data.persistAuto"));
    } catch {
      toast.error(t("data.persistFailed"));
    }
  };

  return (
    <section>
      <h2 className="group-title">{t("data.title")}</h2>
      <div className="list">
        <ListRow
          title={t("data.export")}
          chevron
          onClick={() => void exportData()}
        />
        <label className="row row-file">
          <span className="row-main">
            <span className="row-title">
              {importing ? t("data.restoring") : t("data.restore")}
            </span>
          </span>
          <ChevronRight className="chev" size={20} aria-hidden="true" />
          <input
            className="sr-only"
            type="file"
            accept=".json,application/json"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void restore(file);
            }}
          />
        </label>
        <ListRow
          title={t("data.storage")}
          onClick={() => void keepOnDevice()}
          trailing={
            protectedStorage === null ? undefined : (
              <span
                className={"stat-chip " + (protectedStorage ? "done" : "warm")}
              >
                {protectedStorage
                  ? t("data.protected")
                  : t("data.notProtected")}
              </span>
            )
          }
        />
      </div>
    </section>
  );
}
