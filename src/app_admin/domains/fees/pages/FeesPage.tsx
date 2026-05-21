// PATH: src/app_admin/domains/fees/pages/FeesPage.tsx
// 관리자 수납 관리 — DomainLayout (탭: 수납 현황 / 청구서 / 비목 관리)

import { Navigate, Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/domain";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { useProgram } from "@/shared/program";
import useAuth from "@/auth/hooks/useAuth";
import styles from "./FeesPage.module.css";

const TABS: DomainTab[] = [
  { key: "dashboard", label: "수납 현황", path: "/admin/fees", exact: true },
  { key: "invoices", label: "청구서", path: "/admin/fees/invoices" },
  { key: "templates", label: "비목 관리", path: "/admin/fees/templates" },
];

export default function FeesPage() {
  const { isLoading } = useProgram();
  const { user, isLoading: authLoading } = useAuth();
  const enabled = useFeesEnabled();
  const isTenantAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin" || !!user?.is_superuser;

  // program 로드 전에는 플래그 미확정 — 즉시 Navigate 금지 (대시보드 오탈리 다이렉트 방지)
  if (isLoading || authLoading) {
    return (
      <div className="p-6 flex flex-col gap-3" aria-label="로딩 중">
        <div className={`skeleton ${styles.skeletonTitle}`} />
        <div className={`skeleton ${styles.skeletonMedium}`} />
        <div className={`skeleton ${styles.skeletonLarge}`} />
      </div>
    );
  }

  if (!enabled || !isTenantAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <DomainLayout
      title="수납 관리"
      description="수강료, 교재비 등 학생 수납을 관리합니다"
      tabs={TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
