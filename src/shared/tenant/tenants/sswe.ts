// PATH: src/shared/tenant/tenants/sswe.ts
// 테넌트 5: SSWE (sswe.co.kr)
import type { TenantDef } from "./types";

export const sswe: TenantDef = {
  id: 5,
  code: "sswe",
  name: "sswe.co.kr",
  hostnames: ["sswe.co.kr", "www.sswe.co.kr"],
  loginPath: "/login/sswe",
  branding: {
    loginTitle: "sswe.co.kr",
    loginSubtitle: "sswe.co.kr",
    windowTitle: "sswe.co.kr",
    ogDescription: "sswe.co.kr 학습 플랫폼",
  },
  dedicatedLoginPage: false,
  hasCustomLogo: false,
};
