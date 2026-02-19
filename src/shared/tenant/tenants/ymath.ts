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
    loginTitle: "ymath 로그인",
    loginSubtitle: undefined,
    logoUrl: undefined,
  },
  dedicatedLoginPage: false,
};
