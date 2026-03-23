/**
 * ExamDomainLayout
 * 시험 도메인 전역 레이아웃 — DomainLayout SSOT로 탭 제공.
 * 라우트: /admin/exams (강의별 시험), /admin/exams/templates (템플릿 관리)
 */

import { Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/domain";

const EXAM_TABS: DomainTab[] = [
  { key: "by-session", label: "강의별 시험", path: "/admin/exams", exact: true },
  { key: "templates", label: "템플릿 관리", path: "/admin/exams/templates", exact: true },
];

export default function ExamDomainLayout() {
  return (
    <DomainLayout title="시험" tabs={EXAM_TABS}>
      <Outlet />
    </DomainLayout>
  );
}
