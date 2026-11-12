import { EASE, MOTION, SPRING, play, playSpring } from "@/lib/motion";

/**
 * The set check's motion (mockup v5, B8 / H2), all within about 300 ms and
 * none of it in the way of the next tap: the ✓ springs back from its press
 * (520 / 26), the tick draws itself (160 ms), the green tone sweeps across
 * the row from the ✓ (240 ms), the "×" fades in, and the slot's ↑ slides in
 * 80 ms later, or a record mark pops once (400 / 22) with one light sweep.
 * Unchecking pulls the tone back quietly. Reduced motion: one 120 ms fade.
 */

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CLEAR = "rgba(0, 0, 0, 0)";
const ring = (colour: string) => `inset 0 0 0 2px ${colour}`;
const token = (el: Element, name: string) =>
  getComputedStyle(el).getPropertyValue(name).trim() || CLEAR;

/** The ✓ pressed in: 0.88 in 60 ms, held until the finger lifts. */
export function pressCheck(check: HTMLElement | null) {
  if (!check || reduced()) return null;
  return play(check, [{ transform: "scale(1)" }, { transform: "scale(0.88)" }], {
    duration: MOTION.press,
    fill: "forwards",
  });
}

/** A press that did not check the set lets go in 120 ms. */
export function releaseCheck(check: HTMLElement | null) {
  play(check, [{ transform: "scale(0.88)" }, { transform: "scale(1)" }], {
    duration: MOTION.tick,
  });
}

export function playCheck(row: HTMLElement, wasNext: boolean) {
  if (reduced()) {
    play(row, [{ opacity: 0.35 }, { opacity: 1 }]);
    return;
  }
  const check = row.querySelector<HTMLElement>(".set-check");
  playSpring(check, SPRING.check, 0.88, 1, (v) => ({
    transform: `scale(${v})`,
  }));
  const tick = row.querySelector<SVGPathElement>(".set-check path");
  if (tick) {
    let length = 24;
    try {
      length = tick.getTotalLength() || length;
    } catch {
      // Not rendered yet: the drawn length of the 24px tick.
    }
    tick.style.strokeDasharray = String(length);
    play(
      tick,
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      { duration: MOTION.stroke, delay: 40, fill: "backwards" },
    );
  }
  // The row keeps its old tone (and fades its ring) while the green sweeps
  // over it from the ✓; at the end the sweep is the row's own done tone.
  const before = wasNext ? token(row, "--gt-accent-soft") : CLEAR;
  const accent = wasNext ? token(row, "--gt-accent") : CLEAR;
  play(
    row,
    [
      { backgroundColor: before, boxShadow: ring(accent) },
      { backgroundColor: before, boxShadow: ring(CLEAR) },
    ],
    { duration: MOTION.sweep },
  );
  play(
    row.querySelector(".set-sweep"),
    [
      { transform: "scaleX(0)", opacity: 1 },
      { transform: "scaleX(1)", opacity: 1 },
    ],
    { duration: MOTION.sweep, easing: EASE.sweep },
  );
  for (const times of row.querySelectorAll(".set-times"))
    play(times, [{ opacity: 0 }, { opacity: 1 }], {
      duration: MOTION.tick,
      delay: 80,
      fill: "backwards",
    });
  const record = row.querySelector<HTMLElement>(".set-slot .set-record-pop");
  if (record) {
    playSpring(
      record,
      SPRING.record,
      0,
      1,
      (v) => ({ transform: `scale(${v})`, opacity: Math.min(1, v * 1.6) }),
      { delay: 140, fill: "backwards" },
    );
    play(
      record.querySelector(".set-record-sheen"),
      [{ transform: "translateX(-120%)" }, { transform: "translateX(320%)" }],
      { duration: MOTION.sheen, delay: 260, easing: "ease-in-out" },
    );
    return;
  }
  play(
    row.querySelector(".set-slot .set-up"),
    [
      { transform: "translateX(-6px)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: MOTION.slot, delay: 80, fill: "backwards" },
  );
}

/** Unchecked: the green pulls back into the ✓. */
export function playUncheck(row: HTMLElement) {
  if (reduced()) {
    play(row, [{ opacity: 0.5 }, { opacity: 1 }]);
    return;
  }
  play(
    row.querySelector(".set-sweep"),
    [
      { transform: "scaleX(1)", opacity: 1 },
      { transform: "scaleX(0)", opacity: 1 },
    ],
    { duration: MOTION.stroke, easing: EASE.in },
  );
}

/** The next set's ring and tone fade in just after the check (180 ms, 120 ms late). */
export function playNext(row: HTMLElement) {
  play(
    row,
    [
      { backgroundColor: CLEAR, boxShadow: ring(CLEAR) },
      {
        backgroundColor: token(row, "--gt-accent-soft"),
        boxShadow: ring(token(row, "--gt-accent")),
      },
    ],
    { duration: MOTION.next, delay: 120, fill: "backwards" },
  );
}

/**
 * One step of a field dragged up or down: the number comes 6 px from the way
 * it changes (from below going up), 120 ms.
 */
export function playStep(input: HTMLElement | null, direction: number) {
  play(
    input,
    [
      {
        transform: `translateY(${direction > 0 ? 6 : -6}px)`,
        opacity: 0.3,
      },
      { transform: "none", opacity: 1 },
    ],
    { duration: MOTION.tick },
  );
}
