// PATH: src/features/clinic/ClinicLayout.tsx
// 클리닉 도메인 — Domain Header + ds-tabs + panel (프리미엄 SaaS 톤)

import "./clinic.css";
import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const CLINIC_TABS = [
  { key: "home", label: "홈", path: "/admin/clinic/home" },
  { key: "operations", label: "운영", path: "/admin/clinic/operations" },
  { key: "bookings", label: "예약대상자", path: "/admin/clinic/bookings" },
  { key: "reports", label: "리포트", path: "/admin/clinic/reports" },
  { key: "settings", label: "설정", path: "/admin/clinic/settings" },
];

export default function ClinicLayout() {
  return (
    <DomainLayout
      title="클리닉"
      description="대상자·예약·운영을 한 화면에서. 대형 강사용 통제실."
      tabs={CLINIC_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
