/**
 * 성적 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 시험 성적 / 과제 현황 목록
 * 통계: 점수 추이, 합격률, 과제 진행 분석
 */
import { useState } from "react";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import EmptyState from "@student/layout/EmptyState";
import { IconGrade } from "@student/shared/ui/icons/Icons";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import GradesHomeTab from "../components/GradesHomeTab";
import GradesStatsTab from "../components/GradesStatsTab";

const TABS = [
  { key: "home", label: "요약" },
  { key: "stats", label: "추이 분석" },
];

export default function GradesPage() {
  const [tab, setTab] = useState("home");
  const { data, isLoading, isError, refetch } = useMyGradesSummary();
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];
  const labels = data?.labels;
  const shellTitle = tab === "stats" ? "성장 그래프" : "성적 보드";
  const shellDescription =
    tab === "stats"
      ? "시험과 과제 결과가 어떤 방향으로 움직이는지 확인합니다."
      : "최근 시험, 과제, 통과 여부를 학생 기준으로 정리합니다.";

  return (
    <DomainTabShell
      title={shellTitle}
      eyebrow="학습 결과"
      description={shellDescription}
      icon={<IconGrade />}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {isLoading && <Skeletons />}

      {isError && (
        <EmptyState
          title="성적을 불러올 수 없습니다."
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && tab === "home" && (
        <GradesHomeTab exams={exams} homeworks={homeworks} labels={labels} />
      )}

      {!isLoading && !isError && tab === "stats" && (
        <GradesStatsTab exams={exams} homeworks={homeworks} />
      )}
    </DomainTabShell>
  );
}

function Skeletons() {
  return (
    <div className="stu-skel-stack">
      <div className="stu-skel stu-skel--xs" />
      <div className="stu-skel-grid-3">
        <div className="stu-skel stu-skel--md" />
        <div className="stu-skel stu-skel--md" />
        <div className="stu-skel stu-skel--md" />
      </div>
      <div className="stu-skel stu-skel--xl" />
      <div className="stu-skel stu-skel--lg" />
    </div>
  );
}
