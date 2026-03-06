// PATH: src/features/auth/pages/login/dedicatedLoginComponents.tsx
// 전용 로그인 페이지를 쓰는 테넌트만 등록 (tenants/*.ts dedicatedLoginPage: true 와 1:1)
// 2번(박철과학): TchulLoginPage 전용. 1,3,4,9999: EnhancedCommonLoginPage (로고·타이포·클릭입력폼)
import type { ComponentType } from "react";
import type { TenantId } from "@/shared/tenant";
import TchulLoginPage from "./TchulLoginPage";
import EnhancedCommonLoginPage from "./EnhancedCommonLoginPage";

export const DEDICATED_LOGIN_COMPONENTS: Partial<Record<TenantId, ComponentType>> = {
  1: EnhancedCommonLoginPage,
  2: TchulLoginPage,
  3: EnhancedCommonLoginPage,
  4: EnhancedCommonLoginPage,
  9999: EnhancedCommonLoginPage,
};
