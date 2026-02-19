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
    loginTitle: "HakwonPlus 관리자 로그인",
    loginSubtitle: undefined,
    logoUrl: undefined,
  },
  dedicatedLoginPage: false,
};
