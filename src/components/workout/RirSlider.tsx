import {
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { capturePointer, releasePointer } from "@/lib/pointer-capture";
import { RIR_VALUES, RIR_TOP, rirValueText, type Rir } from "@/lib/rir";
import {
  RIR_TEXT,
  RIR_VALUE_TEXT,
  rirFromPosition,
  rirKey,
} from "@/lib/rir-slider";
import { t } from "@/i18n";

/** The thumb's size: its centre travels half of it in from each end. */
const THUMB = 44;
/** The keys the slider takes (rirKey). */
const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
type Vars = CSSProperties & Record<`--${string}`, number>;

/**
 * The number pad's RIR slider (v6 B12): 0 (max) to 5+ (easy), stepping at
 * each whole number. Drag the 44px thumb, tap anywhere on the track, or use
 * the arrow keys, Home and End. The thumb moves on transform over
 * --gt-dur-quick (it jumps under reduced motion); the line under it says
 * what the value means.
 */
export default function RirSlider({
  value,
  onChange,
}: {
  value: Rir | null;
  onChange: (value: Rir) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const at = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return value ?? 0;
    return rirFromPosition(clientX - box.left - THUMB / 2, box.width - THUMB);
  };
  const set = (next: Rir) => {
    if (next !== value) onChange(next);
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging.current = event.pointerId;
    capturePointer(event.currentTarget, event.pointerId);
    set(at(event.clientX));
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current !== event.pointerId) return;
    set(at(event.clientX));
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    releasePointer(event.currentTarget, event.pointerId);
  };
  const key = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!KEYS.includes(event.key)) return;
    event.preventDefault();
    // The pad's own keyboard handler must not type this key as well.
    event.stopPropagation();
    const next = rirKey(value, event.key);
    if (next !== null) set(next);
  };
  const shown = value ?? null;
  // An unset thumb waits in the middle, showing "–".
  const position = (shown ?? 2) / RIR_TOP;
  const valueText = t(RIR_VALUE_TEXT[shown ?? "unset"]);
  return (
    <div className="rir-slider">
      <div
        ref={track}
        className="rir-track"
        role="slider"
        tabIndex={0}
        aria-label={t("pad.rirSlider")}
        aria-valuemin={0}
        aria-valuemax={RIR_TOP}
        aria-valuenow={shown ?? undefined}
        aria-valuetext={valueText}
        data-unset={shown === null ? "" : undefined}
        // The track takes the finger: no scroll, no zoom, no text selection.
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        style={{ "--rir-pos": position } as Vars}
      >
        <span className="rir-rail" aria-hidden="true">
          {RIR_VALUES.map((tick) => (
            <span
              key={tick}
              className="rir-tick"
              style={{ "--tick": tick / RIR_TOP } as Vars}
            />
          ))}
        </span>
        <span className="rir-carrier" aria-hidden="true">
          <span className="rir-thumb">
            {shown === null ? "–" : rirValueText(shown)}
          </span>
        </span>
      </div>
      <div className="rir-labels" aria-hidden="true">
        {RIR_VALUES.map((tick) => (
          <span key={tick} style={{ "--tick": tick / RIR_TOP } as Vars}>
            {tick === 0
              ? `0 ${t("pad.rirMax")}`
              : tick === RIR_TOP
                ? `${rirValueText(tick)} ${t("pad.rirEasy")}`
                : tick}
          </span>
        ))}
      </div>
      <p className="rir-help" aria-live="polite">
        {t(RIR_TEXT[shown ?? "unset"])}
      </p>
    </div>
  );
}
