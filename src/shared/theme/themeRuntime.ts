import { DEFAULT_ACCENT, isThemeKey, type ThemeKey } from "./themes";
import { getTenantBranding, getTenantIdFromCode, resolveTenantCodeString } from "@/shared/tenant";
import { accentVariables, normalizeAccent } from "./accent";
import { getLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";
export const APPEARANCE_STORAGE_KEY = "hakwonplus:appearance";
const LEGACY_STORAGE_KEY = "hakwonplus:theme";
export type Appearance = { version: 1; theme: ThemeKey; accent: string };
export type AppearanceResult = Appearance & { persisted: boolean };
const LEGACY: Record<string, [ThemeKey, string]> = {
  "navy-pro": ["modern-white", DEFAULT_ACCENT],
  "mocha-office": ["paper", "#ad5f1b"],
  "ivory-office": ["paper", "#ad5f1b"],
  "minimal-mono": ["paper", "#1e293b"],
  "modern-dark": ["focus-dark", "#60a5fa"],
  "dark-navy": ["focus-dark", "#3b82f6"],
  "graphite-studio": ["focus-dark", "#8b7cf8"],
  "youtube-studio": ["focus-dark", "#8b7cf8"],
  "deep-ocean": ["focus-dark", "#38bdf8"],
  "terminal-neon": ["focus-dark", "#38bdf8"],
  "kakao-business": ["modern-white", "#5c2d0e"],
  "naver-works": ["modern-white", "#04745d"],
  "samsung-admin": ["modern-white", "#0057d9"],
  "purple-insight": ["modern-white", "#7c3aed"],
};
export function defaultAppearance(): Appearance {
  const tenantId = getTenantIdFromCode(resolveTenantCodeString());
  const accent = tenantId && getTenantBranding(tenantId).defaultWorkspaceAccent;
  return { version: 1, theme: "modern-white", accent: accent ?? DEFAULT_ACCENT };
}
export function loadAppearance(): Appearance {
  const raw = getLocalItem(APPEARANCE_STORAGE_KEY);
  try {
    const saved: Partial<Appearance> | null = raw ? JSON.parse(raw) : null;
    if (saved?.version === 1 && isThemeKey(saved.theme)) {
      const accent = normalizeAccent(saved.accent);
      if (accent) return { version: 1, theme: saved.theme, accent };
    }
  } catch { /* A damaged preference must never prevent entering the app. */ }
  const old = getLocalItem(LEGACY_STORAGE_KEY);
  if (old && Object.prototype.hasOwnProperty.call(LEGACY, old)) {
    const [theme, accent] = LEGACY[old];
    return { version: 1, theme, accent };
  }
  if (isThemeKey(old)) return { version: 1, theme: old, accent: DEFAULT_ACCENT };
  return defaultAppearance();
}
export function applyAppearance(appearance: Appearance): AppearanceResult {
  const root = document.documentElement;
  root.setAttribute("data-theme", appearance.theme);
  for (const [key, value] of Object.entries(accentVariables(appearance.theme, appearance.accent))) root.style.setProperty(key, value);
  const serialized = JSON.stringify(appearance);
  setLocalItem(APPEARANCE_STORAGE_KEY, serialized);
  // Compatibility readback; the versioned object is the only authoritative preference.
  setLocalItem(LEGACY_STORAGE_KEY, appearance.theme === "focus-dark" ? "modern-dark" : appearance.theme === "paper" ? "minimal-mono" : "modern-white");
  const result = { ...appearance, persisted: getLocalItem(APPEARANCE_STORAGE_KEY) === serialized };
  window.dispatchEvent(new CustomEvent("themechange", { detail: result }));
  return result;
}
export function applyThemeToDom(theme: ThemeKey) {
  return applyAppearance({ ...loadAppearance(), theme });
}
export function loadThemeFromStorage(): ThemeKey { return loadAppearance().theme; }
