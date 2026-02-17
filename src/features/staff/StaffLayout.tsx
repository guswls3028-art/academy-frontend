// PATH: src/features/staff/StaffLayout.tsx
// 한국 사업장 기준: 인사 기본 · 근태 · 비용/경비 · 월 마감 · 급여 스냅샷 · 리포트/명세
import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const STAFF_TABS = [
  { key: "home", label: "홈", path: "/admin/staff/home" },
  { key: "attendance", label: "근태", path: "/admin/staff/attendance" },
  { key: "expenses", label: "비용/경비", path: "/admin/staff/expenses" },
  { key: "month-lock", label: "월 마감", path: "/admin/staff/month-lock" },
  { key: "payroll-snapshot", label: "급여 스냅샷", path: "/admin/staff/payroll-snapshot" },
  { key: "reports", label: "리포트/명세", path: "/admin/staff/reports" },
];

export default function StaffLayout() {
  return (
    <DomainLayout
      title="직원 관리"
      description="직원 목록 · 근태 · 비용/경비 · 월 마감 · 급여 스냅샷 · 리포트"
      tabs={STAFF_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
