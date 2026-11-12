import test from "node:test";
import assert from "node:assert/strict";
import {
  REST_DONE_MS,
  clock,
  dockPhase,
  pulses,
  restFill,
  restSecondsLeft,
  restTotal,
  skipsRest,
} from "../src/lib/rest-dock";
import { MOTION, reducedFrames, springFrames } from "../src/lib/motion";

const base = {
  live: true,
  allChecked: false,
  restEnd: null,
  doneAt: null,
  now: 10_000,
};

test("the dock rests, says done for 4 s, then leaves", () => {
  assert.equal(dockPhase(base), "hidden");
  assert.equal(dockPhase({ ...base, restEnd: 70_000 }), "rest");
  assert.equal(dockPhase({ ...base, doneAt: 9_000 }), "done");
  assert.equal(dockPhase({ ...base, doneAt: 10_000 - REST_DONE_MS }), "hidden");
  // Slow motion stretches how long "Rest done" stays.
  assert.equal(dockPhase({ ...base, doneAt: 1_000, doneMs: 40_000 }), "done");
  // A rest whose end has passed is no longer running.
  assert.equal(dockPhase({ ...base, restEnd: 9_000 }), "hidden");
});

test("every set checked makes it Finish workout; editing a finished workout has no dock", () => {
  assert.equal(
    dockPhase({ ...base, allChecked: true, restEnd: 70_000 }),
    "finish",
  );
  assert.equal(dockPhase({ ...base, live: false, allChecked: true }), "hidden");
});

test("the fill is the share of the rest left, and the seconds round up", () => {
  assert.equal(restFill(70_000, 120, 10_000), 0.5);
  assert.equal(restFill(70_000, 60, 0), 1);
  assert.equal(restFill(70_000, 60, 80_000), 0);
  assert.equal(restFill(70_000, 0, 0), 0);
  assert.equal(restSecondsLeft(70_000, 10_001), 60);
  assert.equal(restSecondsLeft(70_000, 69_000), 1);
  assert.equal(restSecondsLeft(70_000, 71_000), 0);
});

test("only the last three seconds pulse", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(pulses), [
    false,
    true,
    true,
    true,
    false,
  ]);
});

test("a resumed rest's length is never shorter than what is left", () => {
  assert.equal(restTotal(135, 70_000, 10_000, 120), 135);
  assert.equal(restTotal(null, 70_000, 10_000, 120), 120);
  assert.equal(restTotal(null, 200_000, 10_000, 120), 190);
});

test("a swipe down skips past 40 px or when flung", () => {
  assert.equal(skipsRest(41, 0.1), true);
  assert.equal(skipsRest(20, 0.6), true);
  assert.equal(skipsRest(20, 0.3), false);
  assert.equal(skipsRest(0, 1), false);
});

test("clock reads m:ss", () => {
  assert.equal(clock(65), "1:05");
  assert.equal(clock(0), "0:00");
});

test("reduced motion swaps any movement for a short fade, out when it ends hidden", () => {
  assert.deepEqual(
    reducedFrames([{ transform: "translateY(24px)" }, { transform: "none" }]),
    [{ opacity: 0.35 }, { opacity: 1 }],
  );
  assert.deepEqual(
    reducedFrames([
      { opacity: 1 },
      { transform: "translateY(40px)", opacity: 0 },
    ]),
    [{ opacity: 1 }, { opacity: 0 }],
  );
  assert.equal(MOTION.reduced, 120);
});

test("the check's spring starts pressed in, overshoots a little and ends on 1", () => {
  const { keyframes, duration } = springFrames([520, 26], 0.88, 1, (v) => ({
    v,
  }));
  const values = keyframes.map((k) => Number(k.v));
  assert.equal(values[0] > 0.88, true);
  assert.equal(values.at(-1), 1);
  assert.ok(Math.max(...values) > 1, "a little overshoot");
  assert.ok(duration > 150 && duration < 600, String(duration));
});
