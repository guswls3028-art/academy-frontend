import type { ThemeKey } from "./themes";
export function normalizeAccent(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : null;
}
function rgb(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}
function mix(first: string, second: string, amount: number): string {
  const target = rgb(second);
  return "#" + rgb(first).map((channel, index) =>
    Math.round(channel * (1 - amount) + target[index] * amount).toString(16).padStart(2, "0")
  ).join("");
}
function luminance(hex: string): number {
  const channels = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrast(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** Preserve the chosen hue; render a readable tone on both the canvas and surface. */
export function accentVariables(theme: ThemeKey, accent: string): Record<string, string> {
  const dark = theme === "focus-dark";
  const surface = dark ? "#192129" : theme === "paper" ? "#fdfcf8" : "#ffffff";
  const canvas = dark ? "#111820" : theme === "paper" ? "#f4f3ed" : "#f7f8fa";
  const pole = dark ? "#ffffff" : "#000000";
  let primary = accent;
  for (let step = 1; step <= 100 && Math.min(contrast(primary, surface), contrast(primary, canvas)) < 4.6; step++) {
    primary = mix(accent, pole, step / 100);
  }
  const foreground = contrast(primary, "#ffffff") >= contrast(primary, "#111820") ? "#ffffff" : "#111820";
  return {
    "--scale-Primary50": mix(surface, primary, 0.06),
    "--scale-Primary100": mix(surface, primary, 0.12),
    "--scale-Primary200": mix(surface, primary, 0.22),
    "--scale-Primary300": mix(surface, primary, 0.40),
    "--scale-Primary400": mix(surface, primary, 0.75),
    "--scale-Primary500": primary,
    "--scale-Primary600": mix(primary, pole, 0.10),
    "--scale-Primary700": mix(primary, pole, 0.20),
    "--color-primary-rgb": rgb(primary).join(", "),
    "--color-brand-primary-contrast": foreground,
    "--text-on-primary": foreground,
  };
}
