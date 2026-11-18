import type { TenantDef } from "./types";

const accent = "#e46a1f";

export const dawon: TenantDef = {
  id: 719,
  code: "dawon",
  name: "다원수학",
  hostnames: ["demo.hakwonplus.com"],
  loginPath: "/login/dawon",
  branding: {
    loginTitle: "다원수학",
    windowTitle: "다원수학",
    defaultWorkspaceAccent: accent,
    headerPalette: {
      surface: "#ffffff",
      surfaceSoft: "#fff5ed",
      foreground: "#261c15",
      accent,
    },
  },
  dedicatedLoginPage: false,
  hasCustomLogo: false,
};
