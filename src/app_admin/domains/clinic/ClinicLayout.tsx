// PATH: src/app_admin/domains/clinic/ClinicLayout.tsx
// 클리닉 도메인 — Domain Header + ds-tabs + panel (프리미엄 SaaS 톤)

import "./clinic.css";
import { Outlet } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

const CLINIC_TABS = [
  { key: "home", label: "오늘", path: "/workspace/clinic/home" },
  { key: "schedule", label: "예약 일정", path: "/workspace/clinic/schedule" },
  { key: "operations", label: "당일 진행", path: "/workspace/clinic/operations" },
  { key: "bookings", label: "미통과 관리", path: "/workspace/clinic/bookings" },
  { key: "settings", label: "패스카드", path: "/workspace/clinic/settings" },
  { key: "msg-settings", label: "메시지", path: "/workspace/clinic/msg-settings" },
];

const DESCRIPTIONS: Record<string, string> = {
  remediation: "불합격·미제출 통과 처리와 재시험 일정을 한 곳에서.",
  regular: "정규 클리닉 일정과 통과 처리. 반별 출석은 강의 상세에서.",
};

export default function ClinicLayout() {
  const { clinicMode } = useSectionMode();

  return (
    <DomainLayout
      className="clinic-domain-layout"
      title="클리닉"
      description={DESCRIPTIONS[clinicMode] ?? DESCRIPTIONS.remediation}
      tabs={CLINIC_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
