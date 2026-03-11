// PATH: src/shared/tenant/tenants/ymath.ts
// 테넌트 4: ymath
import type { TenantDef } from "./types";

export const ymath: TenantDef = {
  id: 4,
  code: "ymath",
  name: "ymath",
  hostnames: ["ymath.co.kr", "www.ymath.co.kr"],
  loginPath: "/login/ymath",
  branding: {
    loginTitle: "ymath",
    loginSubtitle: "ymath.co.kr",
    windowTitle: "ymath",
    ogDescription: "ymath 학습 플랫폼",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: false,
};
