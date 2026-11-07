import { catalogueById } from "../data/catalogue";
import type { Movement } from "../components/icons/exercise/paths";

/**
 * Which movement icon each catalogue exercise shows, by its English name.
 * Every catalogue entry is listed (a test checks it), so a new one gets a
 * deliberate choice; the fallbacks below only cover a built-in id this
 * version doesn't know and records from a newer app.
 */
export const MOVEMENT_BY_NAME: Record<string, Movement> = {
  // Chest
  "Bench Press": "benchPress",
  "Incline Press": "inclinePress",
  "Decline Bench Press": "benchPress",
  "Dumbbell Press": "benchPress",
  "Incline Dumbbell Press": "inclinePress",
  "Dumbbell Fly": "chestFly",
  "Incline Dumbbell Fly": "chestFly",
  "Cable Fly": "chestFly",
  "Cable Crossover": "chestFly",
  "Machine Chest Press": "benchPress",
  "Pec Deck Machine": "chestFly",
  "Smith Bench Press": "benchPress",
  "Floor Press": "benchPress",
  "Push Up": "pushUp",
  "Diamond Push Up": "pushUp",
  Dip: "dip",
  // Back
  Deadlift: "hinge",
  "Romanian Deadlift": "hinge",
  "Stiff Leg Deadlift": "hinge",
  "Dumbbell Romanian Deadlift": "hinge",
  "Trap Bar Deadlift": "hinge",
  "Rack Pull": "hinge",
  "Barbell Row": "row",
  "Pendlay Row": "row",
  "Reverse Grip Barbell Row": "row",
  "T-Bar Row": "row",
  "Single Arm Dumbbell Row": "row",
  "Chest Supported Row": "row",
  "Machine Row": "row",
  "Cable Row": "row",
  "Seated Cable Row": "row",
  "Single Arm Cable Row": "row",
  "Inverted Row": "row",
  "Lat Pulldown": "latPulldown",
  "Wide Grip Lat Pulldown": "latPulldown",
  "Close Grip Lat Pulldown": "latPulldown",
  "Straight Arm Pulldown": "latPulldown",
  "Pull Up": "pullUp",
  "Chin Up": "pullUp",
  "Neutral Grip Pull Up": "pullUp",
  "Assisted Pull Up": "pullUp",
  "Dumbbell Pullover": "latPulldown",
  Hyperextension: "hinge",
  "Good Morning": "hinge",
  "Kettlebell Row": "row",
  "Band Row": "row",
  Superman: "plank",
  // Shoulders
  "Overhead Press": "overheadPress",
  "Push Press": "overheadPress",
  "Dumbbell Shoulder Press": "overheadPress",
  "Arnold Press": "overheadPress",
  "Machine Shoulder Press": "overheadPress",
  "Smith Shoulder Press": "overheadPress",
  "Landmine Press": "overheadPress",
  "Kettlebell Press": "overheadPress",
  "Pike Push Up": "pushUp",
  "Handstand Push Up": "overheadPress",
  "Lateral Raise": "lateralRaise",
  "Cable Lateral Raise": "lateralRaise",
  "Front Raise": "lateralRaise",
  "Rear Delt Fly": "facePull",
  "Cable Rear Delt Fly": "facePull",
  "Reverse Pec Deck": "facePull",
  "Face Pull": "facePull",
  "Upright Row": "shrug",
  Shrugs: "shrug",
  "Barbell Shrug": "shrug",
  "Band Pull Apart": "facePull",
  // Arms
  "Dumbbell Curl": "curl",
  "Barbell Curl": "curl",
  "EZ Bar Curl": "curl",
  "Hammer Curl": "curl",
  "Incline Dumbbell Curl": "curl",
  "Preacher Curl": "curl",
  "Concentration Curl": "curl",
  "Spider Curl": "curl",
  "Cable Curl": "curl",
  "Machine Curl": "curl",
  "Reverse Curl": "curl",
  "Wrist Curl": "curl",
  "Tricep Pushdown": "tricepsExtension",
  "Rope Pushdown": "tricepsExtension",
  "Reverse Grip Pushdown": "tricepsExtension",
  "Cable Tricep Extension": "tricepsExtension",
  "Overhead Tricep Extension": "tricepsExtension",
  "Cable Overhead Tricep Extension": "tricepsExtension",
  "Skull Crusher": "tricepsExtension",
  "Close Grip Bench Press": "benchPress",
  "Dumbbell Tricep Kickback": "tricepsExtension",
  "Machine Tricep Extension": "tricepsExtension",
  "Tricep Dip": "dip",
  // Legs
  Squat: "squat",
  "Front Squat": "squat",
  "Box Squat": "squat",
  "Smith Squat": "squat",
  "Hack Squat": "squat",
  "Goblet Squat": "squat",
  "Bulgarian Split Squat": "lunge",
  "Split Squat": "lunge",
  Lunges: "lunge",
  "Walking Lunges": "lunge",
  "Reverse Lunge": "lunge",
  "Step Up": "lunge",
  "Leg Press": "legPress",
  "Leg Press Machine": "legPress",
  "Leg Extension": "legExtension",
  "Leg Curl": "legCurl",
  "Lying Leg Curl": "legCurl",
  "Seated Leg Curl": "legCurl",
  "Nordic Hamstring Curl": "legCurl",
  "Hip Adduction Machine": "hipAbduction",
  "Sumo Deadlift": "hinge",
  "Calf Raise": "calfRaise",
  "Standing Calf Raise": "calfRaise",
  "Seated Calf Raise": "calfRaise",
  "Bodyweight Squat": "squat",
  "Pistol Squat": "squat",
  "Wall Sit": "squat",
  "Box Jump": "jump",
  // Glutes
  "Hip Thrust": "hipThrust",
  "Machine Hip Thrust": "hipThrust",
  "Single Leg Hip Thrust": "hipThrust",
  "Glute Bridge": "hipThrust",
  "Cable Pull Through": "hinge",
  "Cable Kickback": "hipThrust",
  "Glute Kickback Machine": "hipThrust",
  "Hip Abduction Machine": "hipAbduction",
  "Reverse Hyperextension": "hinge",
  "Single Leg Romanian Deadlift": "hinge",
  "Curtsy Lunge": "lunge",
  "Banded Lateral Walk": "hipAbduction",
  // Core
  Plank: "plank",
  "Side Plank": "plank",
  "Hollow Hold": "plank",
  "L-Sit": "legRaise",
  "Ab Wheel": "plank",
  "Cable Crunch": "crunch",
  "Machine Crunch": "crunch",
  Crunch: "crunch",
  "Sit Up": "crunch",
  "Bicycle Crunch": "crunch",
  "V-Up": "crunch",
  "Leg Raise": "legRaise",
  "Hanging Leg Raise": "legRaise",
  "Toes To Bar": "legRaise",
  "Russian Twist": "crunch",
  "Cable Woodchop": "plank",
  "Pallof Press": "plank",
  "Dumbbell Side Bend": "plank",
  "Dead Bug": "crunch",
  "Mountain Climber": "plank",
  // Full body
  "Kettlebell Swing": "hinge",
  "Turkish Get Up": "dumbbell",
  "Kettlebell Deadlift": "hinge",
  "Power Clean": "hinge",
  "Clean And Jerk": "overheadPress",
  Snatch: "overheadPress",
  Thruster: "squat",
  "Dumbbell Snatch": "overheadPress",
  "Farmer Carry": "carry",
  "Suitcase Carry": "carry",
  Burpee: "jump",
  "Sled Push": "run",
  // Cardio
  Treadmill: "run",
  "Rowing Machine": "rower",
  "Cross Trainer": "stairs",
  "Exercise Bike": "bike",
  "Stair Climber": "stairs",
  "Ski Erg": "rower",
  "Assault Bike": "bike",
};

