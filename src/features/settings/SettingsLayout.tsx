// PATH: src/features/settings/SettingsLayout.tsx
// 설정: 내 정보 · 테마 탭 (students 도메인 디자인 기준)

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const SETTINGS_TABS = [
  { key: "account", label: "내 정보", path: "/admin/settings/account" },
  { key: "system", label: "테마", path: "/admin/settings/system" },
];

export default function SettingsLayout() {
  return (
    <DomainLayout
      title="설정"
      description="내 정보 · 테마"
      tabs={SETTINGS_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
