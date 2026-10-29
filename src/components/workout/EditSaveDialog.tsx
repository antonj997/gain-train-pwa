import ConfirmDialog from "@/components/ConfirmDialog";
import { countLabel } from "@/lib/labels";

type Props = {
  open: boolean;
  name: string;
  completed: number;
  total: number;
  invalidChecked: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirms saving an edit of a finished workout; unchecked sets are left out. */
export default function EditSaveDialog({
  open,
  name,
  completed,
  total,
  invalidChecked,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      tone="primary"
      title={<>Save changes to {name}?</>}
      description={
        <>
          {countLabel(completed, "completed set")} will be saved.
          {total > completed ? " Unchecked sets will be left out." : ""}
        </>
      }
      cancelLabel="Keep editing"
      confirmLabel={busy ? "Saving…" : "Save changes"}
      busy={busy}
      confirmDisabled={!completed || invalidChecked}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {completed < total && (
        <p className="completion-warning" role="alert">
          {countLabel(total - completed, "unchecked set")} will be left out.
        </p>
      )}
      {!completed && (
        <p className="completion-warning">
          Complete at least one set before saving.
        </p>
      )}
    </ConfirmDialog>
  );
}
