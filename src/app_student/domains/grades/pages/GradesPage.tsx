/**
 * 성적 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 시험 성적 / 과제 현황 목록
 * 통계: 점수 추이, 합격률, 과제 진행 분석
 */
import { useState } from "react";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import EmptyState from "@student/layout/EmptyState";
import { IconGrade } from "@student/shared/ui/icons/Icons";
import { useMyGradesAnalytics } from "../hooks/useMyGradesAnalytics";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import GradesHomeTab from "../components/GradesHomeTab";
import GradesStatsTab from "../components/GradesStatsTab";
import {
  defaultStudentGradeReportLayout,
  STUDENT_GRADE_REPORT_ANALYTICS_SECTION_IDS,
} from "@/shared/api/contracts/studentGradeReportLayout";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";

const TABS = [
  { key: "home", label: "요약" },
  { key: "stats", label: "추이 분석" },
];

export default function GradesPage() {
  const [tab, setTab] = useState("home");
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const { data, isLoading, isError, refetch } = useMyGradesSummary();
  const reportLayout = data?.report_layout ?? defaultStudentGradeReportLayout();
  const hasVisibleAnalytics = reportLayout.sections.some(
    (section) => section.visible && STUDENT_GRADE_REPORT_ANALYTICS_SECTION_IDS.includes(section.id),
  );
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
  } = useMyGradesAnalytics({
    enabled: tab === "stats" && !isLoading && !isError && hasVisibleAnalytics,
  });
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];
  const examTrend = data?.exam_trend ?? [];
  const lectureOptions = data?.lecture_options ?? [];
  const labels = data?.labels;
  const shellTitle = tab === "stats" ? "성장 그래프" : "성적 보드";
  const shellDescription =
    tab === "stats"
      ? "시험과 과제 결과가 어떤 방향으로 움직이는지 확인합니다."
      : wrongCompletionOnly
        ? "최근 시험의 오답 완료 여부와 과제 현황을 학생 기준으로 정리합니다."
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
        <GradesStatsTab
          exams={exams}
          homeworks={homeworks}
          examTrend={examTrend}
          lectureOptions={lectureOptions}
          analytics={analytics}
          analyticsLoading={analyticsLoading}
          analyticsError={analyticsError}
          reportLayout={reportLayout}
        />
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
