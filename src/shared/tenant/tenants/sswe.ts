// PATH: src/shared/tenant/tenants/sswe.ts
// 테넌트 5: SSWE (sswe.co.kr)
import type { TenantDef } from "./types";

export const sswe: TenantDef = {
  id: 5,
  code: "sswe",
  name: "SSWE",
  hostnames: ["sswe.co.kr", "www.sswe.co.kr"],
  loginPath: "/login/sswe",
  branding: {
    loginTitle: "SSWE",
    loginSubtitle: "sswe.co.kr",
    logoUrl: undefined,
  },
  dedicatedLoginPage: false,
};
