import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALES,
  getLanguage,
  readStoredLanguage,
  setCurrentLanguage,
  storeLanguage,
  translate,
  type Language,
} from "./index";
import { LanguageContext, type I18n } from "./useT";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(getLanguage);
  const [chosen, setChosen] = useState(() => readStoredLanguage() !== null);

  const setLanguage = useCallback((next: Language) => {
    // Helpers outside React read the module's language, so it changes first.
    setCurrentLanguage(next);
    storeLanguage(next);
    setChosen(true);
    setState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, "app.documentTitle");
  }, [language]);

  const value = useMemo<I18n>(
    () => ({
      language,
      locale: LOCALES[language],
      t: (key, params) => translate(language, key, params),
      setLanguage,
      chosen,
    }),
    [language, setLanguage, chosen],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
