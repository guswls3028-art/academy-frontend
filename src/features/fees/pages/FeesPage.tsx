// PATH: src/features/fees/pages/FeesPage.tsx
// 관리자 수납 관리 — DomainLayout (탭: 수납 현황 / 청구서 / 비목 관리)

import { Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/domain";

const TABS: DomainTab[] = [
  { key: "dashboard", label: "수납 현황", path: "/admin/fees", exact: true },
  { key: "invoices", label: "청구서", path: "/admin/fees/invoices" },
  { key: "templates", label: "비목 관리", path: "/admin/fees/templates" },
];

export default function FeesPage() {
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
