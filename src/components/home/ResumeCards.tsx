import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { notify, offerUndo } from "@/lib/message-store";
import { RESUME_SCOPE } from "@/lib/messages";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import { useUndoEntries } from "@/hooks/useMessages";
import { useData } from "@/contexts/useData";
import type { WorkoutRecord } from "@/data/model";
import { doneSetCount, nextSetLabel, setCount } from "@/data/selectors";
import { useNow } from "@/hooks/useNow";
import { localizedDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { durationLabel } from "@/lib/labels";
import { workoutPath } from "@/lib/routes";
import { useT } from "@/i18n/useT";
import { workoutTitle } from "@/lib/workout-name";
import { morphToWorkout, settledPath } from "@/lib/view-transition";
import { reducedMotion } from "@/hooks/useMessages";
import RoutineBadge from "@/components/items/RoutineBadge";

/** The card grows into the workout's top bar and shrinks back from it. */
const MORPH_MS = 300;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Coming back from a workout: its card shrinks back from where the top bar
 * was, then turns one quick lap so the eye finds it (CSS: .is-returning).
 */
function useReturnMorph(card: HTMLElement | null, id: string) {
  const [returning] = useState(() => settledPath() === workoutPath(id));
  useLayoutEffect(() => {
    if (!returning || !card || typeof card.animate !== "function") return;
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (reducedMotion()) {
      card.animate([{ opacity: 0 }, { opacity: 1 }], 120);
      return;
    }
    // The bar spans the top of the screen, about 56px tall.
    const width = window.innerWidth;
    const sx = width / r.width;
    const sy = 56 / r.height;
    card.animate(
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${-r.left}px, ${-r.top}px) scale(${sx}, ${sy})`,
          borderRadius: "0px",
          opacity: 0.6,
        },
        { transformOrigin: "0 0", transform: "none", opacity: 1 },
      ],
      { duration: MORPH_MS, easing: EASE },
    );
  }, [returning, card]);
  return returning;
}

type Props = {
  /** The most recently started workout, if any. */
  running: WorkoutRecord | undefined;
  /** Other started workouts, from a second device. */
  otherRunning: WorkoutRecord[];
  /** Unfinished workouts to resume, the running one first. */
  drafts: WorkoutRecord[];
};

/** Train's top: workouts running elsewhere, then a card per unfinished workout. */
export default function ResumeCards({ running, otherRunning, drafts }: Props) {
  const { deleteRecord, restoreWorkout } = useData();
  const navigate = useNavigate();
  const { t } = useT();
  const now = useNow(!!running);
  const [abandoning, setAbandoning] = useState("");
  const undos = useUndoEntries(RESUME_SCOPE);
  const abandon = async (r: WorkoutRecord) => {
    if (abandoning) return;
    setAbandoning(r.id);
    try {
      await deleteRecord(r.id);
      // Its place on Train keeps an Undo for a few seconds.
      offerUndo({
        scope: RESUME_SCOPE,
        index: 0,
        text: t("start.abandonedNamed", { name: workoutTitle(r.payload.name) }),
        undo: () => restoreWorkout(r.id),
        failed: t("home.restoreFailed"),
      });
    } catch (error) {
      notify.error(errorMessage(error, t("home.abandonFailed")));
    } finally {
      setAbandoning("");
    }
  };
  return (
    <>
      {undos.map((entry) => (
        <UndoPlaceholder key={`u${entry.id}`} entry={entry} />
      ))}
      {otherRunning.map((r) => (
        <div className="banner workout-banner" role="status" key={r.id}>
          <p>
            {t("home.otherDevice", {
              name: workoutTitle(r.payload.name),
              done: doneSetCount(r.payload),
              total: setCount(r.payload),
            })}
          </p>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => navigate(workoutPath(r.id))}
            >
              {t("home.resume")}
            </button>
            <button
              type="button"
              className="btn-quiet btn-sm"
              disabled={!!abandoning}
              onClick={() => void abandon(r)}
            >
              {abandoning === r.id ? t("home.abandoning") : t("home.abandon")}
            </button>
          </div>
        </div>
      ))}
      {drafts.map((r, i) => (
        <ResumeCard
          key={r.id}
          workout={r}
          primary={i === 0}
          running={!!running}
          now={now}
        />
      ))}
    </>
  );
}

/**
 * One unfinished workout. A running one has the turning border and the
 * pulsing dot (paused while the card is off screen); tapping it grows the
 * card into the workout's top bar (see morphToWorkout).
 */
function ResumeCard({
  workout: r,
  primary,
  running,
  now,
}: {
  workout: WorkoutRecord;
  primary: boolean;
  running: boolean;
  now: number;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  const [card, setCard] = useState<HTMLAnchorElement | null>(null);
  const live = r.payload.startedAt !== null;
  const next = nextSetLabel(r.payload);
  const done = doneSetCount(r.payload);
  const total = setCount(r.payload);
  const returning = useReturnMorph(card, r.id);
  // The endless border and dot stop while nobody can see them.
  const [offscreen, setOffscreen] = useState(false);
  const seen = useRef(true);
  useEffect(() => {
    if (!card || !live || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === seen.current) return;
      seen.current = entry.isIntersecting;
      setOffscreen(!entry.isIntersecting);
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [card, live]);
  return (
    <Link
      ref={setCard}
      to={workoutPath(r.id)}
      className={
        "resume-card" +
        (primary ? " resume-primary" : "") +
        // A past workout has no start time and is not "live".
        (live ? " is-running" : "") +
        (returning ? " is-returning" : "")
      }
      data-offscreen={offscreen || undefined}
      onClick={(event) => {
        if (
          !live ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        morphToWorkout(event.currentTarget, () => navigate(workoutPath(r.id)));
      }}
    >
      <span className="resume-body">
        <small>
          {live && <span className="resume-live" aria-hidden="true" />}
          <span className="resume-state">
            {live
              ? t("home.inProgress", {
                  duration: durationLabel(
                    Math.max(
                      0,
                      Math.floor((now - r.payload.startedAt!) / 60000),
                    ),
                  ),
                })
              : t("home.resumeWorkout")}
          </span>
        </small>
        <span className="resume-main">
          {r.payload.exercises.length > 0 && (
            <RoutineBadge exercises={r.payload.exercises} count={false} />
          )}
          <span className="resume-text">
            <strong className="resume-title">
              {workoutTitle(r.payload.name)}
            </strong>
            <span className="resume-meta">
              {!running && `${localizedDate(r.payload.date)} · `}
              {t("home.setsOf", { done, total })}
              {next && ` · ${t("home.next", { set: next })}`}
            </span>
          </span>
        </span>
        {total > 0 && (
          <span className="resume-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </span>
        )}
      </span>
      <Play className="resume-play" fill="currentColor" stroke="none" />
    </Link>
  );
}
