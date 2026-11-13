import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { foldAway, growIn } from "@/lib/presence";
import { settled } from "@/lib/motion";

/**
 * An inline message that opens and closes in the flow: when its content
 * appears it grows open (height and a fade, 220ms) and pushes what is under
 * it down; when the content goes it folds away (180ms) before it leaves.
 * Changing the text in place just shows the new text.
 *
 *   <Reveal>{error && <p className="field-error" role="alert">{error}</p>}</Reveal>
 */
export default function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const present = !!children || children === 0;
  const kept = useRef<ReactNode>(null);
  if (present) kept.current = children;
  // Re-renders once the fold has ended and the last content is let go.
  const [, setGone] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const fold = useRef<Animation | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (first) return;
    if (present) {
      fold.current?.cancel();
      fold.current = null;
      growIn(box.current);
      return;
    }
    const el = box.current;
    if (!el) return;
    const animation = foldAway(el);
    fold.current = animation;
    void settled(animation).then(() => {
      if (fold.current !== animation) return;
      fold.current = null;
      kept.current = null;
      setGone((n) => n + 1);
    });
  }, [present]);
  if (!present && kept.current === null) return null;
  return (
    <div
      ref={box}
      className={"reveal" + (className ? ` ${className}` : "")}
      aria-hidden={present ? undefined : true}
    >
      {present ? children : kept.current}
    </div>
  );
}
