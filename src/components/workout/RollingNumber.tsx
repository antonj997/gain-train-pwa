import { useLayoutEffect, useRef, useState } from "react";
import { MOTION, play, settled } from "@/lib/motion";

/**
 * A number that rolls when it changes: the old one slides 8 px up and out
 * as the new one comes 8 px from below (the other way when it goes down),
 * 160 ms. Reduced motion: a fade. Screen readers hear only the new number.
 */
export default function RollingNumber({ value }: { value: number }) {
  const [shown, setShown] = useState<{ value: number; old: number | null }>({
    value,
    old: null,
  });
  if (shown.value !== value) setShown({ value, old: shown.value });
  const fresh = useRef<HTMLSpanElement>(null);
  const stale = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (shown.old === null) return;
    const up = shown.value > shown.old ? 1 : -1;
    play(
      fresh.current,
      [
        { transform: `translateY(${8 * up}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: MOTION.roll },
    );
    const out = play(
      stale.current,
      [
        { transform: "none", opacity: 1 },
        { transform: `translateY(${-8 * up}px)`, opacity: 0 },
      ],
      { duration: MOTION.roll, fill: "forwards" },
    );
    const now = shown.value;
    void settled(out).then(() =>
      setShown((s) => (s.value === now ? { ...s, old: null } : s)),
    );
  }, [shown]);
  return (
    <span className="rolling-number">
      <span ref={fresh} key={shown.value}>
        {shown.value}
      </span>
      {shown.old !== null && (
        <span ref={stale} className="rolling-old" aria-hidden="true">
          {shown.old}
        </span>
      )}
    </span>
  );
}
