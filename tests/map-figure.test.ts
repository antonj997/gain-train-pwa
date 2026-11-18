import test from "node:test";
import assert from "node:assert/strict";
import {
  MAP_FIGURE_EVENT,
  parseMapFigure,
  readMapFigure,
  saveMapFigure,
} from "../src/lib/preferences.ts";
import { storageKeys } from "../src/lib/storage.ts";

test("the muscle map figure is the man unless the woman was chosen", () => {
  assert.equal(parseMapFigure(null), "m");
  assert.equal(parseMapFigure("m"), "m");
  assert.equal(parseMapFigure("f"), "f");
  assert.equal(parseMapFigure("woman"), "m");
});

test("the figure is saved on the device and announced", () => {
  const stored = new Map<string, string>();
  const events: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const before = { localStorage: g.localStorage, window: g.window };
  g.localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  };
  g.window = { dispatchEvent: (event: Event) => events.push(event.type) };
  try {
    assert.equal(readMapFigure(), "m");
    saveMapFigure("f");
    assert.equal(stored.get(storageKeys.mapFigure), "f");
    assert.equal(readMapFigure(), "f");
    // The man is the default, so choosing him removes the key.
    saveMapFigure("m");
    assert.equal(stored.has(storageKeys.mapFigure), false);
    assert.equal(readMapFigure(), "m");
    assert.deepEqual(events, [MAP_FIGURE_EVENT, MAP_FIGURE_EVENT]);
  } finally {
    Object.assign(g, before);
  }
});
