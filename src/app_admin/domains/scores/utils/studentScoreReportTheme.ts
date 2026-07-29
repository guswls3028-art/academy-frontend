export type StudentScoreReportTheme = {
  primary: string;
  accent: string;
  tint: string;
  onPrimary: string;
  onAccent: string;
  logoUrl: string;
};

type StudentScoreReportThemeInput = {
  tenantCode?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
};

type ReportPalette = Pick<StudentScoreReportTheme, "primary" | "accent" | "tint">;

const DEFAULT_PALETTE: ReportPalette = {
  primary: "#14213d",
  accent: "#f5d66f",
  tint: "#fff8d8",
};

// Program.ui_config.primary_color wins. These report-only fallbacks mirror each
// tenant's existing auth/logo palette when a database color is not configured.
const TENANT_PALETTES: Record<string, ReportPalette> = {
  hakwonplus: { primary: "#1e3a8a", accent: "#60a5fa", tint: "#eaf2ff" },
  tchul: { primary: "#0d47a1", accent: "#00897b", tint: "#e8f5f3" },
  limglish: { primary: "#1a2e47", accent: "#6f8eae", tint: "#edf2f7" },
  ymath: { primary: "#0b4a82", accent: "#5bb6e0", tint: "#eaf7fc" },
  sswe: { primary: "#002357", accent: "#f18e2c", tint: "#fff2e4" },
  dnb: { primary: "#612e8d", accent: "#f3eb40", tint: "#fbfae3" },
  "9999": DEFAULT_PALETTE,
};

function normalizeHexColor(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const shortMatch = /^#([\da-f]{3})$/i.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return /^#[\da-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastText(background: string): string {
  return relativeLuminance(background) > 0.52 ? "#172033" : "#ffffff";
}

function normalizeLogoUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);/i.test(trimmed)) return trimmed;
  return "";
}

export function resolveStudentScoreReportTheme({
  tenantCode,
  primaryColor,
  logoUrl,
}: StudentScoreReportThemeInput): StudentScoreReportTheme {
  const code = String(tenantCode ?? "").trim().toLowerCase();
  const fallback = TENANT_PALETTES[code] ?? DEFAULT_PALETTE;
  const primary = normalizeHexColor(primaryColor) ?? fallback.primary;

  return {
    ...fallback,
    primary,
    onPrimary: contrastText(primary),
    onAccent: contrastText(fallback.accent),
    logoUrl: normalizeLogoUrl(logoUrl),
  };
}
