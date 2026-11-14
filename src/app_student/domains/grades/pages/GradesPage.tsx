/**
 * 성적 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 시험 성적 / 과제 현황 목록
 * 통계: 점수 추이, 합격률, 과제 진행 분석
 */
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import EmptyState from "@student/layout/EmptyState";
import { IconGrade } from "@student/shared/ui/icons/Icons";
import { useMyGradesAnalytics } from "../hooks/useMyGradesAnalytics";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import GradesHomeTab from "../components/GradesHomeTab";
import SessionAssessmentTotals from "../components/SessionAssessmentTotals";
import ParentAssessmentComments from "../components/ParentAssessmentComments";
import {
  defaultStudentGradeReportLayout,
  STUDENT_GRADE_REPORT_ANALYTICS_SECTION_IDS,
} from "@/shared/api/contracts/studentGradeReportLayout";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";

const GradesStatsTab = lazy(() => import("../components/GradesStatsTab"));

const TABS = [
  { key: "home", label: "요약" },
  { key: "stats", label: "추이 분석" },
];

export default function GradesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "stats" ? "stats" : "home";
  const setTab = (key: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (key === "stats") next.set("tab", "stats");
      else next.delete("tab");
      return next;
    }, { replace: true });
  };
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
    isFetching: analyticsFetching,
    isFetched: analyticsFetched,
    refetch: refetchAnalytics,
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
      noSearchParam
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
        <ParentAssessmentComments exams={exams} homeworks={homeworks}>
          <SessionAssessmentTotals items={data?.session_totals ?? []} />
          <GradesHomeTab exams={exams} homeworks={homeworks} labels={labels} />
        </ParentAssessmentComments>
      )}

      {!isLoading && !isError && tab === "stats" && (
        <Suspense fallback={<div role="status" aria-label="추이 분석을 불러오는 중"><Skeletons /></div>}>
          <GradesStatsTab
            exams={exams}
            homeworks={homeworks}
            examTrend={examTrend}
            lectureOptions={lectureOptions}
            analytics={analytics}
            analyticsLoading={analyticsLoading && !analyticsFetched}
            analyticsError={analyticsError || (analyticsLoading && analyticsFetched)}
            analyticsFetching={analyticsFetching}
            onRetryAnalytics={() => void refetchAnalytics()}
            reportLayout={reportLayout}
          />
        </Suspense>
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
