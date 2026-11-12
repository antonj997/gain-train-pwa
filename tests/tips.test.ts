import test from "node:test";
import assert from "node:assert/strict";
import {
  TIPS_KEY,
  TIP_IDS,
  nextTip,
  parseSeen,
  readSeen,
  serializeSeen,
  tipPlacement,
  tipsBlocked,
  withSeen,
  writeSeen,
  type TipId,
} from "../src/lib/tips";

const base = {
  visible: [] as TipId[],
  seen: new Set<TipId>(),
  current: null,
  blockers: {},
  now: 1000,
};

test("the seen list parses known tips only and survives garbage", () => {
  assert.deepEqual([...parseSeen(null)], []);
  assert.deepEqual([...parseSeen("not json")], []);
  assert.deepEqual([...parseSeen('{"a":1}')], []);
  assert.deepEqual(
    [...parseSeen('["swipeSet","nope","weekStrip"]')].sort(),
    ["swipeSet", "weekStrip"],
  );
  assert.equal(
    serializeSeen(new Set<TipId>(["swipeSet", "weekStrip"])),
    '["weekStrip","swipeSet"]',
  );
});

test("seen tips are read and written per device, and storage errors never throw", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  assert.equal(writeSeen(new Set<TipId>(["calendarDay"]), storage), true);
  assert.equal(store.get(TIPS_KEY), '["calendarDay"]');
  assert.deepEqual([...readSeen(storage)], ["calendarDay"]);
  // Reset removes the key.
  assert.equal(writeSeen(new Set(), storage), true);
  assert.equal(store.has(TIPS_KEY), false);
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  assert.deepEqual([...readSeen(broken)], []);
  assert.equal(writeSeen(new Set<TipId>(["setBadge"]), broken), false);
});

test("one tip at a time: the first unseen visible one, in order", () => {
  assert.equal(nextTip(base), null);
  assert.equal(
    nextTip({ ...base, visible: ["repsHeader", "setBadge", "unitHeader"] }),
    "setBadge",
  );
  assert.equal(
    nextTip({
      ...base,
      visible: ["repsHeader", "setBadge"],
      seen: new Set<TipId>(["setBadge"]),
    }),
    "repsHeader",
  );
  assert.equal(
    nextTip({ ...base, visible: ["weekStrip"], seen: new Set(TIP_IDS) }),
    null,
  );
});

test("the tip showing keeps its place while it is on screen", () => {
  assert.equal(
    nextTip({
      ...base,
      visible: ["weekStrip", "swipeSet"],
      current: "swipeSet",
    }),
    "swipeSet",
  );
  // Gone from the screen: the next one may come.
  assert.equal(
    nextTip({ ...base, visible: ["weekStrip"], current: "swipeSet" }),
    "weekStrip",
  );
});

test("no tip while blocked or during the pause after the last one", () => {
  const visible: TipId[] = ["weekStrip"];
  for (const blockers of [
    { focusedInput: true },
    { dragging: true },
    { dialogOpen: true },
    { languagePrompt: true },
  ]) {
    assert.equal(tipsBlocked(blockers), true);
    assert.equal(nextTip({ ...base, visible, blockers }), null);
    // Not even the one that was showing: it never covers a field or a drag.
    assert.equal(
      nextTip({ ...base, visible, blockers, current: "weekStrip" }),
      null,
    );
  }
  assert.equal(nextTip({ ...base, visible, quietUntil: 2000 }), null);
  assert.equal(nextTip({ ...base, visible, quietUntil: 500 }), "weekStrip");
});

test("marking seen returns the same set when nothing changes", () => {
  const seen = new Set<TipId>(["weekStrip"]);
  assert.equal(withSeen(seen, "weekStrip"), seen);
  assert.deepEqual([...withSeen(seen, "swipeSet")], ["weekStrip", "swipeSet"]);
});

test("the bubble goes under its target when there is room, else over it, inside the gutters", () => {
  const viewport = { width: 390, height: 844 };
  const bubble = { width: 240, height: 48 };
  const under = tipPlacement({
    target: { top: 100, bottom: 140, left: 20, width: 350 },
    bubble,
    viewport,
  });
  assert.equal(under.side, "below");
  assert.equal(under.top, 150);
  assert.equal(under.left, 75);
  assert.equal(under.arrow, 120);
  const over = tipPlacement({
    target: { top: 760, bottom: 800, left: 300, width: 40 },
    bubble,
    viewport,
    bottomInset: 84,
  });
  assert.equal(over.side, "above");
  assert.equal(over.top, 760 - 10 - 48);
  // Clamped to the right gutter; the arrow still points at the target.
  assert.equal(over.left, 390 - 12 - 240);
  assert.equal(over.arrow, 320 - 138);
});
