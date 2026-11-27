import type { Workout } from "@/data/model";
import { doneSetCount, setCount } from "@/data/selectors";
import { t as translate, type Translate } from "@/i18n";
import { workoutTitle } from "@/lib/workout-name";

/** A second tap on "Släng och starta nytt" within this long discards. */
export const DISCARD_ARM_MS = 3000;

/**
 * The danger button's two taps: the first arms it ("Tryck igen för att
 * slänga"), a second within DISCARD_ARM_MS confirms; later, it arms again.
 */
export const discardTap = (
  armedAt: number | null,
  now: number,
): "arm" | "confirm" =>
  armedAt !== null && now - armedAt < DISCARD_ARM_MS ? "confirm" : "arm";

/**
 * The running workout as the start dialog names it (v6 A3): "Du har ett pass
 * igång", "Bröst & Ben · 2 övningar · 0 av 3 set", and what starting anew
 * throws away.
 */
export function runningDialogText(
  running: Pick<Workout, "name" | "exercises">,
  t: Translate = translate,
) {
  const name = workoutTitle(running.name);
  return {
    name,
    title: t("start.runningTitle"),
    sub: [
      name,
      t("count.exercise", { count: running.exercises.length }),
      t("home.setsOf", {
        done: doneSetCount(running),
        total: setCount(running),
      }),
    ].join(" · "),
    text: t("start.runningText", { name }),
  };
}
