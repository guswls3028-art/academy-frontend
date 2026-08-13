import type { ThemeKey } from "./themes";
import { isThemeKey } from "./themes";
import { getLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

const STORAGE_KEY = "hakwonplus:theme";

const LEGACY_KEY_MAP: Record<string, ThemeKey> = {
  "ivory-office": "mocha-office",
  "youtube-studio": "graphite-studio",
  "terminal-neon": "deep-ocean",
};

function migrateThemeKey(raw: string): ThemeKey | null {
  if (isThemeKey(raw)) return raw;
  const migrated = LEGACY_KEY_MAP[raw];
  if (migrated) {
    try {
      setLocalItem(STORAGE_KEY, migrated);
    } catch {
      // localStorage can be unavailable in private or embedded contexts.
    }
    return migrated;
  }
  return null;
}

export function applyThemeToDom(theme: ThemeKey) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    setLocalItem(STORAGE_KEY, theme);
  } catch {
    // localStorage can be unavailable in private or embedded contexts.
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

export function loadThemeFromStorage(): ThemeKey | null {
  try {
    const v = getLocalItem(STORAGE_KEY);
    if (!v) return null;
    return migrateThemeKey(v);
  } catch {
    return null;
  }
}
