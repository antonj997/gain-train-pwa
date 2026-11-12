import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { capturePointer } from "@/lib/pointer-capture";
import { MOTION, SPRING, play, playSpring } from "@/lib/motion";
import {
  CLOSE_SPEED,
  FLING_EASE,
  closeDuration,
  dragIntent,
  holdsScroll,
  releaseSpeed,
  sheetOffset,
  sheetRelease,
} from "@/lib/sheet-drag";
import { coarsePointer, opensKeyboard } from "@/lib/touch";
import { t } from "@/i18n";
import MessageSlot from "@/components/messages/MessageSlot";

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

/** Where a press must not start a sheet drag: fields and things that drag themselves. */
const OWN_GESTURE =
  "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-sheet-drag]";
function ownsGesture(target: Element, sheet: HTMLElement) {
  if (target.closest(OWN_GESTURE)) return true;
  // A sort handle or any other control that takes the touch for itself.
  for (
    let el: Element | null = target;
    el && el !== sheet;
    el = el.parentElement
  )
    if (getComputedStyle(el).touchAction === "none") return true;
  return false;
}

/** Whether the press is inside something scrolled down (the sheet or a list in it). */
function scrolledDown(target: Element, sheet: HTMLElement) {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
    if (el === sheet) break;
  }
  return false;
}

const phoneSheet = () =>
  typeof window.matchMedia !== "function" ||
  !window.matchMedia("(min-width: 640px)").matches;

type Drag = {
  id: number;
  x0: number;
  y0: number;
  fromTop: boolean;
  /** Nothing under the finger was scrolled down when it pressed. */
  atTop: boolean;
  dragging: boolean;
  offset: number;
  samples: { y: number; t: number }[];
};

/**
 * Drags a bottom sheet down with the finger, 1:1: from the handle or the
 * title at any time, and from anywhere else while the content is scrolled to
 * its top (a scrolled list scrolls first). The backdrop lightens as it goes.
 * Let go past 90px or flicked down faster than 0.6 px/ms, it closes from
 * where it is (as fast as the finger was going); otherwise it springs back
 * (stiffness 380, damping 34) from the finger's speed. Pointer events drive
 * it; a touchmove listener only keeps iOS from scrolling while it may be a
 * drag. The click after a drag is swallowed; a tap on the handle closes.
 */
