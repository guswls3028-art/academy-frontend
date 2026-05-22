/* eslint-disable react-refresh/only-export-components -- theme hook and provider share one context boundary. */
// PATH: src/shared/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  type ThemeKey,
  isThemeKey,
} from "@/shared/theme/themes";
import {
  applyThemeToDom,
  loadThemeFromStorage as loadRuntimeThemeFromStorage,
} from "@/shared/theme/themeRuntime";

type ThemeContextState = {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextState | null>(null);

function loadThemeFromStorage(): ThemeKey {
  return loadRuntimeThemeFromStorage() ?? "modern-white";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(loadThemeFromStorage);

  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
      if (typeof next !== "string" || !isThemeKey(next)) return;
      setThemeState((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("themechange", listener);
    return () => window.removeEventListener("themechange", listener);
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
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
