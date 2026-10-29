import { toast } from "sonner";
import { errorMessage } from "./errors";
import { t } from "../i18n";

/** Confirms a removal with an Undo action; a failed undo explains what to do. */
export function toastWithUndo(
  message: string,
  undo: () => Promise<unknown>,
  undoFailed: string,
) {
  toast(message, {
    action: {
      label: t("undo.label"),
      onClick: () => {
        void undo().catch((cause) =>
          toast.error(errorMessage(cause, undoFailed)),
        );
      },
    },
  });
}
