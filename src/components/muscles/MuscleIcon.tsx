import { memo } from "react";
import type { ExerciseMuscles } from "@/data/muscles";
import { figureView, zoneLevel } from "@/lib/muscle-figure";
import {
  ICON_BODY,
  ICON_HEAD,
  ICON_HEART,
  ICON_ZONE_SHAPES,
} from "./icon-geometry";

// The colours come from the avatar's category tone (muscles.css defines the
// --mi-* mixes on .ex-avatar and .routine-badge); elsewhere the icon mixes its
// text colour into the surface, opaque so the zones keep their order over the
// body.
const mix = (percent: number) =>
  `color-mix(in srgb, currentColor ${percent}%, var(--gt-surface, transparent))`;
const BODY = `var(--mi-body, ${mix(35)})`;
const OFF = `var(--mi-off, ${mix(15)})`;
const HELP = `var(--mi-help, ${mix(60)})`;
const MAIN = "var(--mi-main, currentColor)";
const LEVEL_FILL = { 0: OFF, 0.5: HELP, 1: MAIN } as const;

type Props = {
  muscles: ExerciseMuscles;
  /** Cardio: the front figure untrained, with a heart on the chest. */
  cardio?: boolean;
  /** 22 in a 40px avatar, 34 in the 60px one. */
  size?: number;
  className?: string;
};

/**
 * An exercise's small muscle icon: the block figure from the side where its
 * main muscles sit, each zone in the level of its most trained muscle (main,
 * helping or untrained). Decorative: the exercise's name is always beside it.
 */
function MuscleIcon({ muscles, cardio = false, size = 22, className }: Props) {
  const view = cardio ? "front" : figureView(muscles);
  return (
    <svg
      className={"muscle-icon" + (className ? " " + className : "")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-view={cardio ? "cardio" : view}
    >
      <g fill={BODY}>
        <circle cx={ICON_HEAD.cx} cy={ICON_HEAD.cy} r={ICON_HEAD.r} />
        {ICON_BODY.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {ICON_ZONE_SHAPES[view].map(([zone, d]) => (
        <path
          key={d}
          d={d}
          fill={cardio ? OFF : LEVEL_FILL[zoneLevel(muscles, zone)]}
          data-zone={zone}
        />
      ))}
      {cardio && <path d={ICON_HEART} fill={MAIN} />}
    </svg>
  );
}

export default memo(MuscleIcon);
