// PATH: src/shared/tenant/tenants/hakwonplus.ts
// 테넌트 1: 학원플러스 (메인)
import type { TenantDef } from "./types";

export const hakwonplus: TenantDef = {
  id: 1,
  code: "hakwonplus",
  name: "학원플러스",
  hostnames: ["hakwonplus.com", "www.hakwonplus.com"],
  loginPath: "/login/hakwonplus",
  branding: {
    loginTitle: "학원플러스",
    loginSubtitle: "hakwonplus.com",
    logoUrl: "/tenants/hakwonplus/logo.png",
    windowTitle: "학원플러스",
    faviconUrl: "/tenants/hakwonplus/favicon.png",
    headerLogoUrl: "/tenants/hakwonplus/icon.png",
    ogDescription: "학원플러스 – 학원 관리·학생 학습 플랫폼",
    ogImageUrl: "/tenants/hakwonplus/og-image.png",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: true,
};
