// PATH: src/shared/tenant/tenants/tchul.ts
// 테넌트 2: 박철과학 (tchul.com)
// 색상/테마 SSOT: @/features/auth/themes/tchul.css (화이트톤 + 그라데이션)
import type { TenantDef } from "./types";

export const tchul: TenantDef = {
  id: 2,
  code: "tchul",
  name: "Tchul.com",
  hostnames: ["tchul.com", "www.tchul.com"],
  loginPath: "/login/tchul",
  branding: {
    loginTitle: "박철 과학",
    loginSubtitle: "tchul.com",
    logoUrl: "/tenants/tchul/logo.png",
    windowTitle: "박철 과학",
    faviconUrl: "/tenants/tchul/favicon.png",
    headerLogoUrl: "/tenants/tchul/icon.png",
    ogDescription: "박철 과학(tchul.com) – 대치동 과학 전문 학습 플랫폼",
    ogImageUrl: "/tenants/tchul/og-image.png",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: true,
};
