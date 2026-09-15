import { createContext, useContext, useEffect, useState, useRef } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("gain-train-theme");
    return (stored as Theme) || "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0d1016" : "#f5f6f9");
    localStorage.setItem("gain-train-theme", theme);
  }, [theme]);

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
    fadeTimer.current = setTimeout(
      () => document.documentElement.classList.remove("theme-fading"),
      700,
    );
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
