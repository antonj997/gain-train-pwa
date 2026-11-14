import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  axisLabel,
  bestPointIndex,
  niceTicks,
  volumeInThousands,
  type ChartPoint,
  type Metric,
  type OverviewKind,
} from "@/data/exercise-overview";
import { localizedDate } from "@/lib/dates";
import { t } from "@/i18n";

type Props = {
  points: readonly ChartPoint[];
  kind: OverviewKind;
  metric: Metric;
  /** The selected point's index in `points`. */
  selected: number;
  onSelect: (index: number) => void;
  /** Names the chart for assistive technology. */
  label: string;
};

const LEFT = 44;
const RIGHT = 12;
const TOP = 12;
/** The line's band. */
const PLOT = 96;
/** Top set: the tallest bar, and the room above it for the reps. */
const BAR = 24;
const BAR_LABEL = 14;
const DATES = 18;

const shortDate = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

/**
 * The Overview's trend, drawn in SVG at the width it is given: a line over
 * the sessions with the best point outlined in warm, and for Top set the top
 * set's reps as small labelled bars under it. A tap or click picks the
 * nearest session; with the chart focused, the arrow keys, Home and End move
 * the selection. The caption under it (the parent's) says what is selected.
 */
export default function TrendChart({
  points,
  kind,
  metric,
  selected,
  onSelect,
  label,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(200, Math.round(node.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const combo = metric === "top";
  const height = TOP + PLOT + (combo ? 10 + BAR_LABEL + BAR : 8) + DATES;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max - min < 1e-9;
  const pad = flat ? Math.max(1, Math.abs(max) * 0.1) : (max - min) * 0.14;
  const ticks = niceTicks(
    min - pad,
    max + pad,
    metric !== "top" && metric !== "e1rm" && metric !== "volume",
  );
  const lo = Math.min(min - pad, ...ticks);
  const hi = Math.max(max + pad, ...ticks);
  const inner = width - LEFT - RIGHT;
  const x = (i: number) =>
    LEFT +
    (points.length === 1 ? inner / 2 : (i / (points.length - 1)) * inner);
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * PLOT;
  const thousands = metric === "volume" && volumeInThousands(points);
  const best = bestPointIndex(points);
  const line = points.map(
    (p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
  );
  const base = TOP + PLOT;
  const spacing = points.length > 1 ? inner / (points.length - 1) : inner;
  const barWidth = Math.max(3, Math.min(14, spacing * 0.5));
  const barBase = base + 10 + BAR_LABEL + BAR;
  const maxBar = Math.max(1, ...points.map((p) => p.bar ?? 0));
  // Every bar is labelled while the labels fit; otherwise the selected one.
  const labelAll = spacing >= 16;

  const pick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const index =
      points.length === 1
        ? 0
        : Math.round(((px - LEFT) / inner) * (points.length - 1));
    onSelect(Math.max(0, Math.min(points.length - 1, index)));
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const last = points.length - 1;
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? selected - 1
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? selected + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onSelect(Math.max(0, Math.min(last, next)));
  };

  return (
    <div className="trend-chart" ref={box}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={label}
        tabIndex={0}
        onClick={pick}
        onKeyDown={onKeyDown}
      >
        {ticks.map((tick) => (
          <g key={tick} aria-hidden="true">
            <line
              className="trend-grid"
              x1={LEFT}
              x2={width - RIGHT}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="trend-axis"
              x={LEFT - 6}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {axisLabel(tick, kind, metric, { thousands })}
            </text>
          </g>
        ))}
        {!combo && points.length > 1 && (
          <polygon
            className="trend-area"
            aria-hidden="true"
            points={`${x(0)},${base} ${line.join(" ")} ${x(points.length - 1)},${base}`}
          />
        )}
        <polyline
          className="trend-line"
          aria-hidden="true"
          points={line.join(" ")}
        />
        {combo && (
          <text
            className="trend-axis"
            aria-hidden="true"
            // Clear of the first bar, which is centred on the left edge.
            x={LEFT - barWidth / 2 - 4}
            y={barBase - 2}
            textAnchor="end"
          >
            {t("overview.repsAxis")}
          </text>
        )}
        {combo &&
          points.map((point, i) => {
            const h = 6 + ((point.bar ?? 0) / maxBar) * (BAR - 6);
            const on = i === selected;
            return (
              <g key={"bar" + point.workoutId} aria-hidden="true">
                <rect
                  className={"trend-bar" + (on ? " is-selected" : "")}
                  x={x(i) - barWidth / 2}
                  y={barBase - h}
                  width={barWidth}
                  height={h}
                  rx={Math.min(3, barWidth / 2)}
                />
                {(labelAll || on) && (
                  <text
                    className={"trend-bar-label" + (on ? " is-selected" : "")}
                    x={x(i)}
                    y={barBase - h - 4}
                    textAnchor="middle"
                  >
                    {point.bar}
                  </text>
                )}
              </g>
            );
          })}
        {/* The selected point last, so its neighbours never cover it. */}
        {[...points.keys()]
          .sort((a, b) => Number(a === selected) - Number(b === selected))
          .map((i) => ({ point: points[i], i }))
          .map(({ point, i }) => (
            <circle
              key={point.workoutId}
              aria-hidden="true"
              className={
                "trend-point" +
                (i === selected ? " is-selected" : "") +
                (i === best ? " is-best" : "")
              }
              cx={x(i)}
              cy={y(point.value)}
              r={i === selected ? 5.5 : 3.5}
            />
          ))}
        <text
          className="trend-axis"
          aria-hidden="true"
          x={points.length === 1 ? x(0) : LEFT}
          y={height - 4}
          textAnchor={points.length === 1 ? "middle" : "start"}
        >
          {shortDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text
            className="trend-axis"
            aria-hidden="true"
            x={width - RIGHT}
            y={height - 4}
            textAnchor="end"
          >
            {shortDate(points[points.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  );
}
