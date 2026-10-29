import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ExercisePickerBody, {
  type PickerOptions,
} from "@/components/picker/ExercisePickerBody";

/**
 * The exercise picker dialog. Its list, search and filters live in the body,
 * which Radix mounts only while the dialog is open (and closing), so a closed
 * picker costs nothing and every opening starts fresh.
 */
export default function ExercisePicker({
  open,
  onClose,
  ...options
}: PickerOptions & { open: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  // The body sets this while it saves a new exercise; closing waits for it.
  const busy = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy.current) onClose();
      }}
    >
      <DialogContent
        ref={content}
        size="full"
        className="picker-dialog"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.querySelector<HTMLElement>(".picker-title")?.focus();
        }}
      >
        <ExercisePickerBody {...options} onClose={onClose} busyRef={busy} />
      </DialogContent>
    </Dialog>
  );
}
