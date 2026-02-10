import type { ThemeKey } from "../constants/themes";

export type ThemeSettingsDTO = {
  theme: ThemeKey;
};

export async function fetchThemeSettings(): Promise<ThemeSettingsDTO> {
  const theme =
    (document.documentElement.getAttribute("data-theme") as ThemeKey) ||
    "modern-white";

  return { theme };
}

export async function updateThemeSettings(
  theme: ThemeKey
): Promise<ThemeSettingsDTO> {
  document.documentElement.setAttribute("data-theme", theme);
  return { theme };
}
