// PATH: src/features/lectures/layout/LecturesLayout.tsx
import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const LECTURES_TABS = [
  { key: "list", label: "강의목록", path: "/admin/lectures", exact: true },
  { key: "past", label: "지난강의", path: "/admin/lectures/past" },
];

export default function LecturesLayout() {
  return (
    <DomainLayout
      title="강의 관리"
      description="강의 목록 · 지난 강의 · 수강생 · 출결 · 리포트"
      tabs={LECTURES_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
