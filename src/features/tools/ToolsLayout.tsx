// PATH: src/features/tools/ToolsLayout.tsx
// 도구 레이아웃 — 탭 네비게이션 (PPT, PDF 등 확장 가능)

import { Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/layout";

const TOOLS_TABS: DomainTab[] = [
  { key: "ppt", label: "PPT 생성", path: "/admin/tools/ppt" },
  { key: "omr", label: "OMR 생성", path: "/admin/tools/omr" },
  { key: "clinic", label: "클리닉 대상자", path: "/admin/tools/clinic" },
];

export default function ToolsLayout() {
  return (
    <DomainLayout
      title="도구"
      description="수업 준비 및 학원 운영 자동화 도구"
      tabs={TOOLS_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
