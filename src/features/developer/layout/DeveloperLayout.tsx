// PATH: src/features/developer/layout/DeveloperLayout.tsx
// To개발자 — DomainLayout 탭 SSOT

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const DEVELOPER_TABS: DomainTab[] = [
  { key: "patchnotes", label: "패치노트", path: "/admin/developer", exact: true },
  { key: "bug", label: "버그 제보", path: "/admin/developer/bug" },
  { key: "feedback", label: "피드백", path: "/admin/developer/feedback" },
];

export default function DeveloperLayout() {
  return (
    <DomainLayout
      title="To개발자"
      description="패치노트, 버그 제보, 피드백"
      tabs={DEVELOPER_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
