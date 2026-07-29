/**
 * ExamDomainLayout
 * 시험 도메인 전역 레이아웃 — DomainLayout SSOT로 탭 제공.
 * 라우트: /workspace/exams (강의별 시험), /workspace/exams/templates (템플릿 관리)
 */

import { Outlet } from "react-router-dom";
import { DomainLayout, type DomainTab } from "@/shared/ui/domain";

const EXAM_TABS: DomainTab[] = [
  { key: "by-session", label: "강의별 시험", path: "/workspace/exams", exact: true },
  { key: "templates", label: "템플릿 관리", path: "/workspace/exams/templates", exact: true },
  { key: "bundles", label: "시험 묶음", path: "/workspace/exams/bundles", exact: true },
];

export default function ExamDomainLayout() {
  return (
    <DomainLayout title="시험" tabs={EXAM_TABS}>
      <Outlet />
    </DomainLayout>
  );
}
