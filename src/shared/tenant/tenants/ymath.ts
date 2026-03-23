// PATH: src/shared/tenant/tenants/ymath.ts
// 테넌트 4: ymath
import type { TenantDef } from "./types";

export const ymath: TenantDef = {
  id: 4,
  code: "ymath",
  name: "Y_math",
  hostnames: ["ymath.co.kr", "www.ymath.co.kr"],
  loginPath: "/login/ymath",
  branding: {
    loginTitle: "Y_math",
    loginSubtitle: "ymath.co.kr",
    logoUrl: "/tenants/ymath/logo.png",
    windowTitle: "Y_math",
    faviconUrl: "/tenants/ymath/favicon.png",
    headerLogoUrl: "/tenants/ymath/icon.png",
    ogDescription: "Y_math 학습 플랫폼",
    ogImageUrl: "/tenants/ymath/og-image.png",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: true,
};
