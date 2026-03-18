// PATH: src/shared/tenant/tenants/dnb.ts
// 테넌트 9: DNB Academy (dnbacademy.co.kr)
import type { TenantDef } from "./types";

export const dnb: TenantDef = {
  id: 9,
  code: "dnb",
  name: "DnB 보습학원",
  hostnames: ["dnbacademy.co.kr", "www.dnbacademy.co.kr"],
  loginPath: "/login/dnb",
  branding: {
    loginTitle: "DnB 보습학원",
    loginSubtitle: "dnbacademy.co.kr",
    logoUrl: "/tenants/dnb/logo.png",
    windowTitle: "DnB 보습학원",
    faviconUrl: "/tenants/dnb/favicon.png",
    headerLogoUrl: "/tenants/dnb/icon.png",
    ogDescription: "DnB 보습학원 학습 플랫폼 – 학생·선생님 로그인",
    ogImageUrl: "/tenants/dnb/og-image.png",
  },
  dedicatedLoginPage: false,
  hasCustomLogo: true,
};
