import type { CSSProperties } from "react";

type Item = { key: string; colour: string; label: string };

/**
 * A muscle map's key: a swatch per colour with its label, round for an
 * exercise's levels and square for a week's heat steps, and an optional
 * unit at the end ("sets per week"). Sits inside the map's panel.
 */
export default function MapLegend({
  items,
  shape = "dot",
  unit,
}: {
  items: readonly Item[];
  shape?: "dot" | "square";
  unit?: string;
}) {
  return (
    <ul className={"map-legend is-" + shape}>
      {items.map((item) => (
        <li key={item.key}>
          <span
            className="map-swatch"
            style={{ "--swatch": item.colour } as CSSProperties}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
      {unit && <li className="map-legend-unit">{unit}</li>}
    </ul>
  );
}
