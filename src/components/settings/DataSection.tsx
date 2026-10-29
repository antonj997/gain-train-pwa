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
          await navigator.share({ files: [file], title: "Gain Train backup" });
          toast.success("Backup exported");
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
      toast.success(`Backup saved as ${name}`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not export a backup."));
    }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw Error("Choose a backup smaller than 20 MB.");
      const records = parseBackup(await file.text());
      toast.success(importSummary(await importRecords(records)));
    } catch (e) {
      toast.error(errorMessage(e, "Could not restore backup"));
    } finally {
      setImporting(false);
    }
  };
  const keepOnDevice = async () => {
    try {
      const ok = await requestPersistentStorage();
      setProtectedStorage(ok);
      toast(
        ok
          ? "Persistent storage enabled"
          : "Your browser manages storage automatically. Keep a backup too.",
      );
    } catch {
      toast.error(
        "Your browser could not enable persistent storage. Export a backup to keep a separate copy.",
      );
    }
  };

  return (
    <section>
      <h2 className="group-title">Your data</h2>
      <div className="list">
        <ListRow
          title="Export a backup"
          chevron
          onClick={() => void exportData()}
        />
        <label className="row row-file">
          <span className="row-main">
            <span className="row-title">
              {importing ? "Restoring…" : "Restore a backup"}
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
          title="Storage on this device"
          onClick={() => void keepOnDevice()}
          trailing={
            protectedStorage === null ? undefined : (
              <span
                className={"stat-chip " + (protectedStorage ? "done" : "warm")}
              >
                {protectedStorage ? "Protected" : "Not protected"}
              </span>
            )
          }
        />
      </div>
    </section>
  );
}
