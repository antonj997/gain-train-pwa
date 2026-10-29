import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import Sheet from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/errors";
import { removeProfileCache } from "@/lib/profile";

/** Asks for "DELETE" before deleting the account; it stays open while deleting. */
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
      title="Delete your account?"
      description="This permanently deletes your account and all associated workouts, routines and exercises from the server and this device. This cannot be undone. Export a backup first if you want to keep your log. Downloaded backups and offline copies on other devices cannot be remotely erased."
    >
      <label>
        Type DELETE to confirm
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
        Keep account
      </button>
      <button
        className="btn-danger"
        disabled={deleting || confirmation !== "DELETE" || !navigator.onLine}
        onClick={async () => {
          setDeleting(true);
          setDeleteError("");
          try {
            await deleteAccount();
            removeProfileCache(account);
            onClose();
            toast.success("Account deleted");
          } catch (error) {
            setDeleteError(errorMessage(error, "Could not delete account."));
          } finally {
            setDeleting(false);
          }
        }}
      >
        {deleting ? "Deleting…" : "Permanently delete account"}
      </button>
    </Sheet>
  );
}
