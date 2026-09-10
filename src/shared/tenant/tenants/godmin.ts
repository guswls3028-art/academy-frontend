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
    ogDescription: "13년 차 통합과학 강사 신민T의 수업 철학과 학습 관리, 수강생·학부모 전용 학습 플랫폼.",
    ogImageUrl: "/tenants/godmin/og-image.png",
  },
  dedicatedLoginPage: false,
  studentSelfRegistrationEnabled: false,
  hasCustomLogo: true,
};
