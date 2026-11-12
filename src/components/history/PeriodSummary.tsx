import { useId } from "react";
import { useT } from "@/i18n/useT";
import { countLabel } from "@/lib/labels";
import { volumeTile } from "@/lib/history-caption";
import type { WeightUnit } from "@/lib/units";

/** Roughly how many digits wide a tile's value is, its unit included. */
const tileWidth = (value: string, unit = "") =>
  value.replace(/[^0-9]/g, "").length +
  value.replace(/[0-9]/g, "").length * 0.4 +
  unit.length * 0.6;

/**
 * A chosen period, under its own heading "Selected period · 2–9 Nov · 8 days"
 * with Clear, and four tiles: workouts, sets, volume and records.
 */
export default function PeriodSummary({
  label,
  days,
  workouts,
  sets,
  volumeKg,
  records,
  unit,
  onClear,
}: {
  /** The period's dates, "2–9 Nov", or a heatmap row's name. */
  label: string;
  days: number;
  workouts: number;
  sets: number;
  volumeKg: number;
  records: number;
  unit: WeightUnit;
  onClear: () => void;
}) {
  const { t } = useT();
  const titleId = useId();
  const volume = volumeTile(volumeKg, unit);
  const tiles = [
    {
      key: "workouts",
      name: t("history.tileWorkouts"),
      value: String(workouts),
    },
    { key: "sets", name: t("history.tileSets"), value: String(sets) },
    {
      key: "volume",
      name: t("history.tileVolume"),
      value: volume.value,
      unit: volume.unit,
    },
    { key: "records", name: t("history.tileRecords"), value: String(records) },
  ];
  return (
    <section className="card period-summary" aria-labelledby={titleId}>
      <div className="period-head">
        <h2 id={titleId} className="period-title">
          {t("history.selectedPeriod")}
          <span className="period-detail">
            {" · "}
            {label} · {countLabel(days, "day")}
          </span>
        </h2>
        <button type="button" className="text-button" onClick={onClear}>
          {t("history.clearPeriod")}
        </button>
      </div>
      <dl className="period-tiles">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={
              "period-tile" +
              (tile.key === "records" && records > 0 ? " is-record" : "")
            }
          >
            <dt>{tile.name}</dt>
            {/* A long value takes a smaller type, so it never meets the edge. */}
            <dd
              className={
                tileWidth(tile.value, tile.unit) > 4.4 ? "is-long" : undefined
              }
            >
              {tile.value}
              {tile.unit && <small>{tile.unit}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
