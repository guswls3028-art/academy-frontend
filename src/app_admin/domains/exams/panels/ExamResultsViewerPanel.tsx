/**
 * 채점·결과 탭 — 수업 중간 의사결정을 위한 시험 분석 워크스페이스.
 * 제안은 현재 대표 결과에서 계산하며 시험 컷이나 재시험 정책을 자동 변경하지 않는다.
 */

import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import api from "@/shared/api/axios";
import type {
  AdminExamResultRow,
  QuestionStat,
} from "@admin/domains/results/types/results.types";
import { useAdminExam } from "../hooks/useAdminExam";
import { fetchQuestionsByExam } from "../api/question.api";
import { essayIndexFromBoundary, examQuestionLabel } from "@/shared/scoring/examQuestionNumber";
import ExamResultsPanel from "@admin/domains/results/panels/ExamResultsPanel";
import OmrReviewEntry from "@admin/domains/results/components/omr-review/OmrReviewEntry";
import ExamResultExcelImport from "@admin/domains/results/components/ExamResultExcelImport";
import ManualExamGradingGrid, { type ManualExamGradingGridHandle } from "@admin/domains/results/components/ManualExamGradingGrid";
import { adminResultsQueryKeys } from "@admin/domains/results/public/manualExamGrading";
import { Button, EmptyState, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  downloadExamAnalysisExport,
  downloadExamWrongNoteExport,
} from "@admin/domains/results/public/examResultExcel";
import { adminExamsQueryKeys } from "../queryKeys";
import { fetchExamLectureAssignments } from "../api/examLectureAssignments";
import { buildExamResultsInsightModel } from "./examResultsInsights";
import styles from "./ExamResultsViewerPanel.module.css";
import ExamScoreTrends, { type ExamAnalysisInsights } from "./ExamScoreTrends";
import SubjectiveGradingEntry from "./SubjectiveGradingEntry";

type Props = {
  examId: number;
  wrongCompletionOnly?: boolean;
  onOpenSetup?: () => void;
};

async function fetchResults(examId: number, lectureId: number | null): Promise<AdminExamResultRow[]> {
  const response = await api.get(`/results/admin/exams/${examId}/results/`, {
    params: lectureId == null ? undefined : { lecture_id: lectureId },
  });
  const raw = response.data?.results ?? response.data;
  if (!Array.isArray(raw)) throw new Error("시험 결과 응답 형식이 올바르지 않습니다.");
  return raw;
}

async function fetchQuestionStats(examId: number, lectureId: number | null): Promise<QuestionStat[]> {
  const response = await api.get(`/results/admin/exams/${examId}/questions/`, {
    params: lectureId == null ? undefined : { lecture_id: lectureId },
  });
  const raw = response.data?.results ?? response.data;
  if (!Array.isArray(raw)) throw new Error("문항 통계 응답 형식이 올바르지 않습니다.");
  return raw;
}

export default function ExamResultsViewerPanel(props: Props) {
  return <ExamResultsViewerContent key={props.examId} {...props} />;
}

