import { createContext } from "react";

/** A message at the workout's foot (v6 B2, B13). */
export type WorkoutToastMessage = {
  text: string;
  /** Ångra: puts back what the message reports. */
  undo?: () => void;
  /** How long it stays, before slow motion (4 s; 5 s with Ångra). */
  ms?: number;
};

/**
 * The live workout's toast slot (ActiveWorkout): the locked-set notice and the
 * fatigue row's "Målet sänkt". It sits at the foot above the dock, so the
 * rows never move under the finger. Absent outside a live workout.
 */
export const WorkoutToastContext = createContext<
  ((message: WorkoutToastMessage) => void) | null
>(null);

/** How long a toast stays: 4 s, or 5 s while it offers Ångra. */
export const toastMs = (message: WorkoutToastMessage) =>
  message.ms ?? (message.undo ? 5000 : 4000);
