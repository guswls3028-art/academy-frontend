// PATH: src/shared/tenant/tenants/limglish.ts
// 테넌트 3: limglish
import type { TenantDef } from "./types";

export const limglish: TenantDef = {
  id: 3,
  code: "limglish",
  name: "limglish",
  hostnames: ["limglish.kr", "www.limglish.kr"],
  loginPath: "/login/limglish",
  branding: {
    loginTitle: "limglish 로그인",
    loginSubtitle: undefined,
    logoUrl: undefined,
  },
  dedicatedLoginPage: false,
};
