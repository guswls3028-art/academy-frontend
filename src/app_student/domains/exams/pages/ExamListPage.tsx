/**
 * 시험 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 상태별 그룹핑된 시험 목록
 * 통계: grades API 기반 시험 성적 분석
 */
import { useState } from "react";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import EmptyState from "@student/layout/EmptyState";
import { IconExam } from "@student/shared/ui/icons/Icons";
import { useStudentExams } from "../hooks/useStudentExams";
import ExamHomeTab from "../components/ExamHomeTab";
import ExamStatsTab from "../components/ExamStatsTab";

const TABS = [
  { key: "home", label: "시험지" },
  { key: "stats", label: "결과 분석" },
];

export default function ExamListPage() {
  const [tab, setTab] = useState("home");
  const { data, isLoading, isError, refetch } = useStudentExams();
  const items = data?.items ?? [];
  const shellTitle = tab === "stats" ? "시험 분석" : "시험 데스크";
  const shellDescription =
    tab === "stats"
      ? "응시 결과와 강좌별 흐름을 한눈에 확인합니다."
      : "응시해야 할 시험과 완료한 시험을 상태별로 정리합니다.";

  return (
    <DomainTabShell
      title={shellTitle}
      eyebrow="평가"
      description={shellDescription}
      icon={<IconExam />}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {isLoading && (
        <div className="stu-skel-stack">
          <div className="stu-skel stu-skel--lg" />
          <div className="stu-skel stu-skel--lg" />
          <div className="stu-skel stu-skel--lg" />
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
