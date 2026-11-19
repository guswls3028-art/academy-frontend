// PATH: src/app_admin/domains/lectures/layout/LecturesLayout.tsx
import { Outlet } from "react-router";
import { resolveTenantCodeString } from "@/shared/tenant";
import { DomainLayout } from "@/shared/ui/layout";

const LECTURES_TABS = [
  { key: "list", label: "강의목록", path: "/workspace/lectures", exact: true },
  { key: "past", label: "지난강의", path: "/workspace/lectures/past" },
];

export default function LecturesLayout() {
  return (
    <DomainLayout
      title="강의 관리"
      description="강의 목록 · 지난 강의 · 수강생 · 출결 · 리포트"
      tabs={resolveTenantCodeString() === "dawon" ? [{ ...LECTURES_TABS[0], label: "반별 강의" }, LECTURES_TABS[1]] : LECTURES_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
