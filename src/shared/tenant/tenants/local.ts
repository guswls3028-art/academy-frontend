// PATH: src/shared/tenant/tenants/local.ts
// 테넌트 9999: 학원플러스 로컬 개발/테스트용 (1과 동일 앱, tenantCode만 9999)
import type { TenantDef } from "./types";

export const local: TenantDef = {
  id: 9999,
  code: "9999",
  name: "학원플러스 (로컬)",
  hostnames: ["localhost", "127.0.0.1"],
  loginPath: "/login/tchul",
  branding: {
    loginTitle: "로컬 개발 (9999)",
    loginSubtitle: undefined,
    logoUrl: undefined,
  },
  dedicatedLoginPage: false,
};
