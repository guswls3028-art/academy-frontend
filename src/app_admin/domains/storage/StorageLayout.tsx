// PATH: src/app_admin/domains/storage/StorageLayout.tsx
// 자료실 — DomainLayout 탭 SSOT (매치업 + 저장소)

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const STORAGE_TABS: DomainTab[] = [
  { key: "matchup", label: "매치업", path: "/admin/storage/matchup" },
  {
    key: "files",
    label: "저장소",
    path: "/admin/storage/files",
    activePaths: ["/admin/storage/files", "/admin/storage/students"],
  },
];

export default function StorageLayout() {
  return (
    <DomainLayout
      title="AI · 저장소"
      description="AI 유사 문제 추천과 파일 저장소를 관리합니다."
      tabs={STORAGE_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
