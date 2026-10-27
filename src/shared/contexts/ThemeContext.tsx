/* eslint-disable react-refresh/only-export-components -- provider and hook share one boundary. */
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_ACCENT, isThemeKey, type ThemeKey } from "@/shared/theme/themes";
import { normalizeAccent } from "@/shared/theme/accent";
import { applyAppearance, loadAppearance, type Appearance, type AppearanceResult } from "@/shared/theme/themeRuntime";
type ThemeContextState = Appearance & {
  persisted: boolean;
  setTheme: (theme: ThemeKey) => void;
  setAccent: (accent: string) => void;
  resetAppearance: () => void;
  retrySave: () => void;
};
const ThemeContext = createContext<ThemeContextState | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);
  const [persisted, setPersisted] = useState(true);
  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<AppearanceResult>).detail;
      if (!next || !isThemeKey(next.theme) || !normalizeAccent(next.accent)) return;
      setAppearance((previous) => previous.theme === next.theme && previous.accent === next.accent
        ? previous : { version: 1, theme: next.theme, accent: next.accent });
      setPersisted(next.persisted);
    };
    window.addEventListener("themechange", listener);
    return () => window.removeEventListener("themechange", listener);
  }, []);
  useEffect(() => { applyAppearance(appearance); }, [appearance]);
  return <ThemeContext.Provider value={{
    ...appearance, persisted,
    setTheme: (theme) => setAppearance((previous) => ({ ...previous, theme })),
    setAccent: (value) => {
      const accent = normalizeAccent(value);
      if (accent) setAppearance((previous) => ({ ...previous, accent }));
    },
    resetAppearance: () => setAppearance({ version: 1, theme: "modern-white", accent: DEFAULT_ACCENT }),
    retrySave: () => { applyAppearance(appearance); },
  }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
