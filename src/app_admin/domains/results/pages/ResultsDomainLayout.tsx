/**
 * ResultsDomainLayout
 * 성적 도메인 전역 레이아웃 — DomainLayout SSOT로 탭 제공.
 * 라우트: /admin/results (오늘의 작업), /admin/results/tree (강의별 탐색),
 *        /admin/results/submissions (제출함)
 */

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const RESULTS_TABS: DomainTab[] = [
  { key: "inbox", label: "오늘의 작업", path: "/admin/results", exact: true },
  { key: "tree", label: "강의별 탐색", path: "/admin/results/tree", exact: true },
  { key: "submissions", label: "제출함", path: "/admin/results/submissions", exact: true },
];

export default function ResultsDomainLayout() {
  return (
    <DomainLayout title="성적" tabs={RESULTS_TABS}>
      <Outlet />
    </DomainLayout>
  );
}
