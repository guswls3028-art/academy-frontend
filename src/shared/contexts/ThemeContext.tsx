// PATH: src/shared/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  type ThemeKey,
  isThemeKey,
} from "@admin/domains/settings/constants/themes";

type ThemeContextState = {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextState | null>(null);

const STORAGE_KEY = "hakwonplus:theme";

/** Renamed theme key migration (구 key → 신 key) */
const LEGACY_KEY_MAP: Record<string, ThemeKey> = {
  "ivory-office": "mocha-office",
  "youtube-studio": "graphite-studio",
  "terminal-neon": "deep-ocean",
};

function loadThemeFromStorage(): ThemeKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isThemeKey(v)) return v;
    if (v && LEGACY_KEY_MAP[v]) {
      const migrated = LEGACY_KEY_MAP[v];
      try { localStorage.setItem(STORAGE_KEY, migrated); } catch {}
      return migrated;
    }
  } catch {
    // ignore
  }
  return "modern-white";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(loadThemeFromStorage);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  function setTheme(key: ThemeKey) {
    setThemeState(key);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
