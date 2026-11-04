export const workoutPath = (id: string) => "/workout/" + id;
/** History, optionally with one workout's details open and one set highlighted. */
export const historyPath = (workoutId?: string, setId?: string) =>
  workoutId
    ? "/history?workout=" + workoutId + (setId ? "&set=" + setId : "")
    : "/history";
/** The exercise page, optionally on its History or Records segment. */
export const exercisePath = (
  exerciseId: string,
  tab?: "overview" | "history" | "records",
) =>
  "/exercise/" +
  encodeURIComponent(exerciseId) +
  (tab && tab !== "overview" ? "?tab=" + tab : "");
/** Library → Exercises with a custom exercise's editor opened. */
export const exerciseEditPath = (exerciseId: string) =>
  "/library?tab=exercises&edit=" + encodeURIComponent(exerciseId);
/** Library → Routines, with one routine's editor opened. */
export const routineEditPath = (routineId: string) =>
  "/library?edit=" + routineId;
