import { setBadge } from "@/data/drops";
import { labelSet, type WorkoutSet } from "@/data/model";
import { cardioLabel, isCardioSet, type DistanceUnit } from "@/lib/cardio";
import type { RecordKind } from "@/data/exercise-records";
import { recordKindsLabel } from "@/lib/record-labels";
import { t } from "@/i18n";

/** A set's result as the workout screen's checked row reads it: "82.5 kg × 5", the × muted. */
export function DoneSetValue({
  set,
  distanceUnit,
}: {
  set: WorkoutSet;
  /** A cardio set's distance unit, the one its exercise is typed in. */
  distanceUnit?: DistanceUnit;
}) {
  const parts = (
    isCardioSet(set) ? cardioLabel(set, distanceUnit) : labelSet(set)
  ).split(" × ");
  return (
    <span className="done-value">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="done-times"> × </span>}
          {part}
        </span>
      ))}
    </span>
  );
}

type Props = {
  /** The exercise's sets; only checked ones are listed. */
  sets: WorkoutSet[];
  /** A set to highlight, such as the one a record link points to. */
  highlight?: string | null;
  /** Records each set set in this workout, by set id. */
  records?: ReadonlyMap<string, readonly RecordKind[]>;
  /** Cardio: the unit the exercise's distance shows in. Every value a set holds is listed. */
  distanceUnit?: DistanceUnit;
};

/**
 * A finished exercise's checked sets, read-only, in the active workout's
 * checked-row style: the set's badge (number, W, C or ↓ for a drop), then the
 * result with a muted ×. A record set carries a PR chip.
 */
export default function DoneSetList({
  sets,
  highlight,
  records,
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
