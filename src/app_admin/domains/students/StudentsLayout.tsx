// PATH: src/app_admin/domains/students/StudentsLayout.tsx
import { Outlet } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";

const STUDENTS_TABS = [
  { key: "home", label: "홈", path: "/workspace/students/home" },
  { key: "requests", label: "가입신청", path: "/workspace/students/requests" },
  { key: "deleted", label: "삭제된 학생", path: "/workspace/students/deleted" },
];

export default function StudentsLayout() {
  return (
    <DomainLayout
      title="학생 관리"
      description="학생 추가 · 학교 성적 · 상담"
      tabs={STUDENTS_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
