// PATH: src/shared/tenant/tenants/sswe.ts
// 테넌트 8: SSWE (sswe.co.kr)
import type { TenantDef } from "./types";

export const sswe: TenantDef = {
  id: 8,
  code: "sswe",
  name: "SSWE",
  hostnames: ["sswe.co.kr", "www.sswe.co.kr"],
  loginPath: "/login/sswe",
  branding: {
    loginTitle: "SSWE",
    loginSubtitle: "sswe.co.kr",
    logoUrl: "/tenants/sswe/logo.png",
    windowTitle: "SSWE",
    faviconUrl: "/tenants/sswe/favicon.png",
    headerLogoUrl: "/tenants/sswe/icon.png",
    ogDescription: "SSWE 학습 플랫폼 – 학생·선생님 로그인",
    ogImageUrl: "/tenants/sswe/og-image.png",
  },
  dedicatedLoginPage: false,
  hasCustomLogo: true,
};
