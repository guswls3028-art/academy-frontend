// PATH: src/features/settings/theme/themeRuntime.ts
import type { ThemeKey } from "../constants/themes";

const STORAGE_KEY = "hakwonplus:theme";

/**
 * Frontend Theme Runtime SSOT
 * - 서버 ❌
 * - localStorage = 단일 진실
 * - data-theme만 design-system에 전달
 */

export function applyThemeToDom(theme: ThemeKey) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

export function loadThemeFromStorage(): ThemeKey | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v as ThemeKey | null;
  } catch {
    return null;
  }
}
