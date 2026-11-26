export const workoutPath = (id: string) => "/workout/" + id;
/** The Calendar tab (still at /history), optionally with one workout's details open and one set highlighted. */
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
/**
 * Library → Upptäck with one shared routine's preview open: the Dela sheet's
 * link. It works for anyone signed in; signed out, Upptäck asks to sign in.
 */
export const sharedRoutinePath = (sharedId: string) =>
  "/library?tab=discover&shared=" + encodeURIComponent(sharedId);
/** Library → Plan: the plans list and editor. */
export const PLANS_PATH = "/library/plan";
/** One plan's status page: how the phase is going, with Edit one tap away. */
export const planStatusPath = (planId: string) =>
  PLANS_PATH + "/" + encodeURIComponent(planId);
/**
 * v6: Library → Rutiner with Upptäck chosen (its "Mina | Upptäck" segment).
 * Library's v6 tabs arrive in P4; until then the link opens Rutiner.
 */
export const discoverPath = () => "/library?view=discover";
/** v6: Library → Scheman, the plans tab (P4). */
export const plansTabPath = () => "/library?tab=plans";
/**
 * v6: Library → Scheman with a new plan's editor open, from a standard
 * programme when `programId` names one (P4 handles both parameters).
 */
export const newPlanPath = (programId?: string) =>
  plansTabPath() +
  "&new=plan" +
  (programId ? "&program=" + encodeURIComponent(programId) : "");
