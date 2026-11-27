import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ElementType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { storageKeys } from "../src/lib/storage";
import { loadModule } from "./helpers/render";

// The theme follows the phone until it is chosen (v6 §G1, ThemeContext).
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
});

type Seen = { theme: string; chosen: boolean };

/** The theme context as the app sees it on its first render. */
async function themeOnLoad() {
  const context = await loadModule<{ useTheme: () => Seen }>(
    "@/contexts/useTheme.ts",
  );
  const { ThemeProvider } = await loadModule<{ ThemeProvider: ElementType }>(
    "@/contexts/ThemeContext.tsx",
    { "./useTheme": context },
  );
  let seen: Seen | undefined;
  const Probe = () => {
    seen = context.useTheme();
    return null;
  };
  renderToStaticMarkup(
    createElement(ThemeProvider, null, createElement(Probe)),
  );
  return seen;
}

test("with nothing saved the theme follows the phone and is not chosen", async () => {
  store.clear();
  const theme = await themeOnLoad();
  assert.equal(theme?.chosen, false);
});

test("a saved theme is a manual choice", async () => {
  store.clear();
  store.set(storageKeys.theme, "light");
  const theme = await themeOnLoad();
  assert.deepEqual(
    { theme: theme?.theme, chosen: theme?.chosen },
    { theme: "light", chosen: true },
  );
});
