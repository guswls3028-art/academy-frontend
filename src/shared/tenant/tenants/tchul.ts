// PATH: src/shared/tenant/tenants/tchul.ts
// 테넌트 2: 박철과학 (tchul.com)
import type { TenantDef } from "./types";

export const tchul: TenantDef = {
  id: 2,
  code: "tchul",
  name: "박철과학",
  hostnames: ["tchul.com", "www.tchul.com"],
  loginPath: "/login/tchul",
  branding: {
    loginTitle: "박철과학",
    loginSubtitle: "관리자 로그인",
    logoUrl: "/tenants/tchul/logo.png",
  },
  dedicatedLoginPage: true,
};
