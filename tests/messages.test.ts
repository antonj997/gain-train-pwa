import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MESSAGES,
  activeSlot,
  addMessage,
  interleave,
  messageRole,
  removeMessage,
  undoRemaining,
  type PageMessage,
  type UndoEntry,
} from "../src/lib/messages";
import {
  dismissMessage,
  getMessageState,
  notify,
  offerUndo,
  registerMessageSlot,
  resetMessages,
  runUndo,
  unregisterMessageSlot,
  undoMessage,
} from "../src/lib/message-store";

const message = (
  id: number,
  extra: Partial<PageMessage> = {},
): PageMessage => ({
  id,
  text: `m${id}`,
  tone: "info",
  sticky: false,
  ms: 4000,
  ...extra,
});
const entry = (id: number, index: number): UndoEntry => ({
  id,
  scope: "s",
  index,
  text: `u${id}`,
  undo: { run: async () => {}, failed: "x" },
  expiresAt: 0,
});

test("a message with the same key replaces the one showing, in place", () => {
  const list = [message(1, { key: "a" }), message(2)];
  const next = addMessage(list, message(3, { key: "a", text: "new" }));
  assert.deepEqual(
    next.map((m) => [m.id, m.text]),
    [
      [3, "new"],
      [2, "m2"],
    ],
  );
});

test("over the cap the oldest message that is not an error goes first", () => {
  let list: PageMessage[] = [message(1, { tone: "error" })];
  for (let id = 2; id <= MAX_MESSAGES + 1; id++)
    list = addMessage(list, message(id));
  assert.equal(list.length, MAX_MESSAGES);
  assert.deepEqual(
    list.map((m) => m.id),
    [1, 3, 4],
  );
});

test("removing by key clears every message of that kind, and nothing else", () => {
  const list = [
    message(1, { key: "sync" }),
    message(2),
    message(3, { key: "sync" }),
  ];
  assert.deepEqual(
    removeMessage(list, "sync").map((m) => m.id),
    [2],
  );
  assert.deepEqual(
    removeMessage(list, 2).map((m) => m.id),
    [1, 3],
  );
  assert.equal(removeMessage(list, 99), list);
});

test("errors are alerts; everything else is a polite status", () => {
  assert.equal(messageRole("error"), "alert");
  assert.equal(messageRole("success"), "status");
  assert.equal(messageRole("info"), "status");
});

test("the topmost slot shows the messages: an open sheet over the page, the newest at a level", () => {
  assert.equal(activeSlot([]), null);
  assert.equal(
    activeSlot([
      { id: 1, priority: 1, seq: 1 },
      { id: 2, priority: 2, seq: 2 },
      { id: 3, priority: 1, seq: 3 },
    ]),
    2,
  );
  assert.equal(
    activeSlot([
      { id: 1, priority: 1, seq: 1 },
      { id: 3, priority: 1, seq: 3 },
    ]),
    3,
  );
});

test("a placeholder goes back where its item was; older ones first; past the end last", () => {
  const items = ["a", "b", "c"];
  const shape = (list: ReturnType<typeof interleave<string>>) =>
    list.map((x) => (x.kind === "item" ? x.item : `#${x.entry.id}`));
  assert.deepEqual(shape(interleave(items, [])), ["a", "b", "c"]);
  assert.deepEqual(shape(interleave(items, [entry(7, 1)])), [
    "a",
    "#7",
    "b",
    "c",
  ]);
  assert.deepEqual(shape(interleave(items, [entry(9, 0), entry(8, 0)])), [
    "#8",
    "#9",
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(shape(interleave(items, [entry(5, 3), entry(6, 10)])), [
    "a",
    "b",
    "c",
    "#5",
    "#6",
  ]);
  assert.deepEqual(shape(interleave([], [entry(1, 2)])), ["#1"]);
});

test("the undo timer line runs from full to empty", () => {
  assert.equal(undoRemaining({ expiresAt: 6000 }, 5000, 1000), 1);
  assert.equal(undoRemaining({ expiresAt: 6000 }, 5000, 3500), 0.5);
  assert.equal(undoRemaining({ expiresAt: 6000 }, 5000, 9000), 0);
});

test("the store: errors stay, keys replace, undo restores once and failures say so", async () => {
  resetMessages();
  const slot = registerMessageSlot(1);
  const sheet = registerMessageSlot(2);
  assert.equal(getMessageState().active, sheet);
  unregisterMessageSlot(sheet);
  assert.equal(getMessageState().active, slot);

  const error = notify.error("Could not save");
  assert.equal(getMessageState().messages[0].sticky, true);
  notify.success("Saved", { key: "save" });
  notify.success("Saved again", { key: "save" });
  assert.deepEqual(
    getMessageState().messages.map((m) => m.text),
    ["Could not save", "Saved again"],
  );
  dismissMessage(error);
  dismissMessage("save");
  assert.equal(getMessageState().messages.length, 0);

  let restored = 0;
  const id = offerUndo({
    scope: "routines:library",
    index: 2,
    text: "Routine Legs A deleted",
    undo: async () => {
      restored++;
    },
    failed: "Could not restore",
  });
  assert.equal(getMessageState().undos[0].index, 2);
  runUndo(id);
  runUndo(id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(restored, 1);
  assert.equal(getMessageState().undos.length, 0);

  const failing = notify("Workout abandoned", {
    undo: {
      run: async () => {
        throw new Error("offline");
      },
      failed: "Could not bring it back",
    },
  });
  undoMessage(failing);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [shown] = getMessageState().messages;
  assert.equal(shown.tone, "error");
  assert.match(shown.text, /offline|Could not bring it back/);
  resetMessages();
});
