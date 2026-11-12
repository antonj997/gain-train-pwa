import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
import { useSwipe } from "@/hooks/useSwipe";
import { bubbleScale, commitThreshold, type SwipeConfig } from "@/lib/swipe";
import { motionMs } from "@/lib/slow-motion";
import { registerTipTarget } from "@/lib/tip-store";
import { reducedMotion } from "@/hooks/useMessages";
import { EASE, MOTION, play as playMotion, settled } from "@/lib/motion";

/** The parts of the delete, in ms: the row out and the bubble's gulp side by side, then the collapse. */
const SET_DELETE_TIMING = {
  slide: MOTION.binSlide,
  bubble: MOTION.binGulp,
  collapse: MOTION.rowOut,
};

const finished = (animation: Animation, ms: number) =>
  Promise.race([
    animation.finished.then(
      () => {},
      () => {},
    ),
    // A backgrounded tab may never finish an animation.
    new Promise<void>((resolve) => setTimeout(resolve, motionMs(ms + 300))),
  ]);

/**
 * A set row that deletes with a swipe to the left (never to the right: a set
 * is checked only with its ✓). A round red bubble with a bin grows at the
 * trailing edge as the row follows the finger; at the threshold it snaps to
 * full size with a pop and a ring. Released past it, the row slides out,
 * the bubble gulps (1.12) and shrinks away, and only then does the row fold
 * up and the rows under it slide up. About 0.6 s; no undo. Past the
 * threshold the row brakes (0.35 px per px), and a fling to the left (over
 * 0.5 px/ms) deletes short of it. The Set sheet's Delete plays the same
 * (`register`). With reduced motion the row fades out. A new set's row
 * (`entering`) grows in from nothing, then calls `onEntered`.
 */
