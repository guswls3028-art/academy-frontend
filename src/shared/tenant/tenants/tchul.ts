// PATH: src/shared/tenant/tenants/tchul.ts
// 테넌트 2: 박철과학 (tchul.com)
// 색상/테마 SSOT: @/features/auth/themes/tchul.css (화이트톤 + 그라데이션)
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
