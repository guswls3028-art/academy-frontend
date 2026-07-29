// 테넌트 10: 이동휘원소 과학연구소 (movementhui.com)
import type { TenantDef } from "./types";

export const movementhui: TenantDef = {
  id: 10,
  code: "movementhui",
  name: "이동휘원소 과학연구소",
  hostnames: ["movementhui.com", "www.movementhui.com"],
  loginPath: "/login/movementhui",
  branding: {
    loginTitle: "이동휘원소",
    loginSubtitle: "과학연구소 · movementhui.com",
    logoUrl: "/tenants/movementhui/logo.png",
    windowTitle: "이동휘원소 과학연구소",
    faviconUrl: "/tenants/movementhui/favicon.png",
    headerLogoUrl: "/tenants/movementhui/icon.png",
    ogDescription: "이동휘원소 과학연구소 학습 플랫폼 – 학생·학부모·선생님 로그인",
    ogImageUrl: "/tenants/movementhui/og-image.png",
  },
  dedicatedLoginPage: false,
  hasCustomLogo: true,
};
