import { Fragment } from "react";
import { ArrowLeft } from "lucide-react";
import type { Workout } from "@/data/model";
import { useNow } from "@/hooks/useNow";
import { localizedDate } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";

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
        aria-label={`Date ${localizedDate(w.date)}. Edit workout details`}
        disabled={busy}
        onClick={onDetails}
      >
        {localizedDate(w.date, { day: "numeric", month: "short" })}
      </button>
    ),
    <span key="sets">
      {completed} of {total} sets
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
    <div className="top-bar" data-top-bar>
      <button
        type="button"
        className="icon-btn"
        aria-label={editing ? "Back to history" : "Leave workout"}
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
            {editing ? "Edit " : ""}
            {w.name || "Workout"}
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
        className="btn-primary"
        disabled={finishDisabled}
        onClick={onFinish}
      >
        {editing ? "Save" : "Finish"}
      </button>
    </div>
  );
}
