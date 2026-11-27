import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info, Trash2, Trophy } from "lucide-react";
import { durationLabel } from "@/lib/labels";
import { motionMs } from "@/lib/slow-motion";
import { COUNT_UP_MS, countUpValue } from "@/lib/count-up";
import { MOTION, SPRING, play, playSpring } from "@/lib/motion";
import { WORKOUT_NOTE_MAX } from "@/lib/workout-note";
import { formatVolume, type FinishSummary } from "@/lib/finish-summary";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/useT";

/** How long "Tryck igen för att slänga" waits for the second tap. */
const CONFIRM_MS = 3000;
/** When each number starts counting: Set, Volym, then Tid. */
const STAT_DELAYS = [0, 80, 160] as const;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that counts up from 0 to `value` in 500 ms (a cubic ease-out)
 * after `delay` ms, when it first shows. Reduced motion shows the value at
 * once. The admin slow motion slows it with everything else. Screen readers
 * read only the final value.
 */
export function CountUp({
  value,
  format,
  delay,
}: {
  value: number;
  format: (value: number) => string;
  delay: number;
}) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now() + motionMs(delay);
    const duration = motionMs(COUNT_UP_MS);
    const tick = (now: number) => {
      const elapsed = now - start;
      setShown(countUpValue(value, Math.max(0, elapsed), duration));
      if (elapsed < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/** The three numbers of a finished workout (v6 B9, B10): Set, kg Volym, Tid. */
export function FinishStats({
  done,
  volumeKg,
  minutes,
  sheen = false,
}: {
  done: number;
  volumeKg: number;
  minutes: number | null;
  /** The reward sweeps one light sheen across them. */
  sheen?: boolean;
}) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!sheen) return;
    play(
      box.current?.querySelector(".finish-stats-sheen"),
      [{ transform: "translateX(-120%)" }, { transform: "translateX(420%)" }],
      { duration: MOTION.sheen, delay: 300, easing: "ease-in-out" },
    );
  }, [sheen]);
  const stats = [
    { label: t("finish.statSets"), value: done, format: String },
    { label: t("finish.statVolume"), value: volumeKg, format: formatVolume },
    {
      label: t("finish.statTime"),
      value: minutes ?? 0,
      format: (n: number) => (minutes === null ? "—" : durationLabel(n)),
    },
  ];
  return (
    <div ref={box} className="finish-stats">
      {stats.map((stat, index) => (
        <div key={stat.label} className="finish-stat">
          <strong>
            <CountUp
              value={stat.value}
              format={stat.format}
              delay={STAT_DELAYS[index]}
            />
          </strong>
          <span>{stat.label}</span>
        </div>
      ))}
      {sheen && <span className="finish-stats-sheen" aria-hidden="true" />}
    </div>
  );
}

/**
 * "Släng passet" in danger text: the first tap asks "Tryck igen för att
 * slänga" in its place (a red outline, the words fading in over 120 ms) for
 * 3 s; the second discards.
 */
function DiscardButton({
  busy,
  onAbandon,
}: {
  busy: boolean;
  onAbandon: () => void;
}) {
  const { t } = useT();
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(
      () => setAsking(false),
      motionMs(CONFIRM_MS),
    );
    return () => window.clearTimeout(timer);
  }, [asking]);
  return (
    <>
      <button
        type="button"
        className={"btn-danger finish-discard" + (asking ? " is-asking" : "")}
        disabled={busy}
        onClick={() => {
          if (!asking) setAsking(true);
          else {
            setAsking(false);
            onAbandon();
          }
        }}
      >
        <Trash2 size={18} aria-hidden="true" />
        {/* The new words fade in where the old ones were. */}
        <span key={String(asking)} className="finish-discard-label">
          {asking ? t("workout.abandonConfirm") : t("workout.abandonWorkout")}
        </span>
      </button>
      <span className="sr-only" role="status">
        {asking ? t("workout.abandonConfirm") : ""}
      </span>
    </>
  );
}

