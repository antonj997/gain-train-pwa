import test from "node:test";
import assert from "node:assert/strict";
import {
  SLOW_MOTION_SCALES,
  activeSlowMotion,
  motionMs,
  motionScale,
  parseSlowMotion,
  readSlowMotion,
  setMotionScale,
  slowMotionKey,
  subscribeMotionScale,
  subscribeSlowMotionSetting,
  writeSlowMotion,
} from "../src/lib/slow-motion.ts";
import type { KeyValueStorage } from "../src/lib/storage.ts";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}
const refusing: KeyValueStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

test("the choice is stored per account under gt-slowmo:<uid>", () => {
  assert.equal(slowMotionKey(ADMIN), `gt-slowmo:${ADMIN}`);
  assert.notEqual(slowMotionKey(ADMIN), slowMotionKey(OTHER));
  assert.deepEqual(SLOW_MOTION_SCALES, [1, 2, 5, 10]);
});

test("a stored value parses to a known scale, anything else is off", () => {
  assert.equal(parseSlowMotion("2"), 2);
  assert.equal(parseSlowMotion("5"), 5);
  assert.equal(parseSlowMotion(" 10 "), 10);
  assert.equal(parseSlowMotion("1"), 1);
  for (const raw of [
    null,
    undefined,
    "",
    "3",
    "0",
    "-5",
    "5x",
    "0.5",
    "1e1",
    "Infinity",
    "NaN",
  ])
    assert.equal(parseSlowMotion(raw), 1, String(raw));
});

test("reading and writing keep one account's choice to itself", () => {
  const storage = memory();
  assert.equal(readSlowMotion(ADMIN, storage), 1);
  assert.equal(writeSlowMotion(ADMIN, 5, storage), true);
  assert.equal(storage.data.get(`gt-slowmo:${ADMIN}`), "5");
  assert.equal(readSlowMotion(ADMIN, storage), 5);
  assert.equal(readSlowMotion(OTHER, storage), 1);
  // Off removes the key rather than storing "1".
  writeSlowMotion(ADMIN, 1, storage);
  assert.equal(storage.data.has(`gt-slowmo:${ADMIN}`), false);
  // Signed out there is nothing to read or write.
  assert.equal(readSlowMotion("", storage), 1);
  assert.equal(writeSlowMotion("", 5, storage), false);
  assert.equal(storage.data.size, 0);
});

test("storage that throws reads as off and reports a failed write", () => {
  assert.equal(readSlowMotion(ADMIN, refusing), 1);
  assert.equal(writeSlowMotion(ADMIN, 5, refusing), false);
});

test("a write tells this tab's readers to re-read", () => {
  let calls = 0;
  const stop = subscribeSlowMotionSetting(() => calls++);
  writeSlowMotion(ADMIN, 2, memory());
  stop();
  writeSlowMotion(ADMIN, 5, memory());
  assert.equal(calls, 1);
});

test("slow motion applies only to a signed-in, confirmed admin", () => {
  assert.equal(
    activeSlowMotion({ userId: ADMIN, isAdmin: true, stored: 5 }),
    5,
  );
  assert.equal(
    activeSlowMotion({ userId: ADMIN, isAdmin: true, stored: 1 }),
    1,
  );
  // Not confirmed yet (offline before the first check), or not an admin.
  assert.equal(
    activeSlowMotion({ userId: ADMIN, isAdmin: undefined, stored: 5 }),
    1,
  );
  assert.equal(
    activeSlowMotion({ userId: OTHER, isAdmin: false, stored: 10 }),
    1,
  );
  // Signed out.
  assert.equal(activeSlowMotion({ userId: "", isAdmin: true, stored: 5 }), 1);
  assert.equal(activeSlowMotion({ userId: null, isAdmin: true, stored: 5 }), 1);
});

test("motionMs stretches a visual duration by the scale", () => {
  assert.equal(motionMs(200, 1), 200);
  assert.equal(motionMs(200, 2), 400);
  assert.equal(motionMs(200, 5), 1000);
  assert.equal(motionMs(4000, 10), 40000);
  // Nothing to stretch, or no sensible scale.
  assert.equal(motionMs(0, 5), 0);
  assert.equal(motionMs(-1, 5), -1);
  assert.equal(motionMs(Infinity, 5), Infinity);
  assert.equal(motionMs(200, 0), 200);
  assert.equal(motionMs(200, 0.5), 200);
  assert.equal(motionMs(200, NaN), 200);
});

test("motionMs follows the scale in effect, off by default", () => {
  assert.equal(motionScale(), 1);
  assert.equal(motionMs(700), 700);
  let calls = 0;
  const stop = subscribeMotionScale(() => calls++);
  setMotionScale(5);
  assert.equal(motionMs(700), 3500);
  setMotionScale(5);
  setMotionScale(1);
  stop();
  assert.equal(motionMs(700), 700);
  assert.equal(calls, 2);
});
