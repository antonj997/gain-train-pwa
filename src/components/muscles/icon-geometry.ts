// The small muscle icon's block figure on a 24 × 24 grid (the approved UX
// demo, "Övningsikoner och muskelkartor"): a head, a torso, two arms and two
// long legs (the crotch at half the height, the knees at about 72 %). The
// zones are not muscle shapes; each covers part of a body part (see
// ICON_ZONES in src/lib/muscle-figure.ts), parted from its neighbours by a
// thin line of the body colour.
import type { FigureView, IconZone } from "@/lib/muscle-figure";

type Point = readonly [x: number, y: number];

const f2 = (value: number) => Number(value.toFixed(2));

/** A closed polygon path. */
const polygon = (points: readonly Point[]) =>
  "M" + points.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(" L") + " Z";

const PARTS = {
  torso: [
    [8.3, 6],
    [15.7, 6],
    [15.2, 12.2],
    [8.8, 12.2],
  ],
  armL: [
    [6, 6.55],
    [8.05, 6.2],
    [8.3, 13.15],
    [6.35, 13.3],
  ],
  armR: [
    [18, 6.55],
    [15.95, 6.2],
    [15.7, 13.15],
    [17.65, 13.3],
  ],
  legL: [
    [8.8, 12.45],
    [11.8, 12.45],
    [11.5, 23.4],
    [9.2, 23.4],
  ],
  legR: [
    [12.2, 12.45],
    [15.2, 12.45],
    [14.8, 23.4],
    [12.5, 23.4],
  ],
} satisfies Record<string, Point[]>;
type Part = keyof typeof PARTS;

type Box = { x0?: number; x1?: number; y0?: number; y1?: number };

/** The part of a convex polygon inside a box (cut by up to four lines). */
function cut(points: readonly Point[], box: Box) {
  const { x0 = -99, x1 = 99, y0 = -99, y1 = 99 } = box;
  let out = points;
  const lines: [axis: 0 | 1, limit: number, low: boolean][] = [
    [1, y0, true],
    [1, y1, false],
    [0, x0, true],
    [0, x1, false],
  ];
  for (const [axis, limit, low] of lines) {
    const kept: Point[] = [];
    const inside = (p: Point) => (low ? p[axis] >= limit : p[axis] <= limit);
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length];
      if (inside(p)) kept.push(p);
      if (inside(p) !== inside(q)) {
        const t = (limit - p[axis]) / (q[axis] - p[axis]);
        kept.push(
          axis
            ? [p[0] + t * (q[0] - p[0]), limit]
            : [limit, p[1] + t * (q[1] - p[1])],
        );
      }
    });
    out = kept;
  }
  return polygon(out);
}

// The arm in thirds, the glutes at the top of the leg seen from behind, the
// knee, and the half-width of the line between zones.
const A1 = 8.57;
const A2 = 10.93;
const SEAT = 14.6;
const KNEE = 17.2;
const G = 0.15;

/** Mirrors a path drawn for the half at x >= 12 onto the other half. */
const mirror = (d: string) =>
  d.replace(
    /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,
    (_, x: string, y: string) => `${f2(24 - Number(x))} ${y}`,
  );
const both = (d: string) => `${d} ${mirror(d)}`;

type ZoneShape = readonly [zone: IconZone, d: string];

// The torso is shaped so the side reads at a glance. Front: two pecs with a
// rounded lower edge, the abs as a column and the obliques beside them. Back:
// the traps as a triangle from the neck with a full lower edge; the lats (with
// the upper back) as two wings parted at the spine, wide at the armpits and
// rounding in to the waist; the lower back as a small rounded triangle between
// them at the bottom.
const TORSO_ZONES: Record<FigureView, ZoneShape[]> = {
  front: [
    [
      "chest",
      both(
        "M12.2 6.3 L15.45 6.3 L15.35 7.5 C15.2 8.4 14.5 8.85 13.6 8.85 L12.2 8.85 Z",
      ),
    ],
    [
      "core",
      both("M12.2 9.25 L14.05 9.25 L13.8 11.85 L12.2 11.85 Z") +
        " " +
        both("M14.45 9.35 L15.38 9.2 L15.12 11.55 L14.2 11.85 Z"),
    ],
  ],
  back: [
    ["traps", both("M12 6 L15.2 6 C14.4 6.9 13.1 7.8 12 8.3 Z")],
    [
      "midBack",
      both(
        "M12.3 8.52 C13.4 8 14.65 7.1 15.44 6.21 L15.69 6.05 L15.25 11.6 C14.3 11.55 12.9 11 12.3 10.2 Z",
      ),
    ],
    ["lowerBack", both("M12 10.5 C12.7 10.95 13.4 11.5 13.75 12.2 L12 12.2 Z")],
  ],
};

const armZones = (arm: Part): ZoneShape[] => [
  ["shoulders", cut(PARTS[arm], { y1: A1 - G })],
  ["upperArm", cut(PARTS[arm], { y0: A1 + G, y1: A2 - G })],
  ["forearms", cut(PARTS[arm], { y0: A2 + G })],
];
const frontLeg = (leg: Part): ZoneShape[] => [
  ["thighs", cut(PARTS[leg], { y1: KNEE - G })],
  ["calves", cut(PARTS[leg], { y0: KNEE + G })],
];
const backLeg = (leg: Part): ZoneShape[] => [
  ["glutes", cut(PARTS[leg], { y1: SEAT - G })],
  ["thighs", cut(PARTS[leg], { y0: SEAT + G, y1: KNEE - G })],
  ["calves", cut(PARTS[leg], { y0: KNEE + G })],
];

/**
 * The zones drawn from each side, back to front. Arms and legs hold the same
 * muscles from both sides; from behind the glutes sit at the top of the legs.
 */
export const ICON_ZONE_SHAPES: Record<FigureView, readonly ZoneShape[]> = {
  front: [
    ...TORSO_ZONES.front,
    ...armZones("armL"),
    ...armZones("armR"),
    ...frontLeg("legL"),
    ...frontLeg("legR"),
  ],
  back: [
    ...TORSO_ZONES.back,
    ...armZones("armL"),
    ...armZones("armR"),
    ...backLeg("legL"),
    ...backLeg("legR"),
  ],
};

/** The body under the zones: the head and the body parts. */
export const ICON_HEAD = { cx: 12, cy: 3.05, r: 2.05 } as const;
export const ICON_BODY: readonly string[] = Object.values(PARTS).map(polygon);

/**
 * The cardio icon's heart, about 6 units wide, centred on the chest of the
 * front figure.
 */
export const ICON_HEART =
  "M12 11.6 C10.2 10.3 9 9.2 9 7.9 C9 7 9.7 6.4 10.5 6.4 C11.2 6.4 11.7 6.8 12 7.3 C12.3 6.8 12.8 6.4 13.5 6.4 C14.3 6.4 15 7 15 7.9 C15 9.2 13.8 10.3 12 11.6 Z";
