import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { dismissTip, getTipState, subscribeTips } from "@/lib/tip-store";
import { tipPlacement } from "@/lib/tips";
import { useT } from "@/i18n/useT";

/** Room the tab bar takes; a bubble never goes under it. */
const BOTTOM_INSET = 88;

/**
 * The one-time tip showing now: a small accent bubble with an arrow at its
 * element and Ok. It is a polite live region, so a screen reader reads it
 * without moving focus. It follows its element as the page scrolls and goes
 * when the element is used, Ok is tapped or something blocks tips (a focused
 * field, a drag, a sheet, the language prompt).
 */
export default function Tips() {
  const { t } = useT();
  const { current, target } = useSyncExternalStore(
    subscribeTips,
    getTipState,
    getTipState,
  );
  const bubble = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<ReturnType<typeof tipPlacement> | null>(
    null,
  );
  useLayoutEffect(() => {
    if (!current || !target) {
      setPlace(null);
      return;
    }
    let frame = 0;
    let last = "";
    const follow = () => {
      const el = bubble.current;
      if (el) {
        const box = target.getBoundingClientRect();
        const size = el.getBoundingClientRect();
        const next = tipPlacement({
          target: box,
          bubble: { width: size.width, height: size.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          bottomInset: BOTTOM_INSET,
        });
        const key = `${next.side}${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.arrow)}`;
        if (key !== last) {
          last = key;
          setPlace(next);
        }
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [current, target]);

  return (
    <div className="tips-live" role="status" aria-live="polite">
      {current && target && (
        <div
          ref={bubble}
          className="tip-bubble"
          data-tip={current}
          data-side={place?.side ?? "below"}
          style={
            place
              ? { top: place.top, left: place.left }
              : { top: 0, left: 0, visibility: "hidden" }
          }
        >
          <span
            className="tip-arrow"
            aria-hidden="true"
            style={{ left: place?.arrow ?? 24 }}
          />
          <span className="sr-only">{t("tips.label")}: </span>
          <span className="tip-text">{t(`tips.${current}`)}</span>
          <button
            type="button"
            className="tip-ok"
            onClick={() => dismissTip(current)}
          >
            {t("tips.ok")}
          </button>
        </div>
      )}
    </div>
  );
}
