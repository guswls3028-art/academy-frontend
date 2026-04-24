// PATH: src/app_admin/domains/clinic/ClinicLayout.tsx
// 클리닉 도메인 — Domain Header + ds-tabs + panel (프리미엄 SaaS 톤)

import "./clinic.css";
import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { useSectionMode } from "@/shared/hooks/useSectionMode";

const CLINIC_TABS = [
  { key: "home", label: "오늘", path: "/admin/clinic/home" },
  { key: "operations", label: "클리닉 진행", path: "/admin/clinic/operations" },
  { key: "bookings", label: "진행중 항목", path: "/admin/clinic/bookings" },
  { key: "settings", label: "패스카드", path: "/admin/clinic/settings" },
  { key: "msg-settings", label: "메시지 설정", path: "/admin/clinic/msg-settings" },
];

const DESCRIPTIONS: Record<string, string> = {
  remediation: "진행중 항목 관리 — 불합격/미응시/미제출 통과 처리, 재시험 운영, 클리닉 일정까지",
  regular: "정규 클리닉 운영 — 반별 일정·출석·통과 처리. 반별 출석은 강의 상세 → 차시 탭에서 관리",
};

export default function ClinicLayout() {
  const { clinicMode } = useSectionMode();

  return (
    <DomainLayout
      title="클리닉"
      description={DESCRIPTIONS[clinicMode] ?? DESCRIPTIONS.remediation}
      tabs={CLINIC_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
