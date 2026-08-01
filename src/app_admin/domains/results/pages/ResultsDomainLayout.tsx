/**
 * ResultsDomainLayout
 * 성적 도메인 전역 레이아웃 — DomainLayout SSOT로 탭 제공.
 * 라우트: /workspace/results (성적 콘솔), /workspace/results/tree (강의별 탐색),
 *        /workspace/results/submissions (제출함)
 */

import { Outlet } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const RESULTS_TABS: DomainTab[] = [
  { key: "inbox", label: "성적 콘솔", path: "/workspace/results", exact: true },
  { key: "tree", label: "강의별 탐색", path: "/workspace/results/tree", exact: true },
  { key: "submissions", label: "제출함", path: "/workspace/results/submissions", exact: true },
];

export default function ResultsDomainLayout() {
  return (
    <DomainLayout title="성적" tabs={RESULTS_TABS}>
      <Outlet />
    </DomainLayout>
  );
}
