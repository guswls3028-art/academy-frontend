// 테넌트 11: 신과함께 (godmin.kr)
import type { TenantDef } from "./types";

export const godmin: TenantDef = {
  id: 11,
  code: "godmin",
  name: "신과함께",
  hostnames: ["godmin.kr", "www.godmin.kr"],
  loginPath: "/login/godmin",
  branding: {
    loginTitle: "신과함께",
    loginSubtitle: "godmin.kr",
    logoUrl: "/tenants/godmin/logo.png",
    windowTitle: "신과함께",
    faviconUrl: "/tenants/godmin/favicon.png",
    headerLogoUrl: "/tenants/godmin/icon.png",
    headerPalette: {
      surface: "#e4f7ef",
      surfaceSoft: "#d2f0e2",
      foreground: "#24483d",
      accent: "#147a62",
    },
    ogDescription: "신과함께 학습 플랫폼 – 학생·학부모·선생님 로그인",
    ogImageUrl: "/tenants/godmin/og-image.png",
  },
  dedicatedLoginPage: false,
  hasCustomLogo: true,
};
