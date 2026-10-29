import { en } from "./en";
import { sv } from "./sv";
import { local, storageKeys, writeStored } from "../lib/storage";

export type Language = "en" | "sv";
/** A message that depends on `{count}`: one for exactly 1, other for the rest. */
export type Plural = { one: string; other: string };
/** Every message the app shows; `en.ts` is the source of truth, `sv.ts` must match it. */
export type Messages = {
  [K in keyof typeof en]: (typeof en)[K] extends Plural ? Plural : string;
};
export type MessageKey = keyof Messages;
export type Params = Record<string, string | number | null | undefined>;
export type Translate = (key: MessageKey, params?: Params) => string;

export const LANGUAGES: readonly Language[] = ["en", "sv"];
/** The Intl locale each language formats dates and numbers with. */
export const LOCALES: Record<Language, string> = { en: "en-GB", sv: "sv-SE" };
/** Each language's name in itself, as the language picker lists it. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  sv: "Svenska",
};

const catalogues: Record<Language, Messages> = { en, sv };

/** Replaces each `{name}` with its parameter; unknown names stay as written. */
export function interpolate(text: string, params?: Params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** English and Swedish both use the singular for exactly one, the plural otherwise. */
export const pluralForm = (count: number): keyof Plural =>
  Math.abs(count) === 1 ? "one" : "other";

/** The message for `key` in `language`, with plurals chosen by `params.count`. */
export function translate(
  language: Language,
  key: MessageKey,
  params?: Params,
): string {
  const message: string | Plural =
    catalogues[language]?.[key] ?? en[key] ?? key;
  if (typeof message === "string") return interpolate(message, params);
  return interpolate(message[pluralForm(Number(params?.count ?? 0))], params);
}

export const isLanguage = (value: unknown): value is Language =>
  value === "en" || value === "sv";

/** The language this device chose, or null before anyone has chosen. */
export function readStoredLanguage(): Language | null {
  try {
    const saved = local.getItem(storageKeys.language);
    return isLanguage(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Remembers the choice on this device. Returns false when storage refused. */
export const storeLanguage = (language: Language) =>
  writeStored(storageKeys.language, language);

// The language every string is built in. Code outside React (helpers, the
// crash screen, toasts from data actions) reads it here; LanguageProvider
// changes it and re-renders the app.
let current: Language = readStoredLanguage() ?? "en";

export const getLanguage = () => current;
export function setCurrentLanguage(language: Language) {
  current = language;
}
/** The Intl locale of the current language: "en-GB" or "sv-SE". */
export const currentLocale = () => LOCALES[current];
/** A message in the current language. */
export const t: Translate = (key, params) => translate(current, key, params);

/**
 * A number as the current language writes decimals: "12.5" or "12,5". No
 * grouping, so it reads the same in a label and in a set field.
 */
export const formatDecimal = (value: number) =>
  current === "sv" ? String(value).replace(".", ",") : String(value);

/**
 * Whether to ask once which language to use: only on a device that has never
 * chosen and already holds someone's log. A new user gets English silently.
 */
export function shouldPromptLanguage(
  stored: Language | null,
  hasUserData: boolean,
) {
  return stored === null && hasUserData;
}

/** True when the log holds anything the user made: workouts, routines, exercises, or a profile. */
export function hasUserData(
  records: Record<string, { deleted: boolean; kind: string }>,
  profile?: { bodyWeightKg: number | null } | null,
) {
  if (profile?.bodyWeightKg != null) return true;
  return Object.values(records).some(
    (record) =>
      !record.deleted &&
      ["workout", "routine", "exercise", "plan", "goal"].includes(record.kind),
  );
}
