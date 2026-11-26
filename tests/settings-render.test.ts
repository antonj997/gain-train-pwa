import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import * as i18n from "../src/i18n";
import { storageKeys } from "../src/lib/storage";
import { loadComponent } from "./helpers/render";

// Settings (v6 §G1) rendered with React's server renderer in Swedish, with
// the app's contexts replaced by plain values. The device's localStorage is a
// map, so each test sets the preferences it needs.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  window: { dispatchEvent: () => true },
});
i18n.setCurrentLanguage("sv");
// The server renderer warns for every layout effect (Reveal, Link); they
// only matter in a browser.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (String(args[0]).includes("useLayoutEffect does nothing on the server"))
    return;
  consoleError(...args);
};

type Theme = {
  theme: "light" | "dark";
  /** False while the theme follows the phone. */
  chosen: boolean;
};
type Options = {
  theme?: Theme;
  followsPhone?: boolean;
  language?: "sv" | "en";
};

async function renderSettings({
  theme = { theme: "light", chosen: false },
  followsPhone = false,
  language = "sv",
}: Options = {}) {
  const t = (key: i18n.MessageKey, params?: Record<string, string | number>) =>
    i18n.translate("sv", key, params);
  const Settings = await loadComponent("../src/pages/Settings.tsx", {
    "@/i18n": i18n,
    "@/i18n/useT": {
      useT: () => ({
        language,
        locale: "sv-SE",
        t,
        chosen: !followsPhone,
        followsPhone,
        setLanguage: () => {},
        followPhone: () => {},
      }),
    },
    "@/contexts/useAuth": {
      useAuth: () => ({
        user: null,
        account: "phone",
        signOut: async () => {},
      }),
    },
    "@/contexts/useData": {
      useData: () => ({
        state: { records: {}, outbox: [], cursor: 0 },
        syncing: false,
        error: null,
        online: true,
        failures: [],
        retry: () => {},
      }),
    },
    "@/contexts/useProfile": {
      useProfile: () => ({ bodyWeightKg: null, status: "idle" }),
    },
    "@/contexts/useTheme": {
      useTheme: () => ({
        ...theme,
        toggleTheme: () => {},
        followPhone: () => {},
      }),
    },
    "@/hooks/useAdmin": { useAdmin: () => ({ isAdmin: false, openCount: 0 }) },
    "@/hooks/useDisplayName": {
      useDisplayName: () => ({
        name: null,
        available: false,
        status: "idle",
        online: true,
        save: async () => {},
      }),
    },
    "@/hooks/usePageTransitions": { usePageBack: () => () => {} },
    "@/hooks/useMapFigure": { useMapFigure: () => ["m", () => {}] },
    "@/components/PageHeader": {
      default: ({ title }: { title: string }) =>
        createElement("h1", null, title),
    },
    "@/components/settings/SyncIssues": { default: () => null },
    // Closed sheets, which render nothing here.
    "@/components/settings/FeedbackSheet": { default: () => null },
    "@/components/settings/AccountSheet": { default: () => null },
    "@/components/settings/NameSheet": { default: () => null },
    "@/components/settings/DeleteAccountSheet": { default: () => null },
  });
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Settings)),
  );
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const groupTitles = (html: string) =>
  [...html.matchAll(/<h2 class="group-title"[^>]*>([^<]*)<\/h2>/g)].map(
    (m) => m[1],
  );
/** The opening tag of the switch whose visible label is `label`. */
const switchFor = (html: string, label: string) =>
  html
    .split(/(?=<button)/)
    .find((part) => part.includes('role="switch"') && part.includes(label));

test("the groups are Utseende, Vilotimer, Loggning, Coach, Träning and Allmänt, then Data, Hjälp and Konto", async () => {
  store.clear();
  const html = await renderSettings();
  assert.deepEqual(groupTitles(html), [
    "Utseende",
    "Vilotimer",
    "Loggning",
    "Coach",
    "Träning",
    "Allmänt",
    "Din data",
    "Hjälp och feedback",
    "Konto",
  ]);
});

test("with the rest timer off, Ljud and Vibrera are absent", async () => {
  store.clear();
  const html = await renderSettings();
  const rest = switchFor(html, "Vilotimer");
  assert.ok(rest, "the Vilotimer switch");
  assert.match(rest, /aria-checked="false"/);
  assert.match(
    text(html),
    /Av från start\. Slå på här eller per övning i passet\. Förval: flerled med stång 2:30 · annan flerled 2:00 · isolering 1:30/,
  );
  assert.doesNotMatch(html, /Ljud när vilan är slut/);
  assert.doesNotMatch(html, />Vibrera</);
  // No time control in Settings: times are per exercise.
  assert.doesNotMatch(html, /rest-control/);
});

test("with the rest timer on, Ljud and Vibrera are present", async () => {
  store.clear();
  store.set(storageKeys.restOn, "true");
  // A phone that can vibrate (iPhone Safari cannot, and hides the row).
  Object.assign(navigator, { vibrate: () => true });
  try {
    const html = await renderSettings();
    assert.match(switchFor(html, "Vilotimer") ?? "", /aria-checked="true"/);
    assert.ok(switchFor(html, "Ljud när vilan är slut"));
    assert.ok(switchFor(html, ">Vibrera<"));
    assert.doesNotMatch(html, /rest-control/);
  } finally {
    Reflect.deleteProperty(navigator, "vibrate");
  }
});

test("an upgraded phone's saved rest time reads as on", async () => {
  store.clear();
  store.set(storageKeys.restSeconds, "150");
  const html = await renderSettings();
  assert.match(switchFor(html, "Vilotimer") ?? "", /aria-checked="true"/);
  assert.ok(switchFor(html, "Ljud när vilan är slut"));
});

test("Loggning holds Viktenhet and Fråga efter RIR, off by default", async () => {
  store.clear();
  const html = await renderSettings();
  const words = text(html);
  assert.match(words, /Viktenhet Standard för alla övningar kg/);
  const rir = switchFor(html, "Fråga efter RIR");
  assert.ok(rir, "the RIR switch");
  assert.match(rir, /aria-checked="false"/);
  assert.match(rir, /Plattan får ett RIR-läge efter reps/);
});

test("Träning keeps Kroppsvikt and Veckomål; Allmänt has the language and tips rows", async () => {
  store.clear();
  const html = await renderSettings();
  const words = text(html);
  assert.ok(words.indexOf("Kroppsvikt") > words.indexOf("Trött muskel"));
  assert.ok(words.indexOf("Veckomål") > words.indexOf("Kroppsvikt"));
  assert.ok(words.indexOf("Språk · Language") > words.indexOf("Veckomål"));
  assert.ok(
    words.indexOf("Visa tips igen") > words.indexOf("Språk · Language"),
  );
  assert.match(words, /Muskelkarta Figuren på övningens och schemats karta/);
});
