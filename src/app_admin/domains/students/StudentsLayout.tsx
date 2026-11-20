// PATH: src/app_admin/domains/students/StudentsLayout.tsx
import { Outlet, useLocation } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";
import { dawonStaffPreviewRole } from "@/shared/product/dawon/staffPreview";
import { resolveTenantCodeString } from "@/shared/tenant";

const STUDENTS_TABS = [
  { key: "home", label: "홈", path: "/workspace/students/home" },
  { key: "surveys", label: "설문·성적 취합", path: "/workspace/students/surveys" },
  { key: "requests", label: "가입신청", path: "/workspace/students/requests" },
  { key: "deleted", label: "삭제된 학생", path: "/workspace/students/deleted" },
];

export default function StudentsLayout() {
  const {pathname} = useLocation();
  if (dawonStaffPreviewRole() === "teacher" && ["/workspace/students/home", "/workspace/students/class-groups"].includes(pathname)) return <Outlet />;
  const tabs = resolveTenantCodeString() === "dawon"
    ? [STUDENTS_TABS[0], { key: "class-groups", label: "반 편성", path: "/workspace/students/class-groups" }, ...STUDENTS_TABS.slice(1)]
    : STUDENTS_TABS;
  return (
    <DomainLayout
      title="학생 관리"
      description="학생 추가 · 학교 성적 · 상담"
      tabs={tabs}
    >
      <Outlet />
    </DomainLayout>
  );
}
