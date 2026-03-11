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
    loginTitle: "limglish",
    loginSubtitle: "limglish.kr",
    windowTitle: "limglish",
    ogDescription: "limglish 학습 플랫폼",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: false,
};
