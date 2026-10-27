export const workoutPath = (id: string) => "/workout/" + id;
/** History, optionally with one workout's details open. */
export const historyPath = (workoutId?: string) =>
  workoutId ? "/history?workout=" + workoutId : "/history";
