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
    loginTitle: "림글리쉬",
    loginSubtitle: "limglish.kr",
    windowTitle: "림글리쉬",
    ogDescription: "림글리쉬 학습 플랫폼",
  },
  dedicatedLoginPage: true,
  hasCustomLogo: false,
};
