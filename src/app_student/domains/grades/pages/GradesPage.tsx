/**
 * 성적 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 시험 성적 / 과제 현황 목록
 * 통계: 점수 추이, 합격률, 과제 진행 분석
 */
import { useState } from "react";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import EmptyState from "@student/layout/EmptyState";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import GradesHomeTab from "../components/GradesHomeTab";
import GradesStatsTab from "../components/GradesStatsTab";

const TABS = [
  { key: "home", label: "홈" },
  { key: "stats", label: "통계" },
];

export default function GradesPage() {
  const [tab, setTab] = useState("home");
  const { data, isLoading, isError, refetch } = useMyGradesSummary();
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];

  return (
    <DomainTabShell title="성적" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {isLoading && <Skeletons />}

      {isError && (
        <EmptyState
          title="성적을 불러올 수 없습니다."
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && tab === "home" && (
        <GradesHomeTab exams={exams} homeworks={homeworks} />
      )}

      {!isLoading && !isError && tab === "stats" && (
        <GradesStatsTab exams={exams} homeworks={homeworks} />
      )}
    </DomainTabShell>
  );
}

function Skeletons() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
      <div className="stu-skel" style={{ height: 44, borderRadius: "var(--stu-radius)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--stu-space-4)" }}>
        <div className="stu-skel" style={{ height: 68, borderRadius: "var(--stu-radius)" }} />
        <div className="stu-skel" style={{ height: 68, borderRadius: "var(--stu-radius)" }} />
        <div className="stu-skel" style={{ height: 68, borderRadius: "var(--stu-radius)" }} />
      </div>
      <div className="stu-skel" style={{ height: 160, borderRadius: "var(--stu-radius)" }} />
      <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
    </div>
  );
}
