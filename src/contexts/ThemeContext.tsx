import { useEffect, useRef, useState, type ReactNode } from "react";
import { local, storageKeys, writeStored } from "@/lib/storage";
import { ThemeContext, type Theme } from "./useTheme";

const lightQuery = "(prefers-color-scheme: light)";
const savedTheme = (): Theme | null => {
  const saved = local.getItem(storageKeys.theme);
  return saved === "light" || saved === "dark" ? saved : null;
};
const systemTheme = (): Theme =>
  globalThis.matchMedia?.(lightQuery).matches ? "light" : "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // index.html applies the same choice before first paint.
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0d1016" : "#f5f6f9");
  }, [theme]);

  // Follow the system appearance until the user picks one in Settings.
  useEffect(() => {
    const query = globalThis.matchMedia?.(lightQuery);
    if (!query) return;
    const follow = () => {
      if (!savedTheme()) setTheme(systemTheme());
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(
    () => () => {
      clearTimeout(fadeTimer.current);
      document.documentElement.classList.remove("theme-fading");
    },
    [],
  );
  const toggleTheme = () => {
    clearTimeout(fadeTimer.current);
    document.documentElement.classList.add("theme-fading");
    // Commit transition styles before React applies the next theme's colors.
    void document.documentElement.offsetWidth;
    fadeTimer.current = setTimeout(
      () => document.documentElement.classList.remove("theme-fading"),
      700,
    );
    const next = theme === "light" ? "dark" : "light";
    writeStored(storageKeys.theme, next);
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
