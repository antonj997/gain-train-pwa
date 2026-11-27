// The equipment glyphs your own exercises can show (EquipmentIcon).

/** A path's `d`, or a circle (a head, a plate or a wheel). */
export type Shape = string | { cx: number; cy: number; r: number };

/** The equipment glyphs your own exercises can show; none chosen is the dumbbell. */
export const EQUIPMENT_ICONS = [
  "dumbbell",
  "barbell",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "bodyweight",
] as const;
export type EquipmentIconKind = (typeof EQUIPMENT_ICONS)[number];

const head = (cx: number, cy: number, r = 2): Shape => ({ cx, cy, r });

/**
 * The glyphs, drawn like Lucide icons: a 24 × 24 grid, round 1.8 strokes, no fills, strokes at least 2.5 units apart so they
 * stay separate at 22px.
 */
export const EQUIPMENT_SHAPES: Record<EquipmentIconKind, readonly Shape[]> = {
  // A short bar with two plates at each end.
  dumbbell: [
    "M7 8V16",
    "M17 8V16",
    "M4 10V14",
    "M20 10V14",
    "M7 12H17",
    "M4 10H7",
    "M4 14H7",
    "M17 10H20",
    "M17 14H20",
  ],
  // A long bar with a big and a small plate at each end.
  barbell: [
    "M2 12H22",
    "M7.5 6V18",
    "M16.5 6V18",
    "M5 8.5V15.5",
    "M19 8.5V15.5",
  ],
  // A round bell with a flat base and the handle over it.
  kettlebell: [
    "M7.2 20.5C5.9 19.2 5.2 17.4 5.2 15.5C5.2 11.9 8.2 9 12 9C15.8 9 18.8 11.9 18.8 15.5C18.8 17.4 18.1 19.2 16.8 20.5Z",
    "M8.6 9.8L8.2 7.2C8 5 9.7 3.5 12 3.5C14.3 3.5 16 5 15.8 7.2L15.4 9.8",
  ],
  // v6 (H4, the owner's E3): two rails and a stack of three plates with the
  // cable over it; no lock pin.
  machine: [
    "M5 3V21",
    "M19 3V21",
    "M8 6H16V9H8Z",
    "M8 11H16V14H8Z",
    "M8 16H16V19H8Z",
    "M12 3V6",
  ],
  // v6 (H4): a pulley hung from a beam, the cable over it to a weight on one
  // side and a D-handle on the other, drawn for 22px.
  cable: [
    "M4 3H20",
    "M8 3V5",
    head(8, 8, 3),
    "M5 8V20",
    "M11 8L17.5 15.5",
    "M15 18L19.5 13.5L21 15L16.5 19.5Z",
  ],
  // A loop band.
  band: [
    "M3 12A9 5.5 0 1 0 21 12A9 5.5 0 1 0 3 12Z",
    "M6 12A6 2.5 0 1 0 18 12A6 2.5 0 1 0 6 12Z",
  ],
  // A person standing.
  bodyweight: [
    head(12, 4.5),
    "M12 7.5V14",
    "M6 11.5L12 9L18 11.5",
    "M12 14L9 21",
    "M12 14L15 21",
  ],
};
