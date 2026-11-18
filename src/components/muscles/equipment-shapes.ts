// The equipment glyphs your own exercises can show (EquipmentIcon).
import { MOVEMENT_SHAPES, type Shape } from "../icons/exercise/paths";

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
 * The glyphs, drawn like the movement icons (paths.ts): Lucide's 24 × 24
 * grid, round 1.8 strokes, no fills, strokes at least 2.5 units apart so they
 * stay separate at 22px.
 */
export const EQUIPMENT_SHAPES: Record<EquipmentIconKind, readonly Shape[]> = {
  dumbbell: MOVEMENT_SHAPES.dumbbell,
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
  // A frame with the cable down to a weight stack.
  machine: [
    "M5 21V3H19V21",
    "M3 21H21",
    "M12 3V11",
    "M8.5 11H15.5V18H8.5Z",
    "M8.5 14.5H15.5",
  ],
  // A pulley, the cable and a stirrup handle.
  cable: [
    head(12, 5, 2.5),
    "M12 7.5V14",
    "M12 14C10 15.5 8.5 17.5 8.5 19.5H15.5C15.5 17.5 14 15.5 12 14Z",
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
