import ConfirmDialog from "@/components/ConfirmDialog";
import { countLabel } from "@/lib/labels";
import { useT } from "@/i18n/useT";

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
  const { t } = useT();
  return (
    <ConfirmDialog
      open={open}
      tone="primary"
      title={t("workout.saveChangesTitle", { name })}
      description={
        <>
          {t("workout.willBeSaved", {
            sets: countLabel(completed, "completed set"),
          })}
          {total > completed ? " " + t("workout.uncheckedLeftOut") : ""}
        </>
      }
      cancelLabel={t("workout.keepEditing")}
      confirmLabel={busy ? t("workout.saving") : t("workout.saveChanges")}
      busy={busy}
      confirmDisabled={!completed || invalidChecked}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {completed < total && (
        <p className="completion-warning" role="alert">
          {t("workout.leftOut", {
            sets: countLabel(total - completed, "unchecked set"),
          })}
        </p>
      )}
      {!completed && (
        <p className="completion-warning">{t("workout.completeOne")}</p>
      )}
    </ConfirmDialog>
  );
}
