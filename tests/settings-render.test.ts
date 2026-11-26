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

test("the theme row is one switch with the day/night switch inside, following the phone", async () => {
  store.clear();
  const html = await renderSettings({
    theme: { theme: "light", chosen: false },
  });
  const row = switchFor(html, "Följer telefonen (ljust nu)");
  assert.ok(row, "the Tema row is a switch");
  assert.match(row, /class="row theme-row"/);
  assert.match(row, /aria-checked="true"/);
  assert.match(row, />Tema</);
  // The day/night switch is drawn inside the row, not a button of its own.
  assert.match(row, /<span class="theme-switch is-day" aria-hidden="true">/);
  assert.doesNotMatch(html, /<button[^>]*class="theme-switch/);
  assert.doesNotMatch(html, /Följ telefonen igen/);
  const dark = await renderSettings({
    theme: { theme: "dark", chosen: false },
  });
  assert.match(text(dark), /Tema Följer telefonen \(mörkt nu\)/);
});

test("after a manual choice the row names it and offers Följ telefonen igen", async () => {
  store.clear();
  const html = await renderSettings({ theme: { theme: "dark", chosen: true } });
  const row = switchFor(html, "theme-row");
  assert.ok(row);
  assert.match(row, /aria-checked="false"/);
  assert.match(text(html), /Tema Mörkt/);
  assert.match(text(html), /Valt för hand\. Följ telefonen igen/);
  assert.match(
    html,
    /<button type="button" class="text-link"[^>]*>Följ telefonen igen</,
  );
  const light = await renderSettings({
    theme: { theme: "light", chosen: true },
  });
  assert.match(text(light), /Tema Ljust/);
});

test("the language row says Svenska, som telefonen while it follows the phone", async () => {
  store.clear();
  const following = await renderSettings({ followsPhone: true });
  assert.match(text(following), /Språk · Language Svenska, som telefonen/);
  const chosen = await renderSettings({ followsPhone: false });
  assert.match(text(chosen), /Språk · Language Svenska /);
  assert.doesNotMatch(text(chosen), /som telefonen/);
  const english = await renderSettings({ followsPhone: true, language: "en" });
  assert.match(text(english), /English, som telefonen/);
});
