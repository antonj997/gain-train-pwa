import { createContext, useContext } from "react";

export type Theme = "light" | "dark";
export type ThemeContextValue = {
  theme: Theme;
  /** Switches day and night; the choice is saved, so it stops following the phone. */
  toggleTheme: () => void;
  /** True once the theme is chosen by hand; false while it follows the phone. */
  chosen: boolean;
  /** Forgets the choice and follows the phone's appearance again. */
  followPhone: () => void;
};
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
