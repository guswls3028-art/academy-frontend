// PATH: src/features/staff/StaffLayout.tsx
// 도메인 헤더(직원 관리 + 탭) 유지. 프리미엄 스타일 적용.
import "./styles/staff-area.css";
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
      description="직원 · 근태 · 비용/경비 · 월 마감 · 급여 스냅샷 · 리포트/명세"
      tabs={STAFF_TABS}
    >
      <div className="staff-area">
        <Outlet />
      </div>
    </DomainLayout>
  );
}
