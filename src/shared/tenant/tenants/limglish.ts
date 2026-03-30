// PATH: src/shared/tenant/tenants/limglish.ts
// 테넌트 3: limglish
import type { TenantDef } from "./types";

export const limglish: TenantDef = {
  id: 3,
  code: "limglish",
  name: "limglish",
  hostnames: ["limglish.kr", "www.limglish.kr"],
  loginPath: "/login/limglish",
  branding: {
    loginTitle: "limglish",
    loginSubtitle: "limglish.kr",
    logoUrl: "/tenants/limglish/logo.png",
    logoDarkUrl: "/tenants/limglish/logo-dark.png",
    windowTitle: "limglish",
    faviconUrl: "/tenants/limglish/favicon.png",
    headerLogoUrl: "/tenants/limglish/icon.png",
    headerLogoDarkUrl: "/tenants/limglish/icon-dark.png",
    ogDescription: "limglish 학습 플랫폼",
    ogImageUrl: "/tenants/limglish/og-image.png",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: true,
};
