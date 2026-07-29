// PATH: src/app_admin/domains/tools/ToolsLayout.tsx
// 도구 레이아웃 — 탭 네비게이션 (PPT, PDF 등 확장 가능)

import { Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/layout";

const TOOLS_TABS: DomainTab[] = [
  { key: "problem-studio", label: "AI 시험지 타이핑", path: "/workspace/tools/problem-studio" },
  { key: "ppt", label: "PPT 생성", path: "/workspace/tools/ppt" },
  { key: "omr", label: "OMR 생성", path: "/workspace/tools/omr" },
  { key: "clinic", label: "클리닉 대상자", path: "/workspace/tools/clinic" },
  { key: "stopwatch", label: "타이머", path: "/workspace/tools/stopwatch" },
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
