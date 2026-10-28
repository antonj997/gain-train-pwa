import type { ReactNode, Ref } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional line under the title; it also describes the dialog to assistive technology. */
  description?: ReactNode;
  /** "light" dims the page only slightly, so it stays readable behind the sheet. */
  backdrop?: "dim" | "light";
  className?: string;
  contentRef?: Ref<HTMLDivElement>;
  /** Runs before Escape closes the sheet; call preventDefault to keep it open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  children: ReactNode;
};

/**
 * A bottom sheet on phones and a centred panel from 640px up, built on the
 * shared Radix dialog. It closes on a tap outside, Escape and the handle.
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  backdrop,
  className,
  contentRef,
  onEscapeKeyDown,
  children,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        ref={contentRef}
        backdrop={backdrop}
        className={className}
        onEscapeKeyDown={onEscapeKeyDown}
        // Without a description Radix warns about a missing one in development.
        {...(description === undefined
          ? { "aria-describedby": undefined }
          : {})}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
