// PATH: src/features/fees/pages/FeesPage.tsx
// 관리자 수납 관리 — DomainLayout (탭: 수납 현황 / 청구서 / 비목 관리)

import { Navigate, Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/domain";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { useProgram } from "@/shared/program";

const TABS: DomainTab[] = [
  { key: "dashboard", label: "수납 현황", path: "/admin/fees", exact: true },
  { key: "invoices", label: "청구서", path: "/admin/fees/invoices" },
  { key: "templates", label: "비목 관리", path: "/admin/fees/templates" },
];

export default function FeesPage() {
  const { isLoading } = useProgram();
  const enabled = useFeesEnabled();

  // program 로드 전에는 플래그 미확정 — 즉시 Navigate 금지 (대시보드 오탈리 다이렉트 방지)
  if (isLoading) {
    return (
      <div
        className="p-6"
        style={{ color: "var(--color-text-secondary)", minHeight: 160 }}
      >
        불러오는 중…
      </div>
    );
  }

  if (!enabled) {
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
