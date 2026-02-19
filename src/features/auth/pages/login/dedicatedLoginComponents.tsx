// PATH: src/features/auth/pages/login/dedicatedLoginComponents.tsx
// 전용 로그인 페이지를 쓰는 테넌트만 등록 (tenants/*.ts dedicatedLoginPage: true 와 1:1)
import type { ComponentType } from "react";
import type { TenantId } from "@/shared/tenant";
import TchulLoginPage from "./TchulLoginPage";

export const DEDICATED_LOGIN_COMPONENTS: Partial<Record<TenantId, ComponentType>> = {
  2: TchulLoginPage,
};