type Props = {
  open: boolean;
  /** Closing keeps logging. */
  onClose: () => void;
  /** The workout's name as shown. */
  name: string;
  /** How many exercises it has. */
  exercises: number;
  summary: FinishSummary;
  /** Minutes since the workout started, or its recorded duration. */
  minutes: number | null;
  /** The workout's note as typed; it is saved trimmed. */
  note: string;
  onNote: (text: string) => void;
  busy: boolean;
  onSave: () => void;
  /** Nothing checked: saves the exercises as a routine and ends the workout. */
  onSaveRoutine: () => void;
  onAbandon: () => void;
};

/**
 * What a person sees after tapping Avsluta (v6 B9, B10). With nothing
 * checked: "Inga set är ikryssade", with Fortsätt passet, Spara som rutin
 * och avsluta and Släng passet. Otherwise "Avsluta Benpass?": the strongest
 * record, three numbers, what is left out, the note, Spara passet and Släng
 * passet. Closing keeps logging.
 */
export default function FinishSheet({
  open,
  onClose,
  name,
  exercises,
  summary,
  minutes,
  note,
  onNote,
  busy,
  onSave,
  onSaveRoutine,
  onAbandon,
}: Props) {
  const { t } = useT();
  const empty = summary.done === 0;
  const recordRow = useRef<HTMLDivElement>(null);
  // The record's trophy pops in once with the sheet (the app's record pop).
  useLayoutEffect(() => {
    if (!open || empty || !summary.record) return;
    playSpring(
      recordRow.current?.querySelector(".finish-record-icon"),
      SPRING.record,
      0.6,
      1,
      (v) => ({ transform: `scale(${v})` }),
      { delay: 120, fill: "backwards" },
    );
  }, [open, empty, summary.record]);
  return (
    <Sheet
      open={open}
      // The sheet stays put while a save or discard runs.
      onClose={() => {
        if (!busy) onClose();
      }}
      title={empty ? t("finish.emptyTitle") : t("finish.title", { name })}
      description={
        empty
          ? t("finish.emptySub", {
              name,
              count: exercises,
              total: summary.total,
            })
          : t("finish.sub", {
              time: minutes === null ? "—" : durationLabel(minutes),
              done: summary.done,
              total: summary.total,
            })
      }
    >
      {empty ? (
        <>
          <p className="sheet-note finish-empty-text">
            {t("finish.emptyText")}
          </p>
          <button
            type="button"
            className="btn-primary btn-block"
            disabled={busy}
            onClick={onClose}
          >
            {t("finish.continue")}
          </button>
          <button
            type="button"
            className="btn-secondary btn-block"
            disabled={busy || exercises === 0}
            onClick={onSaveRoutine}
          >
            {t("finish.saveRoutine")}
          </button>
          <DiscardButton busy={busy} onAbandon={onAbandon} />
        </>
      ) : (
        <>
          {summary.record && (
            <div ref={recordRow} className="finish-record">
              <span className="finish-record-icon" aria-hidden="true">
                <Trophy size={18} strokeWidth={2.25} />
              </span>
              <span className="finish-record-text">
                <strong>
                  {t("finish.record", { text: summary.record.text })}
                  {summary.record.more > 0 &&
                    ` · ${t("finish.recordMore", { count: summary.record.more })}`}
                </strong>
                {summary.record.previous && (
                  <span>
                    {t("finish.recordPrevious", {
                      value: summary.record.previous,
                    })}
                  </span>
                )}
              </span>
            </div>
          )}
          <FinishStats
            done={summary.done}
            volumeKg={summary.volumeKg}
            minutes={minutes}
          />
          {summary.unchecked > 0 && (
            <p className="finish-info" role="status">
              <Info size={16} aria-hidden="true" />
              {t("finish.unchecked", { count: summary.unchecked })}
            </p>
          )}
          <label className="finish-note-field">
            <span>{t("finish.note")}</span>
            <textarea
              className="finish-note"
              rows={2}
              maxLength={WORKOUT_NOTE_MAX}
              placeholder={t("finish.notePlaceholder")}
              value={note}
              disabled={busy}
              onChange={(event) => onNote(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary btn-block"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? t("workout.saving") : t("workout.saveWorkout")}
          </button>
          <DiscardButton busy={busy} onAbandon={onAbandon} />
        </>
      )}
    </Sheet>
  );
}
