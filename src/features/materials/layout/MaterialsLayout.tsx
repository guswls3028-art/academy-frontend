// PATH: src/features/materials/layout/MaterialsLayout.tsx
// Students UI SSOT — Domain Header + ds-tabs + panel

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const MATERIALS_TABS = [
  { key: "sheets", label: "시험지", path: "/admin/materials/sheets" },
  { key: "reports", label: "성적표", path: "/admin/materials/reports" },
  { key: "messages", label: "메시지", path: "/admin/materials/messages" },
];

export default function MaterialsLayout() {
  return (
    <DomainLayout
      title="자료실"
      description="시험지 · 성적표 · 메시지"
      tabs={MATERIALS_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
