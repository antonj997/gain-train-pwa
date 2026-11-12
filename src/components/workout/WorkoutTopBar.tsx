import { Fragment, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import type { Workout } from "@/data/model";
import { useData } from "@/contexts/useData";
import { customCategories } from "@/data/selectors";
import { useNow } from "@/hooks/useNow";
import MessageSlot from "@/components/messages/MessageSlot";
import RollingNumber from "@/components/workout/RollingNumber";
import { localizedDate } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { autoWorkoutName, workoutTitle } from "@/lib/workout-name";
import { useT } from "@/i18n/useT";

type Props = {
  workout: Workout;
  editing: boolean;
  busy: boolean;
  /** Sets checked and in all, for the status line. */
  completed: number;
  total: number;
  saveStatus: string;
  saveError: boolean;
  finishDisabled: boolean;
  onLeave: () => void;
  onDetails: () => void;
  onFinish: () => void;
};

/** The workout screen's bar: back, the name (opens details), a status line and Finish or Save. */
export default function WorkoutTopBar({
  workout: w,
  editing,
  busy,
  completed,
  total,
  saveStatus,
  saveError,
  finishDisabled,
  onLeave,
  onDetails,
  onFinish,
}: Props) {
  // A live timer for a running workout; a past or edited one shows its date.
  const timed = !editing && !!w.startedAt;
  const now = useNow(timed);
  const { t } = useT();
  const { state } = useData();
  const custom = useMemo(
    () => customCategories(state.records),
    [state.records],
  );
  // Finish is an outline until every set is checked, then it fills.
  const allChecked = total > 0 && completed === total;
  const status = [
    timed ? (
      <span key="time">
        {durationLabel(
          Math.max(0, Math.floor((now - (w.startedAt ?? now)) / 60000)),
        )}
      </span>
    ) : (
      <button
        key="date"
        type="button"
        className="date-chip"
        aria-haspopup="dialog"
        aria-label={t("workout.dateLabel", { date: localizedDate(w.date) })}
        disabled={busy}
        onClick={onDetails}
      >
        {localizedDate(w.date, { day: "numeric", month: "short" })}
      </button>
    ),
    // "3 of 9 sets", its numbers rolling as sets are checked and added.
    <span key="sets">
      {t("workout.setsOf", { done: "\u2060d\u2060", total: "\u2060t\u2060" })
        .split("\u2060")
        .map((part, index) =>
          index % 2 && part === "d" ? (
            <RollingNumber key={index} value={completed} />
          ) : index % 2 && part === "t" ? (
            <RollingNumber key={index} value={total} />
          ) : (
            part
          ),
        )}
    </span>,
    <span
      key="save"
      role="status"
      className={saveError ? "is-error" : undefined}
    >
      {saveStatus}
    </span>,
  ];
  return (
    <div className="top-bar-wrap" data-top-bar>
      <div className="top-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label={editing ? t("workout.backToHistory") : t("workout.leave")}
          onClick={onLeave}
          disabled={busy}
        >
          <ArrowLeft size={23} aria-hidden="true" />
        </button>
        <div className="top-bar-text">
          <h1 className="top-bar-title">
            <button
              type="button"
              aria-haspopup="dialog"
              disabled={busy}
              onClick={onDetails}
            >
              {/* A running workout's unnamed title follows its exercises. */}
              {editing
                ? t("workout.editTitle", { name: workoutTitle(w.name) })
                : workoutTitle(autoWorkoutName(w, {}, custom))}
            </button>
          </h1>
          <p className="top-bar-status">
            {status.map((part, index) => (
              <Fragment key={part.key}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                {part}
              </Fragment>
            ))}
          </p>
        </div>
        <button
          type="button"
          className={
            editing
              ? "btn-primary"
              : allChecked
                ? "btn-primary finish-ready"
                : "btn-secondary finish-pending"
          }
          disabled={finishDisabled}
          onClick={onFinish}
        >
          {editing ? t("workout.save") : t("workout.finish")}
        </button>
      </div>
      {/* Messages hang under the bar and push the cards down. */}
      <MessageSlot />
    </div>
  );
}
