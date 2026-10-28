import type { ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";

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
    <Sheet
      open={open}
      title={title}
      description={description}
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
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
    </Sheet>
  );
}
