import { ArrowUp, Trophy } from "lucide-react";
import { setBadge } from "@/data/drops";
import { labelSet, type WorkoutSet } from "@/data/model";
import { cardioLabel, isCardioSet, type DistanceUnit } from "@/lib/cardio";
import type { PrKind } from "@/data/exercise-records";
import { recordKindsLabel } from "@/lib/record-labels";
import { t } from "@/i18n";

/** A set's result as the workout screen's checked row reads it: "82.5 kg × 5", the × muted. */
export function DoneSetValue({
  set,
  distanceUnit,
  withHold = true,
}: {
  set: WorkoutSet;
  /** A cardio set's distance unit, the one its exercise is typed in. */
  distanceUnit?: DistanceUnit;
  /** False for a record, which is weight × reps without the set's hold. */
  withHold?: boolean;
}) {
  // "60 kg × 6 · 2 s": the × and the hold's · are muted.
  const parts = (
    isCardioSet(set) ? cardioLabel(set, distanceUnit) : labelSet(set, withHold)
  ).split(/( × | · )/);
  return (
    <span className="done-value">
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={i} className="done-times">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

type Props = {
  /** The exercise's sets; only checked ones are listed. */
  sets: WorkoutSet[];
  /** A set to highlight, such as the one a record link points to. */
  highlight?: string | null;
  /** The PR set of each exercise in this workout and its records, by set id. */
  records?: ReadonlyMap<string, readonly PrKind[]>;
  /** Sets that beat the same set last time (see improvedSetIds): a small up arrow. */
  improved?: ReadonlySet<string>;
  /** Cardio: the unit the exercise's distance shows in. Every value a set holds is listed. */
  distanceUnit?: DistanceUnit;
};

/**
 * A finished exercise's checked sets, read-only, in the active workout's
 * checked-row style: the set's badge (number, W, C or ↓ for a drop), then the
 * result with a muted ×. A set that beat the same set last time has a small
 * up arrow; an exercise's PR set carries a PR chip.
 */
export default function DoneSetList({
  sets,
  highlight,
  records,
  improved,
  distanceUnit,
}: Props) {
  const done = sets.filter((s) => s.done);
  return (
    <ol className="done-list">
      {done.map((set, index) => {
        const badge = setBadge(done, index);
        const kinds = records?.get(set.id);
        return (
          <li
            key={set.id}
            data-set-id={set.id}
            className={
              "done-row" +
              (badge.tone === "drop" ? " is-drop" : "") +
              (highlight === set.id ? " is-highlighted" : "")
            }
            aria-current={highlight === set.id ? "true" : undefined}
          >
            <span className="set-badge" data-tone={badge.tone}>
              <span className="set-badge-chip" aria-hidden="true">
                {badge.text}
              </span>
              <span className="sr-only">{badge.name}</span>
            </span>
            <DoneSetValue set={set} distanceUnit={distanceUnit} />
            {improved?.has(set.id) && <ImprovedMark />}
            {kinds?.length ? (
              <span
                className="stat-chip warm done-pr"
                title={recordKindsLabel(kinds)}
              >
                <span aria-hidden="true">{t("records.pr")}</span>
                <span className="sr-only">{recordKindsLabel(kinds)}</span>
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The small up arrow on a set that beat the same set last time. */
export function ImprovedMark() {
  return (
    <span className="set-up" title={t("set.improved")}>
      <ArrowUp size={14} strokeWidth={2.5} aria-hidden="true" />
      <span className="sr-only">{t("set.improved")}</span>
    </span>
  );
}

/** A set that holds a record: a small trophy in a warm circle, named for screen readers. */
export function RecordMark({ label }: { label: string }) {
  return (
    <span className="set-record" title={label}>
      <Trophy size={13} strokeWidth={2.25} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