/** The movement most exercises of a main category share, when a name isn't listed. */
const BY_CATEGORY: Record<string, Movement> = {
  Chest: "benchPress",
  Back: "row",
  Shoulders: "overheadPress",
  Arms: "curl",
  Legs: "squat",
  Glutes: "hipThrust",
  Core: "plank",
  Cardio: "run",
};

export type MovementSource = {
  /** A catalogue id ("builtin:squat") or a custom exercise's id. */
  id: string;
  /** The main category, used when the id isn't in this version's catalogue. */
  category?: string;
  equipment?: string;
};

/**
 * The movement icon an exercise shows: the catalogue's explicit choice by
 * name, else one by equipment (a cardio machine) or main category, and the
 * dumbbell as the last resort. Your own exercises always get the dumbbell:
 * their names can say anything.
 */
export function movementIcon(exercise: MovementSource): Movement {
  if (!exercise.id.startsWith("builtin:")) return "dumbbell";
  const builtin = catalogueById.get(exercise.id);
  const byName = builtin && MOVEMENT_BY_NAME[builtin.name];
  if (byName) return byName;
  const equipment = builtin?.equipment ?? exercise.equipment;
  if (equipment === "cardio machine") return "run";
  return (
    BY_CATEGORY[builtin?.category ?? exercise.category ?? ""] ?? "dumbbell"
  );
}

/** The CSS key of a main category's tint: "full-body"; anything unknown is "other". */
export function categoryTone(category: string | undefined): string {
  const known = [
    "Chest",
    "Back",
    "Shoulders",
    "Arms",
    "Legs",
    "Glutes",
    "Core",
    "Cardio",
    "Full body",
  ];
  return category && known.includes(category)
    ? category.toLowerCase().replace(" ", "-")
    : "other";
}
