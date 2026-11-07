import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import {
  dismissMessage,
  markMessageShown,
  registerMessageSlot,
  undoMessage,
  unregisterMessageSlot,
} from "@/lib/message-store";
import { messageRole, type PageMessage } from "@/lib/messages";
import { motionMs } from "@/lib/slow-motion";
import { reducedMotion, useMessageState } from "@/hooks/useMessages";
import { t } from "@/i18n";

const EMPTY: readonly PageMessage[] = [];
const OPEN_MS = 240;

/**
 * Where banners show: under a page header, the workout's top bar or an open
 * sheet's title. Only the topmost mounted slot draws them. A banner opens by
 * growing its height, so the content under it moves down instead of being
 * covered, and closes the same way.
 */
export default function MessageSlot({ priority = 1 }: { priority?: number }) {
  const [id, setId] = useState<number | null>(null);
  useLayoutEffect(() => {
    const slot = registerMessageSlot(priority);
    setId(slot);
    return () => unregisterMessageSlot(slot);
  }, [priority]);
  const state = useMessageState();
  const messages = id !== null && state.active === id ? state.messages : EMPTY;
  const [leaving, setLeaving] = useState<PageMessage[]>([]);
  const previous = useRef<readonly PageMessage[]>(EMPTY);
  useLayoutEffect(() => {
    const gone = previous.current.filter(
      (m) => !messages.some((n) => n.id === m.id),
    );
    previous.current = messages;
    if (gone.length) setLeaving((list) => [...list, ...gone]);
  }, [messages]);
  return (
    <div className="page-messages" data-message-slot={priority}>
      {leaving.map((m) => (
        <MessageBanner
          key={`l${m.id}`}
          message={m}
          leaving
          onGone={() =>
            setLeaving((list) => list.filter((item) => item.id !== m.id))
          }
        />
      ))}
      {messages.map((m) => (
        <MessageBanner key={m.id} message={m} />
      ))}
    </div>
  );
}

function MessageBanner({
  message: m,
  leaving = false,
  onGone,
}: {
  message: PageMessage;
  leaving?: boolean;
  onGone?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // Opens from zero height: the content under it slides down.
  useLayoutEffect(() => {
    if (leaving) return;
    markMessageShown(m.id);
    const el = wrap.current;
    if (!el || reducedMotion() || typeof el.animate !== "function") return;
    const height = el.getBoundingClientRect().height;
    el.animate(
      [
        { height: "0px", opacity: 0 },
        { height: `${height}px`, opacity: 1 },
      ],
      { duration: OPEN_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    // Once per banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Closes to zero height, then leaves the DOM.
  useEffect(() => {
    if (!leaving) return;
    const el = wrap.current;
    if (!el || reducedMotion() || typeof el.animate !== "function") {
      onGone?.();
      return;
    }
    const height = el.getBoundingClientRect().height;
    const animation = el.animate(
      [
        { height: `${height}px`, opacity: 1 },
        { height: "0px", opacity: 0 },
      ],
      { duration: OPEN_MS, easing: "ease-in", fill: "forwards" },
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onGone?.();
    };
    animation.finished.then(finish, finish);
    // A backgrounded tab may never run the animation.
    const fallback = window.setTimeout(finish, motionMs(OPEN_MS + 400));
    return () => window.clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);
  const Icon =
    m.tone === "error" ? AlertCircle : m.tone === "success" ? Check : Info;
  return (
    <div
      ref={wrap}
      className="page-message-wrap"
      aria-hidden={leaving || undefined}
    >
      {m.undo ? (
        <div
          className="undo-placeholder in-slot"
          role="status"
          data-message={m.id}
        >
          <span className="undo-text">{m.text}</span>
          <button
            type="button"
            className="undo-button"
            disabled={leaving}
            onClick={() => undoMessage(m.id)}
          >
            {t("undo.label")}
          </button>
          <UndoTimer ms={m.ms} />
        </div>
      ) : (
        <div
          className="page-message"
          data-tone={m.tone}
          data-message={m.id}
          role={messageRole(m.tone)}
        >
          <Icon className="page-message-icon" size={18} aria-hidden="true" />
          <span className="page-message-text">{m.text}</span>
          {m.action && (
            <button
              type="button"
              className="page-message-action"
              disabled={leaving}
              onClick={() => {
                dismissMessage(m.id);
                m.action?.run();
              }}
            >
              {m.action.label}
            </button>
          )}
          {(m.sticky || m.tone === "error") && (
            <button
              type="button"
              className="page-message-close"
              aria-label={t("messages.dismiss")}
              disabled={leaving}
              onClick={() => dismissMessage(m.id)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The line under an undo placeholder that runs out with its time. `ms` is
 * unscaled: slow motion slows the animation itself.
 */
export function UndoTimer({
  ms,
  startAt = 1,
}: {
  ms: number;
  startAt?: number;
}) {
  const line = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = line.current;
    if (!el || typeof el.animate !== "function" || !(ms > 0)) return;
    el.animate(
      [{ transform: `scaleX(${startAt})` }, { transform: "scaleX(0)" }],
      { duration: ms, easing: "linear", fill: "forwards" },
    );
    // Once: the time left is set when it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span ref={line} className="undo-timer" aria-hidden="true" />;
}
