import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trash2, Trophy } from "lucide-react";
import { durationLabel, finishSummary, volumeLabel } from "@/lib/labels";
import { motionMs } from "@/lib/slow-motion";
import { COUNT_UP_MS, countUpValue } from "@/lib/count-up";
import { MOTION, SPRING, play, playSpring } from "@/lib/motion";
import { WORKOUT_NOTE_MAX } from "@/lib/workout-note";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import { useT } from "@/i18n/useT";

/** One exercise's record in the workout, as its pill reads. */
export type FinishRecord = {
  /** The record set's id. */
  id: string;
  /** "Bench Press 90 kg × 5". */
  text: string;
  /** "Record: Heaviest weight · Rep record", for screen readers. */
  label: string;
  /** A rep record or an estimated 1RM: a quieter pill than the heaviest weight. */
  quiet: boolean;
};

type BodyProps = {
  /** Checked sets that will be saved. */
  completed: number;
  /** Sets that are not checked and will be left out. */
  unchecked: number;
  /** The volume of the checked sets, in kg. */
  volumeKg: number;
  /** Minutes since the workout started, or its recorded duration. */
  minutes: number | null;
  /** The records it holds, one per exercise, strongest kind first. */
  records: readonly FinishRecord[];
  /** Shown loud (warm) when a record is more than an estimate, as in History. */
  loudRecords: boolean;
  /** The workout's note as typed; it is saved trimmed. */
  note: string;
  onNote: (text: string) => void;
  /** Hidden for a workout that was started from a routine. */
  showRoutineSwitch: boolean;
  saveRoutine: boolean;
  busy: boolean;
  onSaveRoutine: (on: boolean) => void;
  onSave: () => void;
  onKeepLogging: () => void;
  onAbandon: () => void;
};

/** How long "Tap again to discard" waits for the second tap. */
const CONFIRM_MS = 3000;
/** When each tile starts counting (mockup v5, B6): Sets, Volume, Time, then Records. */
const TILE_DELAYS = [0, 80, 160, 420] as const;
/** The first record pill pops once Records has counted, then one every 80 ms. */
const PILL_DELAY = 520;
const PILL_GAP = 80;

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
function CountUp({
  value,
  format,
  delay,
  onLanded,
}: {
  value: number;
  format: (value: number) => string;
  delay: number;
  onLanded?: () => void;
}) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  const landed = useRef(onLanded);
  landed.current = onLanded;
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
      else landed.current?.();
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

/** The Finish sheet's content below its title. Only drafts use it. */
function FinishSheetBody({
  completed,
  unchecked,
  volumeKg,
  minutes,
  records,
  loudRecords,
  note,
  onNote,
  showRoutineSwitch,
  saveRoutine,
  busy,
  onSaveRoutine,
  onSave,
  onKeepLogging,
  onAbandon,
}: BodyProps) {
  const { t } = useT();
  // Discard asks for a second tap in the same place, not a dialog; after a
  // few seconds it goes back to asking for the first.
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(
      () => setAsking(false),
      motionMs(CONFIRM_MS),
    );
    return () => window.clearTimeout(timer);
  }, [asking]);

  // The record pills pop in one at a time as the sheet opens, each with one
  // light sweep; the Records number pops once it has counted.
  const pills = useRef<HTMLUListElement>(null);
  const recordTile = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const items = pills.current?.querySelectorAll<HTMLElement>(".finish-pill");
    items?.forEach((pill, index) => {
      const delay = PILL_DELAY + index * PILL_GAP;
      playSpring(
        pill,
        SPRING.record,
        0.6,
        1,
        (v) => ({
          transform: `scale(${v})`,
          opacity: Math.min(1, (v - 0.6) * 4),
        }),
        { delay, fill: "backwards" },
      );
      play(
        pill.querySelector(".finish-pill-sheen"),
        [{ transform: "translateX(-120%)" }, { transform: "translateX(320%)" }],
        { duration: MOTION.sheen, delay: delay + 180, easing: "ease-in-out" },
      );
    });
    // Only as the sheet opens.
  }, []);
  const popRecords = () => {
    if (!records.length || reducedMotion()) return;
    playSpring(recordTile.current, SPRING.record, 1.18, 1, (v) => ({
      transform: `scale(${v})`,
    }));
  };

  const tiles = [
    { label: t("details.sets"), value: completed, format: String },
    { label: t("progress.volume"), value: volumeKg, format: volumeLabel },
    {
      label: t("details.time"),
      value: minutes ?? 0,
      format: (n: number) => (minutes === null ? "—" : durationLabel(n)),
    },
    { label: t("records.tile"), value: records.length, format: String },
  ];

  return (
    <>
      <div className="detail-tiles finish-tiles">
        {tiles.map((tile, index) => {
          const isRecords = index === 3;
          return (
            <div
              key={tile.label}
              className={
                "detail-tile" +
                (isRecords && records.length && loudRecords
                  ? " has-records"
                  : "")
              }
            >
              <span>{tile.label}</span>
              <strong ref={isRecords ? recordTile : undefined}>
                <CountUp
                  value={tile.value}
                  format={tile.format}
                  delay={TILE_DELAYS[index]}
                  onLanded={isRecords ? popRecords : undefined}
                />
              </strong>
            </div>
          );
        })}
      </div>
      {records.length > 0 && (
        <ul
          ref={pills}
          className="finish-pills"
          aria-label={t("finish.recordsLabel")}
        >
          {records.map((record) => (
            <li
              key={record.id}
              className={"finish-pill" + (record.quiet ? " is-quiet" : "")}
              title={record.label}
            >
              <Trophy size={15} strokeWidth={2.25} aria-hidden="true" />
              <span aria-hidden="true">{record.text}</span>
              <span className="sr-only">{`${record.text}. ${record.label}`}</span>
              <span className="finish-pill-sheen" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
      {unchecked > 0 || completed === 0 ? (
        <p className="sheet-note" role="status">
          {finishSummary(completed, unchecked)}
        </p>
      ) : null}
      <textarea
        className="finish-note"
        rows={2}
        maxLength={WORKOUT_NOTE_MAX}
        placeholder={t("workout.note")}
        aria-label={t("workout.noteLabel")}
        value={note}
        disabled={busy}
        onChange={(event) => onNote(event.target.value)}
      />
      {showRoutineSwitch && (
        <Switch
          label={t("workout.saveAsRoutine")}
          checked={saveRoutine}
          disabled={busy}
          onChange={onSaveRoutine}
        />
      )}
      <button
        type="button"
        className="btn-primary"
        disabled={busy || completed === 0}
        onClick={onSave}
      >
        {busy ? t("workout.saving") : t("workout.saveWorkout")}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={onKeepLogging}
      >
        {t("workout.keepLogging")}
      </button>
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

/** What a person sees after tapping Finish. */
export default function FinishSheet({
  open,
  onClose,
  ...body
}: BodyProps & { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet
      open={open}
      // The sheet stays put while a save or abandon runs.
      onClose={() => {
        if (!body.busy) onClose();
      }}
      title={t("workout.finishTitle")}
    >
      <FinishSheetBody {...body} />
    </Sheet>
  );
}
