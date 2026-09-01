/**
 * 채점·결과 탭 — 수업 중간 의사결정을 위한 시험 분석 워크스페이스.
 * 제안은 현재 대표 결과에서 계산하며 시험 컷이나 재시험 정책을 자동 변경하지 않는다.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Download,
  FileSpreadsheet,
  Gauge,
  ListChecks,
  Target,
} from "lucide-react";
import api from "@/shared/api/axios";
import type {
  AdminExamResultRow,
  QuestionStat,
} from "@admin/domains/results/types/results.types";
import { useAdminExam } from "../hooks/useAdminExam";
import ExamResultsPanel from "@admin/domains/results/panels/ExamResultsPanel";
import OmrReviewEntry from "@admin/domains/results/components/omr-review/OmrReviewEntry";
import ExamResultExcelImport from "@admin/domains/results/components/ExamResultExcelImport";
import ManualExamGradingGrid from "@admin/domains/results/components/ManualExamGradingGrid";
import { Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
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

type Props = {
  examId: number;
  wrongCompletionOnly?: boolean;
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

export default function ExamResultsViewerPanel({ examId, wrongCompletionOnly = false }: Props) {
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(null);
  const { data: exam } = useAdminExam(examId);
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

  const isLoading = resultsQ.isLoading || statsQ.isLoading;
  const isError = resultsQ.isError;
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
              onClick={() => void resultsQ.refetch()}
            >
              다시 시도
            </Button>
          )}
        />
      </section>
    );
  }

  return (
    <div className={styles.workspace}>
      {exam?.grading_mode !== "written" && (
        <OmrReviewEntry examId={examId} examTitle={exam?.title ?? "시험"} />
      )}
      {exam?.grading_mode !== "choice" && <ManualExamGradingGrid examId={examId} />}
      <ExamResultExcelImport examId={examId} examTitle={exam?.title ?? "시험"} />

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

      <section className={styles.analysisShell} aria-labelledby="exam-analysis-title">
        <header className={styles.analysisHeader}>
          <div className={styles.headingCopy}>
            <span className={styles.eyebrow}>TEACHING BRIEF</span>
            <h2 id="exam-analysis-title">이번 수업에서 바로 결정할 것</h2>
            <p>확정 채점 결과와 석차 기준 1차 점수로 수업 방향·보충·재시험 컷 검토 근거를 모았습니다.</p>
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
                ? "화면의 강의 필터와 관계없이 전체 강의 브리핑·분포·등수·답안을 내려받습니다."
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
            description="점수를 저장하고 채점을 확정하면 수업 브리핑과 보고서가 생성됩니다. 미응시·채점 중·채점 실패 결과는 통계에서 제외됩니다."
          />
        ) : (
          <>
            <div className={styles.decisionGrid}>
              <DecisionCard icon={<BookOpenCheck size={ICON.lg} />} label="수업 방향" {...insight.direction} />
              <DecisionCard icon={<Gauge size={ICON.lg} />} label="컷 검토" {...insight.cutReview} />
              <DecisionCard icon={<ListChecks size={ICON.lg} />} label="바로 할 일" {...insight.nextAction} />
            </div>

            <div className={styles.policyNote}>
              <Target size={ICON.sm} aria-hidden />
              <span>석차 기준 1차 점수로 분석합니다. 보충 완료는 따로 표시하며 컷·재시험 정책을 자동으로 바꾸지 않습니다.</span>
            </div>

            <div className={styles.metricStrip} aria-label="시험 핵심 지표">
              <Metric label="응시" value={`${insight.scoredCount}명`} sub={insight.unscoredCount > 0 ? `미응시·미채점 ${insight.unscoredCount}명` : "전원 집계"} />
              <Metric label="평균" value={`${insight.average.toFixed(1)}점`} sub={`중앙값 ${insight.median.toFixed(1)}점`} />
              <Metric label="상위 10%" value={`${insight.topTenAverage.toFixed(1)}점`} sub={`최고 ${insight.highest.toFixed(1)}점`} />
              <Metric label="표준편차" value={insight.stdDev.toFixed(1)} sub={`만점 대비 ${insight.stdRate.toFixed(1)}%`} />
              <Metric
                label={insight.hasPassCriterion ? `1차 합격 컷 ${cutoffLabel}` : "1차 합격 기준"}
                value={insight.hasPassCriterion ? `${Math.round(insight.passRate * 100)}%` : "기준 미설정"}
                sub={insight.hasPassCriterion
                  ? `합격 ${insight.passCount} · 미달 ${insight.failCount} · 기준 적용 ${insight.passCriterionCount}명 · 보충 완료 ${insight.remediatedCount}`
                  : "시험 설정에서 기준 점수를 입력하세요"}
              />
            </div>

            <div className={styles.evidenceGrid}>
              <section className={styles.evidencePanel} aria-labelledby="distribution-title">
                <div className={styles.panelHeading}>
                  <div>
                    <span>Score distribution</span>
                    <h3 id="distribution-title">점수 분포</h3>
                  </div>
                  <div className={styles.markerLegend}>
                    <span>평균 {insight.average.toFixed(1)}</span>
                    <span>{insight.hasPassCriterion ? `컷 ${cutoffLabel}` : "컷 미설정"}</span>
                  </div>
                </div>
                <div className={styles.histogram} role="img" aria-label="만점 대비 점수 구간별 인원">
                  {insight.distribution.map((band) => (
                    <div className={styles.histogramColumn} key={band.label} title={`${band.label} · ${band.count}명`}>
                      <span className={styles.barCount}>{band.count}</span>
                      <svg className={styles.barTrack} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                        <rect className={styles.barGrid} x="0" y="0" width="100" height="100" rx="5" />
                        <rect
                          className={styles.barFill}
                          x="0"
                          y={100 - Math.max(band.count > 0 ? 12 : 3, band.ratio * 100)}
                          width="100"
                          height={Math.max(band.count > 0 ? 12 : 3, band.ratio * 100)}
                          rx="4"
                        />
                      </svg>
                      <strong>{band.label}</strong>
                      <small>{band.rawRange}</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.evidencePanel} aria-labelledby="priority-title">
                <div className={styles.panelHeading}>
                  <div>
                    <span>Question priority</span>
                    <h3 id="priority-title">보충 우선 문항</h3>
                  </div>
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
                ) : insight.priorityQuestions.length === 0 ? (
                  <EmptyState scope="panel" tone="empty" title="문항별 채점 데이터가 없습니다" />
                ) : (
                  <ol className={styles.priorityList}>
                    {insight.priorityQuestions.slice(0, 5).map((question) => (
                      <li key={question.question_id} data-tone={question.tone}>
                        <span className={styles.questionNumber}>{question.question_number}</span>
                        <div className={styles.questionBody}>
                          <div className={styles.questionTopline}>
                            <strong>{question.action}</strong>
                            <span>{question.accuracyPercent.toFixed(1)}%</span>
                          </div>
                          <svg className={styles.accuracyTrack} viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden>
                            <rect className={styles.accuracyTrackBase} x="0" y="0" width="100" height="4" rx="2" />
                            <rect className={styles.accuracyTrackFill} x="0" y="0" width={question.accuracyPercent} height="4" rx="2" />
                          </svg>
                          <small>{question.correct}/{question.attempts}명 정답 · {question.priority}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            {insight.priorityQuestions.length > 0 && (
              <details className={styles.questionDetails}>
                <summary>전체 문항 통계 보기</summary>
                <div className={styles.tableScroller}>
                  <table>
                    <thead>
                      <tr>
                        <th>문항</th>
                        <th>정답률</th>
                        <th>정답 수</th>
                        <th>응시 수</th>
                        <th>권장 행동</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...insight.priorityQuestions]
                        .sort((left, right) => left.question_number - right.question_number)
                        .map((question) => (
                          <tr key={question.question_id}>
                            <td>{question.question_number}번</td>
                            <td><span data-tone={question.tone}>{question.accuracyPercent.toFixed(1)}%</span></td>
                            <td>{question.correct}</td>
                            <td>{question.attempts}</td>
                            <td>{question.action}</td>
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
  );
}

function DecisionCard({
  icon,
  label,
  title,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  detail: string;
  tone: "positive" | "attention" | "critical" | "neutral";
}) {
  return (
    <article className={styles.decisionCard} data-tone={tone}>
      <div className={styles.decisionIcon} aria-hidden>{icon}</div>
      <div>
        <span>{label}</span>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </article>
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
