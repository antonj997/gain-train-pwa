import { memo, useId, useMemo } from "react";
import type { Muscle } from "@/data/muscles";
import { pickFill } from "@/lib/muscle-figure";
import {
  FIGURES,
  type FigureGeometry,
  type MapFigure,
  type MuscleShape,
} from "./detailed-geometry";

type Fills = Partial<Record<Muscle, string>>;
type Ranks = Partial<Record<Muscle, number>>;

type Props = {
  /** A colour per muscle (a token, e.g. var(--gt-map-main)); the rest are untrained. */
  fills: Fills;
  /** Which colour a shape covering several muscles takes: the highest rank (default 1). */
  rank?: Ranks;
  figure: MapFigure;
  /** The spoken description; without one the map is decorative. */
  title?: string;
  className?: string;
  /**
   * One side only (v6 §E3: the editor's picker, 138 × 327 px); both side by
   * side by default.
   */
  side?: "front" | "back";
  /** A tap on a muscle shape, with the muscles it draws (a shortcut). */
  onPick?: (muscles: readonly Muscle[]) => void;
};

const FIG = "var(--gt-map-fig)";
const OFF = "var(--gt-map-off)";
// The dark gap between muscles, the outline of the torso and arm, and how
// much the rounding filter rounds the muscles' corners.
const GAP = 1.4;
const EDGE = 2.2;
const ROUND = 0.7;

/** An id usable in url(#…): React's useId gives ":r1:". */
const svgId = (id: string) => "mm" + id.replace(/[^a-zA-Z0-9_-]/g, "");

type Ids = { round: string; arm: string; front: string; back: string };

/**
 * Rounds every corner evenly: a mask of the muscle areas (anything brighter
 * than the black figure) is blurred and cut at half, then the colours are cut
 * by it. Keep it exactly as the demo has it; it needs a black figure colour.
 */
function RoundFilter({ id }: { id: string }) {
  return (
    <filter
      id={id}
      x="-5%"
      y="-5%"
      width="110%"
      height="110%"
      colorInterpolationFilters="sRGB"
    >
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3 3 3 0 0"
        result="m"
      />
      <feGaussianBlur
        in="m"
        stdDeviation={(ROUND * 0.8).toFixed(2)}
        result="b"
      />
      <feComponentTransfer in="b" result="t">
        <feFuncA type="linear" slope="14" intercept="-6.5" />
      </feComponentTransfer>
      <feMorphology
        in="SourceGraphic"
        operator="dilate"
        radius={(ROUND * 1.2).toFixed(2)}
        result="c"
      />
      <feComposite in="c" in2="t" operator="in" />
    </filter>
  );
}

function Muscles({
  shapes,
  clip,
  round,
  fills,
  rank,
  onPick,
}: {
  shapes: readonly MuscleShape[];
  clip: string;
  round: string;
  fills: Fills;
  rank?: Ranks;
  onPick?: (muscles: readonly Muscle[]) => void;
}) {
  return (
    <g filter={`url(#${round})`}>
      <g
        className="muscle-map-muscles"
        clipPath={`url(#${clip})`}
        stroke={FIG}
        strokeWidth={GAP}
        strokeLinejoin="round"
      >
        {shapes.map(([id, muscles, d]) => (
          <path
            key={id}
            d={d}
            fill={pickFill(muscles, fills, rank) ?? OFF}
            data-muscle={id}
            onClick={onPick && (() => onPick(muscles))}
          />
        ))}
      </g>
    </g>
  );
}

/** One side of the body (front or back): the head and a mirrored half. */
function Figure({
  geometry,
  side,
  ids,
  fills,
  rank,
  onPick,
}: {
  geometry: FigureGeometry;
  side: "front" | "back";
  ids: Ids;
  fills: Fills;
  rank?: Ranks;
  onPick?: (muscles: readonly Muscle[]) => void;
}) {
  const torso = side === "front" ? geometry.torsoFront : geometry.torsoBack;
  const half = (
    <>
      <g transform={geometry.tilt}>
        <path d={geometry.arm} fill={FIG} />
        <Muscles
          shapes={side === "front" ? geometry.frontArm : geometry.backArm}
          clip={ids.arm}
          round={ids.round}
          fills={fills}
          rank={rank}
          onPick={onPick}
        />
        <path
          d={geometry.arm}
          fill="none"
          stroke={FIG}
          strokeWidth={EDGE}
          strokeLinejoin="round"
        />
        <path d={geometry.hand} transform={geometry.handRotate} fill={FIG} />
      </g>
      <path d={torso} fill={FIG} />
      <Muscles
        shapes={side === "front" ? geometry.front : geometry.back}
        clip={ids[side]}
        round={ids.round}
        fills={fills}
        rank={rank}
        onPick={onPick}
      />
      <path
        d={torso}
        fill="none"
        stroke={FIG}
        strokeWidth={EDGE}
        strokeLinejoin="round"
      />
    </>
  );
  return (
    <>
      <ellipse cx={50} cy={15.9} rx={geometry.head.rx} ry={13.9} fill={FIG} />
      {geometry.head.hair && <path d={geometry.head.hair} fill={FIG} />}
      <path d={geometry.head.neck} fill={FIG} />
      {half}
      <g transform="translate(100 0) scale(-1 1)">{half}</g>
    </>
  );
}

/**
 * The detailed muscle map: the front and the back of a man or a woman side
 * by side, each muscle in its fill (untrained ones grey) on a black figure.
 * Put it in a `.muscle-map` panel; it fills the panel's width.
 */
function MuscleMap({
  fills,
  rank,
  figure,
  title,
  className,
  side,
  onPick,
}: Props) {
  const uid = svgId(useId());
  const content = useMemo(() => {
    const geometry = FIGURES[figure];
    const ids: Ids = {
      round: `${uid}-round`,
      arm: `${uid}-arm`,
      front: `${uid}-front`,
      back: `${uid}-back`,
    };
    return (
      <>
        <defs>
          <RoundFilter id={ids.round} />
          <clipPath id={ids.arm}>
            <path d={geometry.arm} />
          </clipPath>
          <clipPath id={ids.front}>
            <path d={geometry.torsoFront} />
          </clipPath>
          <clipPath id={ids.back}>
            <path d={geometry.torsoBack} />
          </clipPath>
        </defs>
        {side ? (
          <Figure
            geometry={geometry}
            side={side}
            ids={ids}
            fills={fills}
            rank={rank}
            onPick={onPick}
          />
        ) : (
          <>
            <g transform="translate(10 0)">
              <Figure
                geometry={geometry}
                side="front"
                ids={ids}
                fills={fills}
                rank={rank}
                onPick={onPick}
              />
            </g>
            <g transform="translate(130 0)">
              <Figure
                geometry={geometry}
                side="back"
                ids={ids}
                fills={fills}
                rank={rank}
                onPick={onPick}
              />
            </g>
          </>
        )}
      </>
    );
  }, [uid, figure, fills, rank, side, onPick]);
  return (
    <svg
      className={"muscle-map-svg" + (className ? " " + className : "")}
      // One side is the figure's own 100 units less the margin both share.
      viewBox={side ? "3 0 94 218" : "13 0 214 218"}
      data-side={side}
      focusable="false"
      data-figure={figure}
      {...(title
        ? { role: "img", "aria-label": title }
        : { "aria-hidden": true })}
    >
      {content}
    </svg>
  );
}

export default memo(MuscleMap);
