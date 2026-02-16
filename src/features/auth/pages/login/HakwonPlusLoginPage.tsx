// PATH: src/features/auth/pages/login/HakwonPlusLoginPage.tsx
// 테넌트 1 (hakwonplus.com) 전용 — TenantLoginPage 래퍼
import TenantLoginPage from "./TenantLoginPage";

export default function HakwonPlusLoginPage() {
  return <TenantLoginPage tenantId={1} />;
}
