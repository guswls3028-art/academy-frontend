// PATH: src/features/storage/layout/StorageLayout.tsx
// 저장소 — DomainLayout 탭 SSOT

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";
import QuotaIndicator from "../components/QuotaIndicator";

const STORAGE_TABS: DomainTab[] = [
  { key: "mine", label: "내 저장소(선생님)", path: "/admin/storage", exact: true },
  { key: "students", label: "학생 인벤토리 관리", path: "/admin/storage/students" },
];

export default function StorageLayout() {
  return (
    <DomainLayout
      title="저장소"
      description="선생님 파일과 학생 인벤토리를 통합 관리합니다."
      tabs={STORAGE_TABS}
    >
      <div style={{ flexShrink: 0, marginBottom: "var(--space-3)" }}>
        <QuotaIndicator />
      </div>
      <Outlet />
    </DomainLayout>
  );
}
