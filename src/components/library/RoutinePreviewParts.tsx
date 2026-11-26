import RoutineGlyph from "@/components/library/RoutineGlyph";
import { categoryLabel } from "@/lib/catalogue-labels";
import { countLabel } from "@/lib/labels";
import { categoryTone } from "@/lib/exercise-icon";
import { t } from "@/i18n";
import { exerciseDisplayName } from "@/lib/exercise-name";

/**
 * A routine's working sets per main category as one bar, a segment each in
 * the category's tint, with a legend ("Rygg 6 · Armar 2") and the total.
 */
export function SetsBar({
  groups,
}: {
  groups: readonly { category: string; sets: number }[];
}) {
  const total = groups.reduce((sum, g) => sum + g.sets, 0);
  if (!total) return null;
  const legend = groups
    .map((g) => `${categoryLabel(g.category)} ${g.sets}`)
    .join(", ");
  return (
    <figure className="sets-bar">
      <div
        className="sets-bar-track"
        role="img"
        aria-label={`${t("routinePreview.bar")}: ${legend}`}
      >
        {groups.map((g) => (
          <span
            key={g.category}
            className="sets-bar-part"
            data-tone={categoryTone(g.category)}
            style={{ flexGrow: g.sets }}
          />
        ))}
      </div>
      <figcaption className="sets-bar-legend" aria-hidden="true">
        <span className="sets-bar-keys">
          {groups.map((g) => (
            <span
              key={g.category}
              className="sets-bar-key"
              data-tone={categoryTone(g.category)}
            >
              {categoryLabel(g.category)} {g.sets}
            </span>
          ))}
        </span>
        <span className="sets-bar-total">{countLabel(total, "set")}</span>
      </figcaption>
    </figure>
  );
}

export type PreviewItem = {
  key: string;
  exerciseId: string;
  category?: string;
  equipment?: string;
  name: string;
  /** "1 uppv. + 3 set · 8–12 reps". */
  line: string;
  /** Last time's result ("80 × 8"), or null. */
  last: string | null;
  /** A target typed in the routine ("Mål 85 × 5"), shown instead of Förra. */
  target?: string | null;
};

/**
 * Every exercise of a routine with its sets and, at the right, last time's
 * result in grey under `lastLabel` ("Förra", "Din förra"). Without one,
 * `missing` ("Ny för dig") or nothing.
 */
export function PreviewExercises({
  items,
  lastLabel,
  missing,
}: {
  items: readonly PreviewItem[];
  lastLabel: string;
  missing?: string;
}) {
  return (
    <ul className="list routine-preview-list">
      {items.map((item) => (
        <li className="row routine-preview-item" key={item.key}>
          <RoutineGlyph
            exerciseId={item.exerciseId}
            category={item.category}
            size={36}
          />
          <span className="row-main">
            <span className="row-title">
              {exerciseDisplayName(item.exerciseId, item.name)}
            </span>
            <span className="row-sub">{item.line}</span>
          </span>
          {item.target ? (
            <span className="routine-preview-last is-target">
              <span>{t("routinePreview.target")}</span>
              <span>{item.target}</span>
            </span>
          ) : item.last ? (
            <span className="routine-preview-last">
              <span>{lastLabel}</span>
              <span>{item.last}</span>
            </span>
          ) : missing ? (
            <span className="stat-chip routine-preview-new">{missing}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
