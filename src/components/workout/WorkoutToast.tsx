import { useEffect, useLayoutEffect, useRef } from "react";
import { Info } from "lucide-react";
import { EASE, MOTION, play } from "@/lib/motion";
import { motionMs } from "@/lib/slow-motion";
import { useT } from "@/i18n/useT";
import { toastMs, type WorkoutToastMessage } from "./workout-toast";

/**
 * The toast at the live workout's foot (v6 B2, B13): one line and, when it
 * can be undone, Ångra. It rises in over the banner time and leaves by
 * itself after 4 s (5 s with Ångra); a new one replaces it.
 */
export default function WorkoutToast({
  message,
  onDone,
}: {
  /** The message and a key that changes with every new one. */
  message: (WorkoutToastMessage & { id: number }) | null;
  onDone: () => void;
}) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const id = message?.id;
  useLayoutEffect(() => {
    if (id === undefined) return;
    play(
      box.current,
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: MOTION.bannerIn, easing: EASE.out },
    );
  }, [id]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(
      () => done.current(),
      motionMs(toastMs(message)),
    );
    return () => window.clearTimeout(timer);
    // A new message (its id) restarts the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!message) return null;
  return (
    <div
      ref={box}
      key={message.id}
      className="workout-toast"
      role="status"
      // Taps here leave the number pad and the fields where they were.
      data-pad-keep=""
    >
      <Info size={18} aria-hidden="true" />
      <span className="workout-toast-text">{message.text}</span>
      {message.undo && (
        <button
          type="button"
          className="workout-toast-undo"
          onClick={() => {
            message.undo?.();
            done.current();
          }}
        >
          {t("undo.label")}
        </button>
      )}
    </div>
  );
}
