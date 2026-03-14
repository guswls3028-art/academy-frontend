// PATH: src/features/clinic/ClinicLayout.tsx
// 클리닉 도메인 — Domain Header + ds-tabs + panel (프리미엄 SaaS 톤)

import "./clinic.css";
import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const CLINIC_TABS = [
  { key: "home", label: "오늘", path: "/admin/clinic/home" },
  { key: "schedule", label: "일정 관리", path: "/admin/clinic/schedule" },
  { key: "operations", label: "클리닉 진행", path: "/admin/clinic/operations" },
  { key: "bookings", label: "예약", path: "/admin/clinic/bookings" },
  { key: "reports", label: "리포트", path: "/admin/clinic/reports" },
  { key: "settings", label: "패스카드", path: "/admin/clinic/settings" },
  { key: "msg-settings", label: "메시지 설정", path: "/admin/clinic/msg-settings" },
];

export default function ClinicLayout() {
  return (
    <DomainLayout
      title="클리닉"
      description="오늘의 클리닉 상태 확인, 일정 생성, 대상자 예약, 운영까지"
      tabs={CLINIC_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
