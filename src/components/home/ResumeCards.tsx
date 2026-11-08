import { useState } from "react";
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
      {drafts.map((r, i) => {
        const live = r.payload.startedAt !== null;
        const next = nextSetLabel(r.payload);
        return (
          <Link
            key={r.id}
            to={workoutPath(r.id)}
            className={
              "resume-card" +
              (i === 0 ? " resume-primary" : "") +
              // A past workout has no start time and is not "live".
              (live ? " is-running" : "")
            }
          >
            <span>
              <small>
                {live && <span className="resume-live" aria-hidden="true" />}
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
              </small>
              <strong>{workoutTitle(r.payload.name)}</strong>
              <span className="resume-meta">
                {!running && `${localizedDate(r.payload.date)} · `}
                {t("home.setsOf", {
                  done: doneSetCount(r.payload),
                  total: setCount(r.payload),
                })}
                {next && ` · ${t("home.next", { set: next })}`}
              </span>
            </span>
            <Play className="resume-play" fill="currentColor" stroke="none" />
          </Link>
        );
      })}
    </>
  );
}