function useSheetDrag(
  close: React.RefObject<HTMLButtonElement>,
  overlay: React.RefObject<HTMLDivElement>,
) {
  const detach = React.useRef<(() => void) | null>(null);
  return React.useCallback(
    (sheet: HTMLDivElement | null) => {
      detach.current?.();
      detach.current = null;
      if (typeof sheet?.addEventListener !== "function") return;
      let g: Drag | null = null;
      let back: Animation | null = null;
      let swallowUntil = 0;
      // Set while the sheet tells the pressed element that the press is over.
      let handing = false;
      const setOffset = (y: number) => {
        sheet.style.translate = y ? `0 ${y}px` : "";
        const scrim = overlay.current;
        if (scrim) {
          const h = sheet.offsetHeight || 1;
          scrim.style.opacity = y > 0 ? String(Math.max(0, 1 - y / h)) : "";
        }
      };
      const down = (event: PointerEvent) => {
        if (!event.isPrimary || !phoneSheet()) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const target = event.target as Element;
        const onHandle = !!close.current?.contains(target);
        if (!onHandle && ownsGesture(target, sheet)) return;
        g = {
          id: event.pointerId,
          x0: event.clientX,
          y0: event.clientY,
          fromTop: onHandle || !!target.closest(".dialog-header"),
          atTop: !scrolledDown(target, sheet),
          dragging: false,
          offset: 0,
          samples: [{ y: event.clientY, t: event.timeStamp }],
        };
      };
      const move = (event: PointerEvent) => {
        if (!g || event.pointerId !== g.id) return;
        if (!g.dragging) {
          const intent = dragIntent({
            dx: event.clientX - g.x0,
            dy: event.clientY - g.y0,
            fromTop: g.fromTop,
            atTop: g.atTop,
          });
          if (intent === "pending") return;
          if (intent === "none") {
            g = null;
            return;
          }
          // From here the sheet is under the finger: no jump by the slop.
          g.dragging = true;
          // What was pressed lets go: a row's hold timer, a button's press.
          handing = true;
          try {
            event.target?.dispatchEvent(
              new PointerEvent("pointercancel", {
                bubbles: true,
                pointerId: g.id,
                pointerType: event.pointerType,
                isPrimary: true,
              }),
            );
          } finally {
            handing = false;
          }
          g.y0 = event.clientY;
          back?.cancel();
          back = null;
          capturePointer(sheet, g.id);
          sheet.classList.add("is-dragging");
          overlay.current?.classList.add("is-dragging");
        }
        g.samples.push({ y: event.clientY, t: event.timeStamp });
        if (g.samples.length > 12) g.samples.shift();
        g.offset = sheetOffset(event.clientY - g.y0);
        setOffset(g.offset);
      };
      const settle = (gesture: Drag, speed: number) => {
        sheet.classList.remove("is-dragging");
        overlay.current?.classList.remove("is-dragging");
        swallowUntil = performance.now() + 400;
        if (sheetRelease(gesture.offset, speed) === "close") {
          // The close animation (CSS, data-state="closed") runs from here,
          // for what is left of the way and no slower than the fling.
          const ms = closeDuration(gesture.offset, sheet.offsetHeight, speed);
          sheet.style.animationDuration = `${ms}ms`;
          if (speed > CLOSE_SPEED)
            sheet.style.animationTimingFunction = FLING_EASE;
          swallowUntil = 0;
          close.current?.click();
          return;
        }
        const from = gesture.offset;
        setOffset(0);
        if (overlay.current)
          play(
            overlay.current,
            [
              { opacity: Math.max(0, 1 - from / (sheet.offsetHeight || 1)) },
              { opacity: 1 },
            ],
            {
              duration: MOTION.scrim,
              easing: "linear",
            },
          );
        back = playSpring(
          sheet,
          SPRING.settle,
          from,
          0,
          (y) => ({ translate: `0 ${y}px` }),
          // The spring starts at the finger's speed (px/s).
          { velocity: speed * 1000 },
        );
      };
      const up = (event: PointerEvent) => {
        if (!g || event.pointerId !== g.id) return;
        const gesture = g;
        g = null;
        if (!gesture.dragging) return;
        // A finger that stopped before it lifted has no speed left.
        gesture.samples.push({ y: event.clientY, t: event.timeStamp });
        settle(gesture, releaseSpeed(gesture.samples));
      };
      const cancel = (event: PointerEvent) => {
        if (handing || !g || event.pointerId !== g.id) return;
        const gesture = g;
        g = null;
        if (gesture.dragging) settle({ ...gesture, offset: 0 }, 0);
      };
      // iOS scrolls unless the first touchmove is cancelled; keep the content
      // still while the press may yet be a drag, and while it is one.
      const touchMove = (event: TouchEvent) => {
        if (!g || !event.cancelable) return;
        const touch = event.touches[0];
        if (!touch) return;
        if (
          g.dragging ||
          holdsScroll({
            dx: touch.clientX - g.x0,
            dy: touch.clientY - g.y0,
            fromTop: g.fromTop,
            atTop: g.atTop,
          })
        )
          event.preventDefault();
      };
      const click = (event: MouseEvent) => {
        if (performance.now() < swallowUntil) {
          swallowUntil = 0;
          event.preventDefault();
          event.stopPropagation();
        }
      };
      sheet.addEventListener("pointerdown", down);
      sheet.addEventListener("pointermove", move);
      sheet.addEventListener("pointerup", up);
      sheet.addEventListener("pointercancel", cancel);
      sheet.addEventListener("touchmove", touchMove, { passive: false });
      sheet.addEventListener("click", click, true);
      detach.current = () => {
        back?.cancel();
        sheet.removeEventListener("pointerdown", down);
        sheet.removeEventListener("pointermove", move);
        sheet.removeEventListener("pointerup", up);
        sheet.removeEventListener("pointercancel", cancel);
        sheet.removeEventListener("touchmove", touchMove);
        sheet.removeEventListener("click", click, true);
      };
    },
    [close, overlay],
  );
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
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const attachDrag = useSheetDrag(closeRef, overlayRef);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        (content as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
        attachDrag(node);
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref, attachDrag],
    );
    return (
      <DialogPrimitive.Portal>
        <DialogOverlay ref={overlayRef} data-backdrop={backdrop} />
        <DialogPrimitive.Content
          ref={setRefs}
          className={classes(
            `app-dialog dialog-content${size === "full" ? " dialog-full" : ""}`,
            className,
          )}
          {...props}
          onOpenAutoFocus={(event) => {
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented) return;
            const first = content.current?.querySelector(
              "input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])",
            );
            // A full sheet's first control is its Close (×): focused on open,
            // Safari rings it. The sheet itself takes focus; Tab reaches Close.
            // On a touch screen a focused field opens the keyboard over the
            // sheet the moment it appears, so it gets the same.
            if (
              !first?.classList.contains("dialog-close") &&
              !(coarsePointer() && opensKeyboard(first ?? null))
            )
              return;
            event.preventDefault();
            content.current?.focus({ preventScroll: true });
          }}
        >
          {children}
          <DialogPrimitive.Close
            ref={closeRef}
            className="dialog-handle"
            aria-label={t("dialog.close")}
          >
            <span className="dialog-handle-bar" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

// An open sheet's messages show under its title, over the page's.
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <>
    <div className={classes("dialog-header", className)} {...props} />
    <MessageSlot priority={2} />
  </>
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

/** A visible Close (×) for a full sheet's header; the grab handle closes too. */
const DialogCloseButton = () => (
  <DialogPrimitive.Close
    className="icon-btn dialog-close"
    aria-label={t("dialog.close")}
    title={t("dialog.close")}
  >
    <X size={20} aria-hidden="true" />
  </DialogPrimitive.Close>
);

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
};
