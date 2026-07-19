// PATH: src/app_admin/domains/developer/layout/DeveloperLayout.tsx
// To개발자 — DomainLayout 탭 SSOT

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const DEVELOPER_TABS: DomainTab[] = [
  { key: "patchnotes", label: "패치노트", path: "/admin/developer", exact: true },
  { key: "bug", label: "버그 제보", path: "/admin/developer/bug" },
  { key: "feedback", label: "피드백", path: "/admin/developer/feedback" },
  { key: "flags", label: "운영 설정", path: "/admin/developer/flags" },
];

export default function DeveloperLayout() {
  return (
    <DomainLayout
      title="개발자 노트"
      description="운영 릴리스, 버그 제보, 피드백"
      tabs={DEVELOPER_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
