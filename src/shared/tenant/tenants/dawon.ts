import type { TenantDef } from "./types";

export const dawon: TenantDef = {
  id: 719,
  code: "dawon",
  name: "다원수학",
  hostnames: ["demo.hakwonplus.com"],
  loginPath: "/login/dawon",
  branding: {
    loginTitle: "다원수학",
    windowTitle: "다원수학",
    headerPalette: {
      surface: "#ffffff",
      surfaceSoft: "#fff5ed",
      foreground: "#261c15",
      accent: "#e46a1f",
    },
  },
  dedicatedLoginPage: false,
  hasCustomLogo: false,
};
