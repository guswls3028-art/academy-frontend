import type { TenantDef } from "./types";

export const JEONGSEONGWON_LAB_DOMAIN = "xn--oj4bo6fugp3an0c.com";
export const JEONGSEONGWON_LAB_ASSETS = "/tenants/jeongseongwon-lab";
export const JEONGSEONGWON_LAB_NAME = "정성원연구소";
export const JEONGSEONGWON_LAB_DESCRIPTION = "정성원연구소 수강생과 선생님을 위한 학습 공간";

export const jeongseongwonLab: TenantDef = {
  id: 12,
  code: "jeongseongwon-lab",
  name: JEONGSEONGWON_LAB_NAME,
  hostnames: [JEONGSEONGWON_LAB_DOMAIN, `www.${JEONGSEONGWON_LAB_DOMAIN}`],
  loginPath: "/login/jeongseongwon-lab",
  branding: {
    loginTitle: JEONGSEONGWON_LAB_NAME,
    loginSubtitle: "정성원영어.com",
    logoUrl: `${JEONGSEONGWON_LAB_ASSETS}/logo.png`,
    windowTitle: JEONGSEONGWON_LAB_NAME,
    faviconUrl: `${JEONGSEONGWON_LAB_ASSETS}/favicon.png`,
    headerLogoUrl: `${JEONGSEONGWON_LAB_ASSETS}/icon.png`,
    headerPalette: {
      surface: "#1a2f4e",
      surfaceSoft: "#273c5b",
      foreground: "#ffffff",
      accent: "#efcf83",
    },
    ogDescription: JEONGSEONGWON_LAB_DESCRIPTION,
    ogImageUrl: `${JEONGSEONGWON_LAB_ASSETS}/og-image.png`,
  },
  dedicatedLoginPage: false,
  hasCustomLogo: true,
};
