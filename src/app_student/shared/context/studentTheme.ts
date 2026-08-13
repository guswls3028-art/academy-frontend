import { createContext, useContext } from "react";
import { getLocalItem } from "@/shared/utils/safeLocalStorage";

export type ThemeMode = "light" | "dark" | "system";

export interface StudentThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  toggleMode: () => void;
  setMode: (m: ThemeMode) => void;
}

export const STUDENT_THEME_STORAGE_KEY = "hakwonplus:student-theme-mode";

export function getSystemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function getInitialMode(): ThemeMode {
  try {
    const stored = getLocalItem(STUDENT_THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    // SSR or localStorage unavailable
  }
  return "light";
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "system") return getSystemPrefersDark();
  return mode === "dark";
}

export const StudentThemeContext = createContext<StudentThemeCtx>({
  mode: "light",
  isDark: false,
  toggleMode: () => {},
  setMode: () => {},
});

export function useStudentTheme() {
  return useContext(StudentThemeContext);
}
