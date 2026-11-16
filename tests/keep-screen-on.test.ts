import test from "node:test";
import assert from "node:assert/strict";
import {
  readKeepScreenOn,
  wakeLockSupported,
  writeKeepScreenOn,
} from "../src/lib/keep-screen-on";
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

test("the screen stays on by default, and switching it off is remembered", () => {
  const storage = memory();
  assert.equal(readKeepScreenOn(storage), true);
  assert.equal(writeKeepScreenOn(false, storage), true);
  assert.equal(storage.store.get(storageKeys.keepScreenOn), "false");
  assert.equal(readKeepScreenOn(storage), false);
  writeKeepScreenOn(true, storage);
  assert.equal(storage.store.has(storageKeys.keepScreenOn), false);
  assert.equal(readKeepScreenOn(storage), true);
});

test("storage that throws keeps the screen on and reports the refusal", () => {
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
  assert.equal(readKeepScreenOn(broken), true);
  assert.equal(writeKeepScreenOn(false, broken), false);
});

test("the switch shows only where the Screen Wake Lock API exists", () => {
  assert.equal(wakeLockSupported(undefined), false);
  assert.equal(wakeLockSupported({}), false);
  assert.equal(wakeLockSupported({ wakeLock: {} }), false);
  assert.equal(wakeLockSupported({ wakeLock: { request: () => {} } }), true);
});
