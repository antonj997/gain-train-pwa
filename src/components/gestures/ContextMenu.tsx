import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type MenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "danger";
  onSelect: () => void;
};

/** Room kept for the tab bar under a menu. */
const BOTTOM_INSET = 88;
const GUTTER = 16;

/**
 * The long-press menu: a small popover by the row it belongs to, the same
 * actions the row's ⋯ or page offers. A tap outside, Escape or Tab closes it
 * and focus goes back to the row; arrow keys move between items. Inside an
 * open sheet it renders in the sheet, so the sheet's focus trap allows it.
 */
export default function ContextMenu({
  anchor,
  title,
  label,
  items,
  onClose,
}: {
  /** The row it opened from, or null while closed. */
  anchor: HTMLElement | null;
  title: string;
  /** The menu's accessible name. */
  label: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(
    null,
  );
  const container =
    (anchor?.closest(".dialog-content") as HTMLElement | null) ??
    (typeof document === "undefined" ? null : document.body);

  useLayoutEffect(() => {
    const el = menu.current;
    if (!anchor || !el) {
      setPlace(null);
      return;
    }
    const row = anchor.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const floor = window.innerHeight - BOTTOM_INSET;
    const below = row.bottom + 4 + box.height <= floor;
    let top = below ? row.bottom + 4 : Math.max(GUTTER, row.top - 4 - box.height);
    let left = Math.min(
      Math.max(GUTTER, row.left + 56),
      window.innerWidth - GUTTER - box.width,
    );
    // A sheet moved by a transform is the fixed menu's frame.
    if (container && container !== document.body) {
      const style = getComputedStyle(container);
      if (style.transform !== "none" || (style.translate && style.translate !== "none")) {
        const frame = container.getBoundingClientRect();
        top -= frame.top;
        left -= frame.left;
      }
    }
    setPlace({ top, left });
    el.querySelector<HTMLElement>("[role=menuitem]")?.focus({
      preventScroll: true,
    });
  }, [anchor, container]);

  // Focus goes back to the row it came from.
  useEffect(() => {
    if (!anchor) return;
    const focusable = anchor.matches("a, button")
      ? anchor
      : anchor.querySelector<HTMLElement>("a, button");
    return () => focusable?.focus({ preventScroll: true });
  }, [anchor]);

  if (!anchor || !container) return null;
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = Array.from(
      menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [],
    );
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      all[(at + step + all.length) % all.length]?.focus();
    }
  };
  return createPortal(
    <>
      <div
        className="context-menu-backdrop"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menu}
        className="context-menu"
        role="menu"
        aria-label={label}
        style={
          place
            ? { top: place.top, left: place.left }
            : { top: 0, left: 0, visibility: "hidden" }
        }
        onKeyDown={move}
      >
        <div className="context-menu-title" aria-hidden="true">
          {title}
        </div>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className="context-menu-item"
            data-tone={item.tone}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
            {item.icon}
          </button>
        ))}
      </div>
    </>,
    container,
  );
}
