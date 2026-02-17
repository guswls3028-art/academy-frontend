// PATH: src/features/settings/SettingsLayout.tsx
// 설정: 시스템 설정 · 내 계정 탭 통합 (students 도메인 디자인 기준)

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const SETTINGS_TABS = [
  { key: "system", label: "시스템 설정", path: "/admin/settings/system" },
  { key: "account", label: "내 계정", path: "/admin/settings/account" },
];

export default function SettingsLayout() {
  return (
    <DomainLayout
      title="설정"
      description="시스템 설정 · 내 계정"
      tabs={SETTINGS_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
