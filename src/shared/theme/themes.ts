export type ThemeKey = "modern-white" | "paper" | "focus-dark";
export type ThemeGroup = "WHITE" | "DARK";
export type ThemeMeta = { key: ThemeKey; name: string; desc: string; group: ThemeGroup; order: number };
export const THEMES: ThemeMeta[] = [
  { key: "modern-white", name: "클린", desc: "여백과 가벼운 구분으로 정돈한 기본 화면", group: "WHITE", order: 1 },
  { key: "paper", name: "노트", desc: "종이 같은 바탕과 또렷한 선으로 읽는 화면", group: "WHITE", order: 2 },
  { key: "focus-dark", name: "포커스", desc: "낮은 눈부심과 차분한 면으로 집중하는 화면", group: "DARK", order: 3 },
];
export const DEFAULT_ACCENT = "#2563eb";
export function getThemeMeta(key: ThemeKey): ThemeMeta {
  return THEMES.find((theme) => theme.key === key) ?? THEMES[0];
}
export function isThemeKey(value: unknown): value is ThemeKey {
  return THEMES.some((theme) => theme.key === value);
}
