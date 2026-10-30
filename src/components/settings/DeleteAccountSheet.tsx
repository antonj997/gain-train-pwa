import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import Sheet from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/errors";
import { removeProfileCache } from "@/lib/profile";
import { t } from "@/i18n";

/** Asks for "DELETE" (or "RADERA") before deleting the account; it stays open while deleting. */
export default function DeleteAccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { account, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [deleteError, setDeleteError] = useState(""),
    [wasOpen, setWasOpen] = useState(open);
  // Each opening starts with an empty confirmation and no old error.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setConfirmation("");
      setDeleteError("");
    }
  }
  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!deleting) onClose();
      }}
      title={t("deleteAccount.title")}
      description={t("deleteAccount.description")}
    >
      <label>
        {t("deleteAccount.typeToConfirm", { word: t("deleteAccount.word") })}
        <input
          value={confirmation}
          autoComplete="off"
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      {deleteError && (
        <p role="alert" className="error-text">
          {deleteError}
        </p>
      )}
      <button className="btn-secondary" disabled={deleting} onClick={onClose}>
        {t("deleteAccount.keep")}
      </button>
      <button
        className="btn-danger"
        disabled={
          deleting ||
          confirmation.trim().toLocaleUpperCase() !== t("deleteAccount.word") ||
          !navigator.onLine
        }
        onClick={async () => {
          setDeleting(true);
          setDeleteError("");
          try {
            await deleteAccount();
            removeProfileCache(account);
            onClose();
            toast.success(t("deleteAccount.deleted"));
          } catch (error) {
            setDeleteError(errorMessage(error, t("deleteAccount.failed")));
          } finally {
            setDeleting(false);
          }
        }}
      >
        {deleting ? t("deleteAccount.deleting") : t("deleteAccount.confirm")}
      </button>
    </Sheet>
  );
}
