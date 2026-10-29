import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { capturePointer } from "@/lib/pointer-capture";
import { coarsePointer, opensKeyboard } from "@/lib/touch";

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
  /** "full" is a near full-screen panel for editors; "sheet" is a short bottom sheet. */
  size?: "sheet" | "full";
};

/** How far (px) a sheet must be pulled, or how fast (px/ms) flicked, to close. */
const CLOSE_DISTANCE = 96;
const CLOSE_SPEED = 0.6;

/**
 * Lets the grab handle drag its sheet down. Past the distance or speed above,
 * releasing clicks the handle, so Radix closes the dialog and the close
 * animation continues from where the finger let go. A shorter drag springs
 * back. After any drag the browser's own trailing click is swallowed; a plain
 * tap still closes.
 */
function useDragToClose(content: React.RefObject<HTMLDivElement>) {
  const drag = React.useRef<{
    id: number;
    startY: number;
    lastY: number;
    lastT: number;
    speed: number;
    moved: boolean;
    close: boolean;
  } | null>(null);
  const suppressClick = React.useRef(false);
  const setOffset = (y: number, animate: boolean) => {
    const el = content.current;
    if (!el) return;
    el.style.transition = animate ? "translate var(--gt-motion)" : "none";
    el.style.translate = y ? `0 ${y}px` : "";
  };
  return {
    onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0) return;
      capturePointer(event.currentTarget, event.pointerId);
      drag.current = {
        id: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastT: event.timeStamp,
        speed: 0,
        moved: false,
        close: false,
      };
      suppressClick.current = false;
    },
    onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const dy = Math.max(0, event.clientY - d.startY);
      const dt = Math.max(1, event.timeStamp - d.lastT);
      d.speed = (event.clientY - d.lastY) / dt;
      d.lastY = event.clientY;
      d.lastT = event.timeStamp;
      if (dy > 4) d.moved = true;
      if (d.moved) setOffset(dy, false);
    },
    onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      drag.current = null;
      if (!d.moved) return;
      const dy = Math.max(0, event.clientY - d.startY);
      if (dy > CLOSE_DISTANCE || d.speed > CLOSE_SPEED)
        event.currentTarget.click();
      else setOffset(0, true);
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 400);
    },
    onPointerCancel() {
      drag.current = null;
      setOffset(0, true);
    },
    onClick(event: React.MouseEvent<HTMLButtonElement>) {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
      }
    },
  };
}

// Every dialog is a bottom sheet on phones and a centred panel from 640px up.
// The Close control is the sheet's grab handle: tap it or drag it down. It
// comes last in the markup so the first field or button still receives focus,
// and is drawn first.
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      backdrop = "dim",
      size = "sheet",
      onOpenAutoFocus,
      ...props
    },
    ref,
  ) => {
    const content = React.useRef<HTMLDivElement>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        (content as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    const handle = useDragToClose(content);
    return (
      <DialogPrimitive.Portal>
        <DialogOverlay data-backdrop={backdrop} />
        <DialogPrimitive.Content
          ref={setRefs}
          className={classes(
            `app-dialog dialog-content${size === "full" ? " dialog-full" : ""}`,
            className,
          )}
          {...props}
          onOpenAutoFocus={(event) => {
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented || !coarsePointer()) return;
            // On a touch screen a focused field opens the keyboard over the
            // sheet the moment it appears; focus the sheet itself instead.
            const first = content.current?.querySelector(
              "input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])",
            );
            if (!opensKeyboard(first ?? null)) return;
            event.preventDefault();
            content.current?.focus({ preventScroll: true });
          }}
        >
          {children}
          <DialogPrimitive.Close
            className="dialog-handle"
            aria-label="Close"
            {...handle}
          >
            <span className="dialog-handle-bar" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
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
