export const workoutPath = (id: string) => "/workout/" + id;
/** History, optionally with one workout's details open. */
export const historyPath = (workoutId?: string) =>
  workoutId ? "/history?workout=" + workoutId : "/history";
/** Library → Routines, with one routine's editor opened. */
export const routineEditPath = (routineId: string) =>
  "/library?edit=" + routineId;
