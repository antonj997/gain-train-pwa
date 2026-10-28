import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Base classes live in styles/primitives.css; callers add their own.
const classes = (base: string, extra?: string) =>
  extra ? `${base} ${extra}` : base;

const Dialog = DialogPrimitive.Root;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={classes("dialog-overlay", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  /** How strongly the page behind is dimmed: "light" keeps it readable. */
  backdrop?: "dim" | "light";
};

// Every dialog is a bottom sheet on phones and a centred panel from 640px up.
// The Close control is the sheet's grab handle. It comes last in the markup so
// the first field or button still receives focus, and is drawn first.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, backdrop = "dim", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay data-backdrop={backdrop} />
    <DialogPrimitive.Content
      ref={ref}
      className={classes("app-dialog dialog-content", className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="dialog-handle" aria-label="Close">
        <span className="dialog-handle-bar" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={classes("dialog-header", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={classes("dialog-title", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={classes("dialog-description", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
