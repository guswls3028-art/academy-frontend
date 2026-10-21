/**
 * 강좌별 시험 성적 그룹 — GradesPage에서 추출
 */
import { Link } from "react-router";
import { ParentAssessmentComment } from "./ParentAssessmentComments";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
import { Badge } from "@/shared/ui/ds";
import { useWrongCompletionDisplay, wrongCompletionLabel } from "@/shared/scoring/assessmentStatusDisplay";
import { essayIndexFromBoundary, examQuestionLabel } from "@/shared/scoring/examQuestionNumber";
import GradeBadge from "./GradeBadge";
import type { MyExamGradeSummary } from "../api/grades.api";
import styles from "./LectureGradeGroup.module.css";

export type ExamGroup = {
  key: string;
  label: string;
  exams: MyExamGradeSummary[];
  /** 평균 백분율. null이면 표시 생략 (시간순 정렬 등 그룹 의미가 약한 경우) */
  avgPct: number | null;
};

function fmtScore(total: number | null, max: number): string {
  if (total == null) return "미응시";
  if (max <= 0) return `${total}점`;
  return `${total}/${max}점`;
}

function examScoreLabel(exam: MyExamGradeSummary): string {
  if (exam.grading_status === "subjective_pending") return "채점 진행 중";
  if (exam.is_provisional) return "채점 확인 중";
  return fmtScore(exam.total_score, exam.max_score);
}

function wrongPreview(exam: MyExamGradeSummary): string {
  const numbers = exam.wrong_question_numbers;
  if (!Array.isArray(numbers) || numbers.length === 0) return "";
  const shown = numbers.slice(0, 6).map((number) => examQuestionLabel(
    number, exam.essay_numbering,
    essayIndexFromBoundary(number, exam.grading_mode, exam.choice_question_count),
  )).join(", ");
  return numbers.length > 6 ? `${shown} 외 ${numbers.length - 6}` : shown;
}

export default function LectureExamGroup({ group, labels }: { group: ExamGroup; labels?: { pass?: string; fail?: string } }) {
  const wrongCompletionOnly = useWrongCompletionDisplay();
  return (
    <div>
      <LectureGroupHeader label={group.label} count={group.exams.length} avgPct={group.avgPct} />
      <div className={styles.list}>
        {group.exams.map((e) => {
          const subjectivePending = e.grading_status === "subjective_pending";
          const provisional = subjectivePending || e.is_provisional === true;
          const hasQuestionAnalysis = Number(e.total_questions ?? 0) > 0
            && e.meta_status !== "NOT_SUBMITTED"
            && !provisional;
          const wrongCount = Number(e.wrong_count ?? 0);
          const wrongNumbers = wrongPreview(e);
          const correction = provisional ? null : wrongCompletionOnly
            ? {
                label: wrongCompletionLabel(e.correction_status),
                tone: e.correction_status == null
                  ? "muted" as const
                  : e.correction_status === "PENDING"
                    ? "danger" as const
                    : "success" as const,
              }
            : e.correction_status === "COMPLETED"
            ? { label: "오답 완료", tone: "success" as const }
            : e.correction_status === "PENDING"
              ? { label: "오답 미완료", tone: "danger" as const }
              : null;

          return (
            <div key={e.exam_id}>
            <Link
              key={e.exam_id}
              to={`/student/exams/${e.exam_id}/result`}
              className={`stu-panel stu-panel--pressable stu-panel--accent ${styles.cardLink}`}
            >
              <div className={styles.row}>
                <div className={styles.iconWrap}>
                  <IconExam className={styles.itemIcon} />
                </div>
                <div className={styles.content}>
                  <div className={styles.title}>{e.title}</div>
                  <div className={`stu-muted ${styles.meta}`}>
                    {e.session_title && `${e.session_title} · `}
                    {examScoreLabel(e)}
                  </div>
                  {provisional && (
                    <Badge size="xs" tone="warning">{subjectivePending ? "서술형 채점 중" : "채점 확인 중"}</Badge>
                  )}
                  {(hasQuestionAnalysis || correction) && (
                    <div
                      className={styles.analysisLine}
                      data-has-wrong={wrongCount > 0}
                      data-testid="grade-wrong-summary"
                    >
                      {hasQuestionAnalysis && (wrongCount > 0 ? (
                        <>
                          <span className={styles.analysisLabel}>오답 {wrongCount}문항</span>
                          {wrongNumbers && <span className={styles.analysisNumbers}>{wrongNumbers}</span>}
                        </>
                      ) : (
                        <span className={styles.analysisLabel}>전 문항 정답</span>
                      ))}
                      {correction && (
                        <Badge
                          size="xs"
                          tone={correction.tone}
                          className={styles.correctionBadge}
                        >
                          {correction.label}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.statusBlock}>
                  {!wrongCompletionOnly && !provisional && (
                    <GradeBadge passed={e.is_pass} achievement={e.achievement} label={labels} />
                  )}
                  <div className={styles.statusMeta}>
                    {!provisional && e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED" && (
                      <span className={styles.rankBadge}>
                        {e.rank}/{e.cohort_size}등
                      </span>
                    )}
                    {!provisional && e.total_score != null && e.max_score > 0 && (
                      <span className={styles.scorePercent}>
                        {Math.round((e.total_score / e.max_score) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <IconChevronRight className={styles.chevron} />
              </div>
            </Link>
              <ParentAssessmentComment kind="exam" assessmentId={e.exam_id} sessionId={e.session_id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LectureGroupHeader({ label, count, avgPct }: { label: string; count: number; avgPct: number | null }) {
  return (
    <div className={styles.groupHeader}>
      <div className={styles.groupTitleBlock}>
        <div className={styles.groupTitle}>{label}</div>
        <div className={`stu-muted ${styles.groupMeta}`}>
          {count}건{avgPct != null ? ` · 평균 득점률 ${avgPct}%` : ""}
        </div>
      </div>
    </div>
  );
}
