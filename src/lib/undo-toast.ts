import { toast } from "sonner";
import { errorMessage } from "./errors";

/** Confirms a removal with an Undo action; a failed undo explains what to do. */
export function toastWithUndo(
  message: string,
  undo: () => Promise<unknown>,
  undoFailed: string,
) {
  toast(message, {
    action: {
      label: "Undo",
      onClick: () => {
        void undo().catch((cause) =>
          toast.error(errorMessage(cause, undoFailed)),
        );
      },
    },
  });
}
