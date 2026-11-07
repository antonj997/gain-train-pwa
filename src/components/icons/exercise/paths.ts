/**
 * The movement icons: stick-figure pictograms on Lucide's 24 × 24 grid,
 * drawn with round 1.8 strokes and no fills. Each icon is a list of shapes:
 * a path's `d`, or a circle (the head, a plate or a wheel). They are checked
 * at 22px (rows) and 34px (the exercise page header) in both themes.
 *
 * Side views face right. A head is a circle of radius 2; the strokes keep
 * at least 2.5 units apart so they stay separate at 22px.
 */
export type Shape = string | { cx: number; cy: number; r: number };

const head = (cx: number, cy: number, r = 2): Shape => ({ cx, cy, r });

export const MOVEMENT_SHAPES = {
  // Lying on a flat bench, the bar pressed straight up.
  benchPress: [
    "M5.5 12H15.5",
    head(18.5, 12),
    "M13 12V5",
    "M8 5H18",
    "M9.5 3V7",
    "M16.5 3V7",
    "M5.5 12L3.5 20.5",
    "M7.5 15.5H17",
    "M9 15.5V20.5",
    "M15.5 15.5V20.5",
  ],
  // On a bench tilted up, the bar pressed straight up.
  inclinePress: [
    "M5 16L13.5 11",
    head(16.5, 9.4),
    "M13.5 11L10.5 4.8",
    "M5 4.8H15",
    "M6.5 2.8V6.8",
    "M13.5 2.8V6.8",
    "M5 16L3.5 21",
    "M8 19.5L17 14.5",
    "M12.5 17V21.5",
  ],
  // Seen from the front, both arms sweep round to meet.
  chestFly: [
    head(12, 4.5),
    "M12 7V14",
    "M12 14L9.5 21",
    "M12 14L14.5 21",
    "M12 9C9 9 5.5 8 4 5",
    "M12 9C15 9 18.5 8 20 5",
    "M2.5 6.5L5.5 3.5",
    "M18.5 3.5L21.5 6.5",
  ],
  // Straight arms, the body a plank from heels to head.
  pushUp: ["M3 19.5L15 12", "M15 12V19.5", head(18, 10.2)],
  // Between parallel bars, arms straight, knees bent behind.
  dip: [
    head(12, 4.2),
    "M6 12.5L8.5 8H15.5L18 12.5",
    "M12 6.7V14",
    "M12 14L10.5 18.5",
    "M12 14L13.5 18.5",
    "M3.5 12.5H8",
    "M16 12.5H20.5",
    "M5 12.5V21.5",
    "M19 12.5V21.5",
  ],
  // Standing, the bar pressed overhead.
  overheadPress: [
    head(12, 6.5),
    "M7 3L9 10H15L17 3",
    "M3.5 3H20.5",
    "M5 1.5V4.5",
    "M19 1.5V4.5",
    "M12 10V15",
    "M12 15L9.5 21.5",
    "M12 15L14.5 21.5",
  ],
  // Standing, straight arms raised to the side, a dumbbell in each hand.
  lateralRaise: [
    head(12, 4.5),
    "M3.5 9H20.5",
    "M3.5 7V11",
    "M20.5 7V11",
    "M12 7V15",
    "M12 15L9.5 21.5",
    "M12 15L14.5 21.5",
  ],
  // Hanging from a bar, chin pulled up to it.
  pullUp: [
    "M2.5 21.5V3H21.5V21.5",
    "M7.5 3L9 9.5H15L16.5 3",
    head(12, 6.4),
    "M12 9.5V15",
    "M12 15L10.5 18.5L12.5 20.5",
    "M12 15L14 18.5",
  ],
  // Seated under the cable, the bar pulled down in front of the face.
  latPulldown: [
    "M12 1.5V4",
    "M4.5 5.5L6 4H18L19.5 5.5",
    "M7.5 4L9 10.5H15L16.5 4",
    head(12, 7.8, 1.8),
    "M12 10.5V15.5",
    "M12 15.5L8.5 16.5V21",
    "M12 15.5L15.5 16.5V21",
  ],
  // Bent over, the bar pulled to the belly.
  row: [
    head(4.5, 6.5),
    "M6.5 7.8L15 11",
    "M15 11L14 21",
    "M15 11L18 21",
    "M10 9.5L9.5 13L11 15.5",
    "M5.5 15.5H16.5",
    "M7 13.5V17.5",
    "M15 13.5V17.5",
  ],
  // Rope pulled to the face, elbows high: face pulls and rear delts.
  facePull: [
    head(12, 5),
    "M7.5 3.5L5 9.5H19L16.5 3.5",
    "M12 7.5V15",
    "M12 15L9.5 21.5",
    "M12 15L14.5 21.5",
  ],
  // Arms hanging with dumbbells, shoulders lifted.
  shrug: [
    head(12, 6.2),
    "M7.5 9.5L9 8.5H15L16.5 9.5V15.5",
    "M7.5 9.5V15.5",
    "M6 15.5H9",
    "M15 15.5H18",
    "M12 8.5V15",
    "M12 15L10 21.5",
    "M12 15L14 21.5",
    "M4 6V2.5",
    "M2.5 4L4 2.5L5.5 4",
    "M20 6V2.5",
    "M18.5 4L20 2.5L21.5 4",
  ],
  // Hinged at the hips, the bar at the shins: deadlifts and RDLs.
  hinge: [
    head(5.5, 6),
    "M7.5 7.3L15 11",
    "M15 11L15 21",
    "M15 11L18 21",
    "M10.5 8.6V18.5",
    "M5 18.5H17",
    "M6.5 16.5V20.5",
    "M15.5 16.5V20.5",
  ],
  // Bar on the back, hips sitting back, knees forward.
  squat: [
    head(12, 4),
    "M3.5 7.5H20.5",
    "M5 5.5V9.5",
    "M19 5.5V9.5",
    "M12 6.5V13",
    "M8 21.5L7 15.5L12 13L17 15.5L16 21.5",
  ],
  // Long step, the back knee towards the floor: lunges and split squats.
  lunge: [
    head(11, 3.5),
    "M11 6V13",
    "M16.5 21V15.5L11 13",
    "M11 13L7.5 19.5L3.5 20.5",
    "M16.5 21H19",
  ],
  // Reclined, the feet press the sled up and away.
  legPress: [
    head(5, 5),
    "M6 7.5L8.5 15",
    "M8.5 15L10.5 9L15.5 9.5",
    "M14 6L17.5 12",
    "M15.75 9L20.5 4.5",
    "M2.5 8L5.5 17.5H11",
  ],
  // Seated, the lower leg swings up straight.
  legExtension: [
    head(6, 4),
    "M6 6.5V14",
    "M6 14H13",
    "M13 14L18.5 9",
    { cx: 20, cy: 7.8, r: 1.5 },
    "M4 17H14",
    "M5.5 17V21",
    "M12.5 17V21",
  ],
  // Lying face down, the heel curls towards the seat.
  legCurl: [
    head(3.8, 11),
    "M6 12.5H16",
    "M16 12.5L18.5 6",
    { cx: 19.5, cy: 3.8, r: 1.5 },
    "M3 15.5H17",
    "M5 15.5V20",
    "M15 15.5V20",
  ],
  // Shoulders on a bench, hips driven up: hip thrusts and glute bridges.
  hipThrust: [
    head(3.5, 9.8),
    "M5.5 12L13 10.5L18 12.5V20.5",
    "M13 8V3",
    "M11.5 4.5L13 3L14.5 4.5",
    "M2 13.5H7.5V20.5",
    "M16 20.5H20",
  ],
  // Seated, knees pushed apart (or squeezed) against the pads.
  hipAbduction: [
    head(12, 3.5),
    "M12 6V13",
    "M12 13L6.5 15.5V21",
    "M12 13L17.5 15.5V21",
    "M8 9.5H16",
    "M2.5 12L4.5 10",
    "M2.5 12L4.5 14",
    "M21.5 12L19.5 10",
    "M21.5 12L19.5 14",
  ],
  // Up on the toes on a step.
  calfRaise: [
    head(13, 3.5),
    "M13 6V13.5",
    "M10 9H16",
    "M13 13.5V19L14.5 21",
    "M13.5 21H21",
    "M6 15V8",
    "M4.5 9.5L6 8L7.5 9.5",
  ],
  // The upper arm still, the forearm curls the dumbbell up.
  curl: [
    head(8, 3.8),
    "M8 6.3V14",
    "M8 14L6 21.5",
    "M8 14L10 21.5",
    "M8 8.5L10.5 13L15 8",
    "M13.2 6.5L16.8 9.5",
  ],
  // Elbows at the sides, the cable pushed down.
  tricepsExtension: [
    head(8, 3.8),
    "M8 6.3V14",
    "M8 14L6 21.5",
    "M8 14L10 21.5",
    "M8 8.5L10.5 12.5L15 15",
    "M15 15V2",
  ],
  // On the back, knees bent, shoulders curled up.
  crunch: [
    head(5.2, 11.5),
    "M7 14C8 16.5 9.5 18 11.5 18.5",
    "M11.5 18.5L15 12.5L19 18.5",
    "M2 21H22",
  ],
  // Forearms on the floor, the body straight: planks and core holds.
  plank: ["M3 17.5L14.5 13.5", "M14.5 13.5V18H19.5", head(17.8, 11.6)],
  // Hanging from a bar, legs raised in front.
  legRaise: [
    "M5 2.5H19",
    "M9 2.5L10 8.5H14L15 2.5",
    head(12, 5.6, 1.8),
    "M12 8.5V14.5",
    "M12 14.5H20",
  ],
  // Walking with a weight in each hand.
  carry: [
    head(12, 3.8),
    "M8.5 8.5L6.5 14",
    "M15.5 8.5L17.5 14",
    "M8.5 8.5H15.5",
    "M12 6.3V13.5",
    "M12 13.5L10 21.5",
    "M12 13.5L14 21.5",
    { cx: 6, cy: 16.5, r: 2 },
    { cx: 18, cy: 16.5, r: 2 },
  ],
  // Arms up, legs out: jumps and burpees.
  jump: [
    head(12, 4.2),
    "M12 6.7V14",
    "M5 3L8.5 9H15.5L19 3",
    "M12 14L7.5 19",
    "M12 14L16.5 19",
    "M4 22H20",
  ],
  // A runner mid-stride: treadmill, running and sled pushes.
  run: [
    head(15.5, 3.5),
    "M14 6L11 13",
    "M13.5 7.5L17 10L19.5 8.5",
    "M13.5 7.5L9.5 9L8 7",
    "M11 13L15 15.5L14 20.5",
    "M11 13L8.5 17L4.5 17",
  ],
  // A rider on a bike: exercise and assault bikes.
  bike: [
    { cx: 5.5, cy: 17.5, r: 3.5 },
    { cx: 18.5, cy: 17.5, r: 3.5 },
    head(15.5, 3.5),
    "M8.5 9.5L14.5 6.5L17 10.5",
    "M8.5 9.5L12.5 13L11 17.5",
    "M5.5 17.5L8.5 11.5",
    "M17 10.5L18.5 17.5",
  ],
  // Seated on the rail, leaning back, the handle at the ribs: rower and ski erg.
  rower: [
    head(5.5, 7),
    "M6.5 9.5L9.5 17",
    "M9.5 17L14 12L18.5 18",
    "M7 11L12 14",
    "M2 20.5H22",
    "M8 17.5H12",
  ],
  // Climbing steps: stair climber and cross trainer.
  stairs: [
    "M2.5 21H7V17H11.5V13H16V9H21.5",
    head(8, 2.8),
    "M8 5.3V10.5",
    "M8 10.5L7 17",
    "M8 10.5L12 10L12.5 13",
    "M5.5 9L8 7L10.5 8.5",
  ],
  // A dumbbell: your own exercises and anything hard to draw.
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
} satisfies Record<string, Shape[]>;

export type Movement = keyof typeof MOVEMENT_SHAPES;
export const MOVEMENTS = Object.keys(MOVEMENT_SHAPES) as Movement[];
