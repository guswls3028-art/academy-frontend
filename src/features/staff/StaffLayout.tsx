// PATH: src/features/staff/StaffLayout.tsx
import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const STAFF_TABS = [
  { key: "home", label: "홈", path: "/admin/staff/home" },
  { key: "operations", label: "작업", path: "/admin/staff/operations" },
  { key: "reports", label: "리포트", path: "/admin/staff/reports" },
];

export default function StaffLayout() {
  return (
    <DomainLayout
      title="직원 관리"
      description="직원 정보 · 근무 · 비용 · 급여 관리"
      tabs={STAFF_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
