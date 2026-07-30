// PATH: src/app_admin/domains/developer/layout/DeveloperLayout.tsx
// To개발자 — DomainLayout 탭 SSOT

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const DEVELOPER_TABS: DomainTab[] = [
  { key: "bug", label: "버그 제보", path: "/workspace/developer/bug" },
  { key: "feedback", label: "피드백", path: "/workspace/developer/feedback" },
  { key: "flags", label: "운영 설정", path: "/workspace/developer/flags" },
];

export default function DeveloperLayout() {
  return (
    <DomainLayout
      title="지원"
      description="버그 제보, 피드백과 운영 설정"
      tabs={DEVELOPER_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
