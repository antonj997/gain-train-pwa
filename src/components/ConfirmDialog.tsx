import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  /** Disables both buttons and keeps the dialog open while work runs. */
  busy?: boolean;
  confirmDisabled?: boolean;
  /** "danger" for removals (cancel first); "primary" for saves (confirm first). */
  tone?: "danger" | "primary";
  /** Extra content between the description and the buttons. */
  children?: ReactNode;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  confirmDisabled = false,
  tone = "danger",
  children,
}: Props) {
  const cancel = (
    <button className="secondary" disabled={busy} onClick={onCancel}>
      {cancelLabel}
    </button>
  );
  const confirm = (
    <button
      className={tone === "danger" ? "secondary danger" : "primary"}
      disabled={busy || confirmDisabled}
      onClick={onConfirm}
    >
      {confirmLabel}
    </button>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {tone === "danger" ? (
          <>
            {cancel}
            {confirm}
          </>
        ) : (
          <>
            {confirm}
            {cancel}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
