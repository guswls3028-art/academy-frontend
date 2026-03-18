// PATH: src/shared/tenant/tenants/dnb.ts
// 테넌트 9: DNB Academy (dnbacademy.co.kr)
import type { TenantDef } from "./types";

export const dnb: TenantDef = {
  id: 9,
  code: "dnb",
  name: "DNB Academy",
  hostnames: ["dnbacademy.co.kr", "www.dnbacademy.co.kr"],
  loginPath: "/login/dnb",
  branding: {
    loginTitle: "DNB Academy",
    loginSubtitle: "dnbacademy.co.kr",
    windowTitle: "DNB Academy",
    ogDescription: "DNB Academy 학습 플랫폼 – 학생·선생님 로그인",
  },
  dedicatedLoginPage: false,
  hasCustomLogo: false,
};
