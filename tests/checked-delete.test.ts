import test from "node:test";
import assert from "node:assert/strict";
import {
  asksBeforeDelete,
  checkedDeleteAsked,
  markCheckedDeleteAsked,
  resetCheckedDeleteAnswer,
} from "../src/lib/checked-delete";
import { storageKeys } from "../src/lib/storage";

const memory = () => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
};

test("only a checked set asks, and only until it was answered", () => {
  assert.equal(asksBeforeDelete(true, false), true);
  assert.equal(asksBeforeDelete(true, true), false);
  assert.equal(asksBeforeDelete(false, false), false);
});

test("the answer is kept on the device and read back", () => {
  resetCheckedDeleteAnswer();
  const storage = memory();
  assert.equal(checkedDeleteAsked(storage), false);
  assert.equal(markCheckedDeleteAsked(storage), true);
  assert.equal(storage.store.get(storageKeys.checkedDeleteAsked), "true");
  resetCheckedDeleteAnswer();
  assert.equal(checkedDeleteAsked(storage), true);
});

test("storage that throws never breaks the swipe, and the answer holds for the visit", () => {
  resetCheckedDeleteAnswer();
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {},
  };
  assert.equal(checkedDeleteAsked(broken), false);
  assert.equal(markCheckedDeleteAsked(broken), false);
  assert.equal(checkedDeleteAsked(broken), true);
  resetCheckedDeleteAnswer();
});
