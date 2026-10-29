import { createContext, useContext } from "react";
import {
  currentLocale,
  getLanguage,
  setCurrentLanguage,
  storeLanguage,
  t,
  type Language,
  type Translate,
} from "./index";

export type I18n = {
  language: Language;
  /** "en-GB" or "sv-SE", for Intl and toLocale* calls. */
  locale: string;
  t: Translate;
  setLanguage: (language: Language) => void;
  /** False until this device has chosen a language. */
  chosen: boolean;
};

export const LanguageContext = createContext<I18n | null>(null);

/**
 * The current language's `t` and locale. Outside LanguageProvider (component
 * tests) it falls back to the module's language, English by default.
 */
export function useT(): I18n {
  return (
    useContext(LanguageContext) ?? {
      language: getLanguage(),
      locale: currentLocale(),
      t,
      chosen: true,
      setLanguage: (language) => {
        setCurrentLanguage(language);
        storeLanguage(language);
      },
    }
  );
}
