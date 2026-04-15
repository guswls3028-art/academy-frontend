/**
 * 시험 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 상태별 그룹핑된 시험 목록
 * 통계: grades API 기반 시험 성적 분석
 */
import { useState } from "react";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import EmptyState from "@student/layout/EmptyState";
import { useStudentExams } from "../hooks/useStudentExams";
import ExamHomeTab from "../components/ExamHomeTab";
import ExamStatsTab from "../components/ExamStatsTab";

const TABS = [
  { key: "home", label: "홈" },
  { key: "stats", label: "통계" },
];

export default function ExamListPage() {
  const [tab, setTab] = useState("home");
  const { data, isLoading, isError, refetch } = useStudentExams();
  const items = data?.items ?? [];

  return (
    <DomainTabShell title="시험" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
        </div>
      )}

      {isError && (
        <EmptyState
          title="시험을 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 잠시 후 다시 시도해 주세요."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && tab === "home" && (
        <ExamHomeTab items={items} />
      )}

      {!isLoading && !isError && tab === "stats" && (
        <ExamStatsTab />
      )}
    </DomainTabShell>
  );
}