function SetSwipeRow({
  setId,
  companions = [],
  onDelete,
  register,
  tip,
  entering = false,
  onEntered,
  children,
}: {
  setId: string;
  /** Drops that go with this set: they fold up with it. */
  companions?: string[];
  onDelete: (setId: string) => void;
  /** Hands the card this row's delete, for the Set sheet. */
  register: (setId: string, play: (() => void) | null) => void;
  tip?: boolean;
  /** Just added: grows in from no height (200 ms) when it mounts. */
  entering?: boolean;
  /** The grow-in ended (or there was none to play). */
  onEntered?: (setId: string) => void;
  children: ReactNode;
}) {
  const bubble = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const deleting = useRef(false);
  const companionsRef = useRef(companions);
  companionsRef.current = companions;
  const config = (width: number): SwipeConfig => ({
    left: {
      kind: "commit",
      threshold: commitThreshold(width),
      max: Math.round(width * 0.7),
      band: 0.35,
      fling: 0.5,
    },
  });
  const setBubble = (scale: number) => {
    if (bubble.current) bubble.current.style.transform = `scale(${scale})`;
  };
  const pop = () => {
    const b = bubble.current;
    const r = ring.current;
    if (reducedMotion() || !b || typeof b.animate !== "function") return;
    b.animate(
      [
        { transform: "scale(0.82)" },
        { transform: "scale(1.16)" },
        { transform: "scale(1)" },
      ],
      { duration: MOTION.arm, easing: "ease-out" },
    );
    r?.animate(
      [
        { transform: "scale(0.8)", opacity: 0.55 },
        { transform: "scale(1.9)", opacity: 0 },
      ],
      { duration: MOTION.ring, easing: "ease-out" },
    );
  };

  const play = async (fromSheet: boolean) => {
    const box = swipe.rootRef.current;
    const front = swipe.frontRef.current;
    if (deleting.current || !box || !front) return;
    deleting.current = true;
    box.dataset.deleting = "";
    const card = box.closest(".ex-card") ?? document;
    const others = companionsRef.current
      .map((id) =>
        card.querySelector<HTMLElement>(`[data-set-swipe="${CSS.escape(id)}"]`),
      )
      .filter((el): el is HTMLElement => !!el);
    const all = [box, ...others];
    if (reducedMotion() || typeof box.animate !== "function") {
      // Reduced motion: the row (and its drops) just fade out.
      if (typeof box.animate === "function")
        await Promise.all(
          all.map((el) =>
            finished(
              el.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: MOTION.reduced,
                fill: "forwards",
              }),
              MOTION.reduced,
            ),
          ),
        );
      onDelete(setId);
      return;
    }
    const width = box.getBoundingClientRect().width;
    const b = bubble.current!;
    if (fromSheet) {
      // From the sheet: the bubble comes up first, as a swipe would draw it.
      box.dataset.side = "left";
      setBubble(1);
      pop();
      await finished(
        front.animate(
          [
            { transform: "translate3d(0, 0, 0)" },
            { transform: `translate3d(${-commitThreshold(width)}px, 0, 0)` },
          ],
          { duration: MOTION.binLead, easing: "ease-out", fill: "forwards" },
        ),
        MOTION.binLead,
      );
    }
    const from = fromSheet ? -commitThreshold(width) : swipe.offset();
    const { slide, bubble: gulp, collapse } = SET_DELETE_TIMING;
    const out = front.animate(
      [
        { transform: `translate3d(${from}px, 0, 0)`, opacity: 1 },
        { transform: `translate3d(${-width - 24}px, 0, 0)`, opacity: 0.4 },
      ],
      {
        duration: slide,
        easing: EASE.in,
        fill: "forwards",
      },
    );
    for (const el of others)
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: slide,
        fill: "forwards",
      });
    // The gulp: a quick swell as the row goes in, then gone.
    const swallow = b.animate(
      [
        { transform: "scale(1)", offset: 0 },
        { transform: "scale(1.12)", offset: 0.36 },
        { transform: "scale(0)", offset: 1 },
      ],
      {
        duration: gulp,
        easing: EASE.gulp,
        fill: "forwards",
      },
    );
    await Promise.all([finished(out, slide), finished(swallow, gulp)]);
    setBubble(0);
    // Only now does the space close, so nothing overlaps.
    await Promise.all(
      all.map((el) =>
        finished(
          el.animate(
            [
              { height: `${el.getBoundingClientRect().height}px` },
              { height: "0px" },
            ],
            {
              duration: collapse,
              easing: EASE.collapse,
              fill: "forwards",
            },
          ),
          collapse,
        ),
      ),
    );
    onDelete(setId);
  };
  const playRef = useRef(play);
  playRef.current = play;

  const swipe = useSwipe({
    config,
    tip: tip ? "swipeSet" : undefined,
    // With reduced motion the bubble does not grow: it is simply there.
    onDrag: (offset, progress, armed) =>
      setBubble(
        reducedMotion() ? (offset < 0 ? 1 : 0) : bubbleScale(progress, armed),
      ),
    onArm: (armed) => {
      if (armed) pop();
    },
    onCommit: () => {
      void playRef.current(false);
      return true;
    },
    onSettle: (result) => {
      if (result.action !== "close") return;
      const b = bubble.current;
      const from = b?.style.transform || "scale(0)";
      setBubble(0);
      if (b && !reducedMotion() && typeof b.animate === "function")
        b.animate([{ transform: from }, { transform: "scale(0)" }], {
          duration: MOTION.pop,
          easing: "ease-out",
        });
    },
  });

  // The first set row is where the swipe tip points.
  useEffect(() => {
    const box = swipe.rootRef.current;
    if (tip && box) return registerTipTarget("swipeSet", box);
  }, [tip, swipe.rootRef]);
  useEffect(() => {
    register(setId, () => void playRef.current(true));
    return () => register(setId, null);
  }, [register, setId]);
  // A new row grows from no height to its own, fading in.
  const enteredRef = useRef(onEntered);
  enteredRef.current = onEntered;
  useLayoutEffect(() => {
    const box = swipe.rootRef.current;
    if (!entering || !box) return;
    const height = box.getBoundingClientRect().height;
    box.style.overflow = "hidden";
    const grow = playMotion(
      box,
      [
        { height: "0px", opacity: 0 },
        { height: `${height}px`, opacity: 1 },
      ],
      { duration: MOTION.rowIn, easing: "ease-out" },
    );
    void settled(grow).then(() => {
      box.style.overflow = "";
      enteredRef.current?.(setId);
    });
    // Only on mount: the row is new once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={swipe.rootRef} className="set-swipe" data-set-swipe={setId}>
      <span className="set-bin" aria-hidden="true">
        <span ref={ring} className="set-bin-ring" />
        <span ref={bubble} className="set-bin-bubble">
          <Trash2 size={18} strokeWidth={2.2} />
        </span>
      </span>
      <div ref={swipe.frontRef} className="swipe-front set-swipe-front">
        {children}
      </div>
    </div>
  );
}

export default memo(SetSwipeRow);
