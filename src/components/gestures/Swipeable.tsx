import { useRef, type ReactNode } from "react";
import { Play } from "lucide-react";
import { useSwipe } from "@/hooks/useSwipe";
import { commitThreshold, type SwipeConfig } from "@/lib/swipe";
import type { TipId } from "@/lib/tips";
import { reducedMotion } from "@/hooks/useMessages";

/** Each revealed button's width. */
export const ACTION_WIDTH = 80;

export type SwipeAction = {
  key: string;
  label: string;
  icon: ReactNode;
  tone?: "danger";
  onSelect: () => void;
};

/**
 * A boxed item that swipes: right reveals a green Start layer and releasing
 * past the threshold starts; left reveals buttons (More, Delete; Repeat,
 * Delete) and stays open on them. Every one of these has a visible button or
 * ⋯ entry elsewhere, so the layers are hidden from assistive technology.
 */
export default function Swipeable({
  start,
  actions,
  tip,
  className,
  children,
}: {
  start?: { label: string; onStart: () => void; disabled?: boolean };
  actions?: SwipeAction[];
  tip?: TipId;
  className?: string;
  children: ReactNode;
}) {
  const label = useRef<HTMLSpanElement>(null);
  const startRef = useRef(start);
  startRef.current = start;
  const config = (width: number): SwipeConfig => ({
    right:
      startRef.current && !startRef.current.disabled
        ? {
            kind: "commit",
            threshold: commitThreshold(width),
            max: Math.round(width * 0.6),
          }
        : null,
    left: actions?.length
      ? {
          kind: "reveal",
          threshold: Math.min(64, actions.length * ACTION_WIDTH * 0.4),
          max: actions.length * ACTION_WIDTH,
        }
      : null,
  });
  const swipe = useSwipe({
    config,
    tip,
    onDrag: (offset, progress) => {
      if (offset > 0)
        swipe.rootRef.current?.style.setProperty(
          "--swipe-progress",
          String(progress),
        );
    },
    onArm: (armed, side) => {
      const el = label.current;
      if (side !== "right" || !el) return;
      el.classList.toggle("is-armed", armed);
      if (armed && !reducedMotion() && typeof el.animate === "function")
        el.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.18)" },
            { transform: "scale(1)" },
          ],
          { duration: 220, easing: "ease-out" },
        );
    },
    onCommit: (side) => {
      if (side === "right") startRef.current?.onStart();
    },
    onSettle: () => label.current?.classList.remove("is-armed"),
  });
  const open = swipe.open === "left";
  return (
    <div
      ref={swipe.rootRef}
      className={"swipe" + (className ? ` ${className}` : "")}
      data-swipe=""
    >
      {start && (
        <div className="swipe-start" aria-hidden="true">
          <span ref={label} className="swipe-start-label">
            <Play size={15} fill="currentColor" stroke="none" />
            {start.label}
          </span>
        </div>
      )}
      {!!actions?.length && (
        <div
          className="swipe-actions"
          style={{ width: actions.length * ACTION_WIDTH }}
          aria-hidden={!open}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className="swipe-action"
              data-tone={action.tone}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                swipe.close();
                action.onSelect();
              }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
      <div ref={swipe.frontRef} className="swipe-front">
        {children}
      </div>
    </div>
  );
}
