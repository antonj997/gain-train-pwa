import { useEffect, useRef, useState, type ReactNode } from "react";
import { motionMs } from "@/lib/slow-motion";
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
  const [theme, setTheme] = useState<Theme>(
    () => savedTheme() ?? systemTheme(),
  );
  const [chosen, setChosen] = useState(() => savedTheme() !== null);
  // The theme a change is heading for, so two quick taps alternate.
  const target = useRef(theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0F1115" : "#F4F5F7");
  }, [theme]);

  // Follow the system appearance until the user picks one in Settings.
  useEffect(() => {
    const query = globalThis.matchMedia?.(lightQuery);
    if (!query) return;
    const follow = () => {
      if (savedTheme()) return;
      target.current = systemTheme();
      setTheme(target.current);
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();
  const fadeFrame = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(fadeTimer.current);
      cancelAnimationFrame(fadeFrame.current);
      document.documentElement.classList.remove("theme-fading");
    },
    [],
  );
  /**
   * Fades to a theme over --gt-dur-theme (650 ms). The transition class goes
   * on a frame before the theme class (R9): WebKit then has every row's
   * transition in place when the colours change, so text and surface fade
   * together instead of the text jumping or vanishing.
   */
  const fadeTo = (next: Theme) => {
    target.current = next;
    clearTimeout(fadeTimer.current);
    cancelAnimationFrame(fadeFrame.current);
    const root = document.documentElement;
    root.classList.add("theme-fading");
    // Commit the transition styles now, then change the theme a frame later.
    void root.offsetWidth;
    fadeFrame.current = requestAnimationFrame(() => {
      fadeFrame.current = requestAnimationFrame(() => {
        setTheme(next);
        fadeTimer.current = setTimeout(
          () => root.classList.remove("theme-fading"),
          motionMs(700),
        );
      });
    });
  };
  const toggleTheme = () => {
    const next = target.current === "light" ? "dark" : "light";
    writeStored(storageKeys.theme, next);
    setChosen(true);
    fadeTo(next);
  };
  const followPhone = () => {
    writeStored(storageKeys.theme, null);
    setChosen(false);
    const next = systemTheme();
    if (next !== target.current) fadeTo(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, chosen, followPhone }}>
      {children}
    </ThemeContext.Provider>
  );
}
