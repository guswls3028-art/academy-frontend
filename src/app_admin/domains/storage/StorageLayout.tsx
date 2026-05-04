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
  { key: "hit-reports", label: "적중 보고서", path: "/admin/storage/hit-reports" },
];

export default function StorageLayout() {
  return (
    <DomainLayout
      title="자료 저장소"
      description="시험지·자료 업로드, AI 유사 문제 매치업까지 한 곳에서."
      tabs={STORAGE_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