function ExamResultsViewerContent({ examId, wrongCompletionOnly = false, onOpenSetup }: Props) {
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(null);
  const manualGridRef = useRef<ManualExamGradingGridHandle>(null);
  const editingRegionRef = useRef<HTMLDivElement>(null);
  const excelApplying = useIsMutating({ mutationKey: adminResultsQueryKeys.examResultImport(examId) }) > 0;
  const preparingExcelRef = useRef(false);
  const prepareExcelApply = async () => {
    const region = editingRegionRef.current;
    if (!region || preparingExcelRef.current) throw new Error("채점 결과를 처리하고 있습니다. 잠시 후 다시 시도해 주세요.");
    // Lock synchronously, before waiting for an in-flight correctness save.
    region.inert = true;
    preparingExcelRef.current = true;
    const release = () => {
      region.inert = false;
      preparingExcelRef.current = false;
    };
    try {
      if (manualGridRef.current && !(await manualGridRef.current.flushBeforeExternalUpdate())) {
        throw new Error("수동 채점 입력을 보존했습니다. 빈칸·저장 실패를 해결하거나 성적 확정을 마치고 열린 편집창을 닫은 뒤 엑셀을 다시 반영해 주세요.");
      }
      return release;
    } catch (error) {
      release();
      throw error;
    }
  };
  const gradingEntryRef = useRef<HTMLDivElement>(null);
  const statisticsRef = useRef<HTMLDetailsElement>(null);
  const analysisRef = useRef<HTMLElement>(null);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const jumpTo = (element: HTMLElement | null) => {
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const { data: exam } = useAdminExam(examId);
  const usesSeparateEssayNumbering = exam?.essay_numbering === "separate";
  const questionKindsQ = useQuery({
    queryKey: adminExamsQueryKeys.examQuestions(examId),
    queryFn: () => fetchQuestionsByExam(examId).then((response) => response.data),
    enabled: usesSeparateEssayNumbering,
  });
  const essayIndexes = useMemo(() => {
    const indexes = new Map<number, number>();
    (questionKindsQ.data ?? [])
      .filter((question) => question.question_kind === "essay")
      .sort((left, right) => left.number - right.number)
      .forEach((question, index) => indexes.set(question.number, index + 1));
    return indexes;
  }, [questionKindsQ.data]);
  const questionLabel = useCallback((number: number) => examQuestionLabel(
    number, exam?.essay_numbering,
    essayIndexes.get(number) ?? essayIndexFromBoundary(number, exam?.grading_mode, exam?.choice_question_count),
  ), [essayIndexes, exam?.essay_numbering, exam?.grading_mode, exam?.choice_question_count]);
  const assignmentsQ = useQuery({
    queryKey: adminExamsQueryKeys.examLectureAssignments(examId),
    queryFn: () => fetchExamLectureAssignments(examId),
    enabled: Number.isFinite(examId),
  });
  const resultsQ = useQuery({
    queryKey: adminExamsQueryKeys.adminExamResults(examId, selectedLectureId),
    queryFn: () => fetchResults(examId, selectedLectureId),
    enabled: Number.isFinite(examId),
  });
  const statsQ = useQuery({
    queryKey: adminExamsQueryKeys.examQuestionStats(examId, selectedLectureId),
    queryFn: () => fetchQuestionStats(examId, selectedLectureId),
    enabled: Number.isFinite(examId),
  });

  const results = useMemo(() => resultsQ.data ?? [], [resultsQ.data]);
  const questionStats = useMemo(() => statsQ.data ?? [], [statsQ.data]);
  const resultMaxScore = results.find((row) => typeof row.exam_max_score === "number")?.exam_max_score;
  const examMaxScore = typeof exam?.max_score === "number" && exam.max_score > 0
    ? exam.max_score
    : typeof resultMaxScore === "number" && resultMaxScore > 0
      ? resultMaxScore
      : 100;
  const assignments = assignmentsQ.data?.assignments ?? [];
  const selectedAssignment = assignments.find(
    (assignment) => assignment.lecture_id === selectedLectureId,
  );
  const passScore = selectedAssignment?.pass_score
    ?? (typeof exam?.pass_score === "number" ? exam.pass_score : 0);
  const hasMixedCutoffs = new Set(
    assignments.map((assignment) => assignment.pass_score),
  ).size > 1;
  const mixedCutoffs = selectedLectureId == null && hasMixedCutoffs;
  const scopeName = selectedAssignment?.lecture_title ?? "전체 강의";
  const cutoffLabel = mixedCutoffs ? "강의별 기준" : `${passScore}점`;
  const insight = useMemo(
    () => buildExamResultsInsightModel({
      results,
      questionStats,
      maxScore: examMaxScore,
      passScore,
    }),
    [examMaxScore, passScore, questionStats, results],
  );
  const hasData = insight.scoredCount > 0;
  const largestBandCount = Math.max(1, ...insight.distribution.map(({ count }) => count));
  const analysisQ = useQuery({
    queryKey: adminExamsQueryKeys.examAnalysisInsights(examId, selectedLectureId),
    queryFn: async () => {
      const response = await api.get<ExamAnalysisInsights>(`/results/admin/exams/${examId}/analysis-insights/`, {
        params: selectedLectureId == null ? undefined : { lecture_id: selectedLectureId },
      });
      if (!Array.isArray(response.data?.trends)) {
        throw new Error("시험 성적 분석 응답 형식이 올바르지 않습니다.");
      }
      return response.data;
    },
    enabled: hasData,
  });
  const recommendedPassScore = analysisQ.isError ? null : analysisQ.data?.recommended_cutoff;
  const pendingQuestionInsight = {
    title: statsQ.isError ? "문항 통계 확인 필요" : "문항 통계 확인 중",
    detail: statsQ.isError ? "문항별 정답률에서 다시 시도할 수 있습니다." : "통계를 불러오면 분석을 표시합니다.",
    tone: "neutral" as const,
  };

  const analysisExport = useMutation({
    mutationFn: () => downloadExamAnalysisExport(examId, exam?.title ?? "시험"),
    onSuccess: () => feedback.success("수업 분석 리포트를 내려받았습니다."),
    onError: (error) => feedback.error(
      extractApiError(error, "수업 분석 리포트를 내려받지 못했습니다."),
    ),
  });
  const wrongNoteExport = useMutation({
    mutationFn: () => downloadExamWrongNoteExport(examId, exam?.title ?? "시험"),
    onSuccess: () => feedback.success("학생별 오답 엑셀을 내려받았습니다."),
    onError: (error) => feedback.error(
      extractApiError(error, "학생별 오답 엑셀을 내려받지 못했습니다."),
    ),
  });

  // Separate numbering needs the shared question query before rendering results.
  const isLoading = resultsQ.isLoading || (usesSeparateEssayNumbering && questionKindsQ.isLoading);
  const isError = resultsQ.isError || (usesSeparateEssayNumbering && questionKindsQ.isError);
  if (isLoading) {
    return (
      <section className={styles.statePanel}>
        <EmptyState scope="panel" tone="loading" title="채점 결과를 불러오는 중…" />
      </section>
    );
  }
  if (isError) {
    return (
      <section className={styles.statePanel}>
        <EmptyState
          scope="panel"
          tone="error"
          title="채점 결과를 불러오지 못했습니다."
          actions={(
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => {
                void resultsQ.refetch();
                if (usesSeparateEssayNumbering) void questionKindsQ.refetch();
              }}
            >
              다시 시도
            </Button>
          )}
        />
      </section>
    );
  }

  return (
    <>
      {excelApplying && <p role="status">수동 채점 저장과 엑셀 반영을 마칠 때까지 채점표 편집을 잠시 기다려 주세요.</p>}
      <div ref={editingRegionRef} className={styles.workspace} inert={excelApplying} aria-busy={excelApplying}>
      {exam && (
        <SubjectiveGradingEntry
          key={examId}
          exam={exam}
          onEnter={() => jumpTo(gradingEntryRef.current)}
          onStatistics={() => { setStatisticsOpen(true); jumpTo(statisticsRef.current ?? analysisRef.current); }}
          onOpenSetup={onOpenSetup}
        />
      )}
      {exam?.grading_mode !== "written" && (
        <OmrReviewEntry examId={examId} examTitle={exam?.title ?? "시험"} />
      )}
      {exam?.grading_mode !== "choice" && (
        <div ref={gradingEntryRef} tabIndex={-1} className={styles.jumpTarget}>
          <ManualExamGradingGrid ref={manualGridRef} examId={examId} showUnavailableState />
        </div>
      )}
      <ExamResultExcelImport examId={examId} examTitle={exam?.title ?? "시험"} beforeApply={prepareExcelApply} />

      <section className={styles.scopePanel} aria-labelledby="exam-result-scope-title">
        <div className={styles.scopeHeading}>
          <div>
            <span>RESULT SCOPE</span>
            <h2 id="exam-result-scope-title">어느 강의 성적을 볼까요?</h2>
          </div>
          <p><b>{scopeName}</b> · {cutoffLabel}</p>
        </div>
        <div className={styles.scopeRail} role="group" aria-label="성적 조회 강의 필터">
          <button
            type="button"
            aria-pressed={selectedLectureId == null}
            onClick={() => setSelectedLectureId(null)}
          >
            <span>전체 성적</span>
            <strong>{assignmentsQ.data?.total_selected_count ?? results.length}명</strong>
            <small>{hasMixedCutoffs ? "강의별 컷 적용" : `${assignments[0]?.pass_score ?? passScore}점 기준`}</small>
          </button>
          {assignments.map((assignment) => (
            <button
              key={assignment.lecture_id}
              type="button"
              aria-pressed={selectedLectureId === assignment.lecture_id}
              style={{ "--scope-color": assignment.lecture_color || "var(--color-primary)" } as CSSProperties}
              onClick={() => setSelectedLectureId(assignment.lecture_id)}
            >
              <span>{assignment.lecture_title}</span>
              <strong>{assignment.selected_count}명</strong>
              <small>귀가 기준 {assignment.pass_score}점</small>
            </button>
          ))}
        </div>
      </section>

      <section ref={analysisRef} tabIndex={-1} className={`${styles.analysisShell} ${styles.jumpTarget}`} aria-labelledby="exam-analysis-title">
        <header className={styles.analysisHeader}>
          <div className={styles.headingCopy}>
            <h2 id="exam-analysis-title">시험 성적 분석</h2>
            <p>확정된 석차 기준 1차 점수로 집계합니다.</p>
          </div>
          <div className={styles.reportActions}>
            <Button
              type="button"
              intent="primary"
              size="sm"
              leftIcon={<FileSpreadsheet size={ICON_FOR_BUTTON.sm} />}
              loading={analysisExport.isPending}
              disabled={!hasData}
              title={hasData
                ? "화면의 강의 필터와 관계없이 전체 강의 분포·성적 변화·등수·답안을 내려받습니다."
                : "채점 결과가 저장되면 내려받을 수 있습니다."}
              onClick={() => analysisExport.mutate()}
            >
              {assignments.length > 1 ? "전체 강의 분석 리포트" : "수업 분석 리포트"} (엑셀)
            </Button>
            <Button
              type="button"
              intent="secondary"
              size="sm"
              leftIcon={<Download size={ICON_FOR_BUTTON.sm} />}
              loading={wrongNoteExport.isPending}
              disabled={!hasData}
              title={hasData
                ? "화면의 강의 필터와 관계없이 전체 강의의 현재 오답과 복습 지정 문항을 내려받습니다."
                : "채점 결과가 저장되면 내려받을 수 있습니다."}
              onClick={() => wrongNoteExport.mutate()}
            >
              {assignments.length > 1 ? "전체 강의 틀린 문항" : "학생별 틀린 문항"} (엑셀)
            </Button>
          </div>
        </header>

        {!hasData ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title="아직 분석할 확정 채점 결과가 없습니다"
            description="점수를 저장하고 채점을 확정하면 성적 분석과 보고서를 볼 수 있습니다. 미응시·채점 중·채점 실패 결과는 통계에서 제외됩니다."
          />
        ) : (
          <>
            <div className={styles.metricStrip} aria-label="시험 핵심 지표">
              <Metric label="응시" value={`${insight.scoredCount}명`} sub={insight.unscoredCount > 0 ? `미응시·미채점 ${insight.unscoredCount}명` : "전원 집계"} />
              <Metric label="평균" value={`${insight.average.toFixed(1)}점`} sub={`중앙값 ${insight.median.toFixed(1)}점`} />
              <Metric label="상위 10%" value={`${insight.topTenAverage.toFixed(1)}점`} sub={`최고 ${insight.highest.toFixed(1)}점`} />
              <Metric label="표준편차" value={insight.stdDev.toFixed(1)} sub={`만점 대비 ${insight.stdRate.toFixed(1)}%`} />
              <Metric
                label="추천 합격 컷"
                value={recommendedPassScore == null ? "—" : `${recommendedPassScore}점`}
                sub={analysisQ.isLoading ? "불러오는 중"
                  : analysisQ.isError ? "성적 변화에서 다시 시도"
                  : "평균을 5점 단위로 반올림 · 참고용"}
              />
              <Metric
                label={insight.hasPassCriterion ? `1차 합격 컷 ${cutoffLabel}` : "1차 합격 기준"}
                value={insight.hasPassCriterion ? `${Math.round(insight.passRate * 100)}%` : "기준 미설정"}
                sub={insight.hasPassCriterion
                  ? `합격 ${insight.passCount} · 미달 ${insight.failCount} · 기준 적용 ${insight.passCriterionCount}명 · 보충 완료 ${insight.remediatedCount}`
                  : "시험 설정의 합격 컷"}
              />
            </div>

            <div className={styles.evidenceGrid}>
              <section className={styles.evidencePanel} aria-labelledby="distribution-title">
                <div className={styles.panelHeading}>
                  <h3 id="distribution-title">점수 분포</h3>
                  <small>만점 {examMaxScore}점 대비 득점률</small>
                </div>
                <ul className={styles.histogram} aria-label="득점률 구간별 인원">
                  {insight.distribution.map((band) => (
                    <li className={styles.histogramColumn} key={band.label}>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ height: `${(band.count / largestBandCount) * 100}%` }}
                        >
                          <span className={styles.barCount}>{band.count}명</span>
                        </div>
                      </div>
                      <strong>{band.label}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.evidencePanel} aria-labelledby="priority-title">
                <div className={styles.panelHeading}>
                  <h3 id="priority-title">문항별 정답률</h3>
                  <small>정답률 낮은 순</small>
                </div>
                {statsQ.isLoading ? (
                  <EmptyState scope="panel" tone="loading" title="문항 통계를 불러오는 중…" />
                ) : statsQ.isError ? (
                  <EmptyState
                    scope="panel"
                    tone="error"
                    title="문항 통계를 불러오지 못했습니다."
                    actions={<Button type="button" intent="secondary" size="sm" onClick={() => void statsQ.refetch()}>다시 시도</Button>}
                  />
                ) : insight.questionAccuracy.length === 0 ? (
                  <EmptyState scope="panel" tone="empty" title="문항별 채점 데이터가 없습니다" />
                ) : (
                  <ol className={styles.priorityList}>
                    {insight.questionAccuracy.slice(0, 5).map((question) => (
                      <li key={question.question_id}>
                        <span className={styles.questionNumber}>{questionLabel(question.question_number)}</span>
                        <div className={styles.questionBody}>
                          <div className={styles.questionTopline}>
                            <strong>정답률</strong>
                            <span>{question.accuracyPercent.toFixed(1)}%</span>
                          </div>
                          <svg className={styles.accuracyTrack} viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden>
                            <rect className={styles.accuracyTrackBase} x="0" y="0" width="100" height="4" rx="2" />
                            <rect className={styles.accuracyTrackFill} x="0" y="0" width={question.accuracyPercent} height="4" rx="2" />
                          </svg>
                          <small>{question.attempts}명 중 {question.correct}명 정답</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <ExamScoreTrends
              data={analysisQ.data}
              loading={analysisQ.isLoading}
              error={analysisQ.isError}
              onRetry={() => void analysisQ.refetch()}
            />

            {insight.questionAccuracy.length > 0 && (
              <details ref={statisticsRef} tabIndex={-1} className={`${styles.questionDetails} ${styles.jumpTarget}`} open={statisticsOpen} onToggle={(event) => setStatisticsOpen(event.currentTarget.open)}>
                <summary>전체 문항 통계 보기</summary>
                <p className={styles.statisticsNote}>주관식·서술형도 포함됩니다. 정답률은 만점을 받은 비율이며, 부분점수는 평균 득점에 반영됩니다.</p>
                <div className={styles.tableScroller}>
                  <table>
                    <thead>
                      <tr>
                        <th>문항</th>
                        <th>정답률</th>
                        <th>평균 득점</th>
                        <th>정답 수</th>
                        <th>응시 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...insight.questionAccuracy]
                        .sort((left, right) => left.question_number - right.question_number)
                        .map((question) => (
                          <tr key={question.question_id}>
                            <td>{questionLabel(question.question_number)}</td>
                            <td>{question.accuracyPercent.toFixed(1)}%</td>
                            <td>{question.avg_score.toFixed(1)}점</td>
                            <td>{question.correct}</td>
                            <td>{question.attempts}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section className={styles.studentResultsSection}>
        <div className={styles.sectionHeading}>
          <span>Student evidence</span>
          <h2>학생별 결과</h2>
          <p>학생을 선택하면 상세 채점 결과와 오답 확인 상태를 볼 수 있습니다.</p>
        </div>
        <ExamResultsPanel
          key={`${examId}:${selectedLectureId ?? "all"}`}
          examId={examId}
          lectureId={selectedLectureId}
          wrongCompletionOnly={wrongCompletionOnly}
        />
      </section>
      </div>
    </>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
