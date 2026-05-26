/**
 * 강좌별 시험 성적 그룹 — GradesPage에서 추출
 */
import { Link } from "react-router-dom";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
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

function wrongPreview(numbers?: number[]): string {
  if (!Array.isArray(numbers) || numbers.length === 0) return "";
  const shown = numbers.slice(0, 6).join(", ");
  return numbers.length > 6 ? `${shown} 외 ${numbers.length - 6}` : shown;
}

export default function LectureExamGroup({ group, labels }: { group: ExamGroup; labels?: { pass?: string; fail?: string } }) {
  return (
    <div>
      <LectureGroupHeader label={group.label} count={group.exams.length} avgPct={group.avgPct} />
      <div className={styles.list}>
        {group.exams.map((e) => {
          const hasQuestionAnalysis = Number(e.total_questions ?? 0) > 0 && e.meta_status !== "NOT_SUBMITTED";
          const wrongCount = Number(e.wrong_count ?? 0);
          const wrongNumbers = wrongPreview(e.wrong_question_numbers);

          return (
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
                    {fmtScore(e.total_score, e.max_score)}
                  </div>
                  {hasQuestionAnalysis && (
                    <div
                      className={styles.analysisLine}
                      data-has-wrong={wrongCount > 0}
                      data-testid="grade-wrong-summary"
                    >
                      {wrongCount > 0 ? (
                        <>
                          <span className={styles.analysisLabel}>오답 {wrongCount}문항</span>
                          {wrongNumbers && <span className={styles.analysisNumbers}>{wrongNumbers}번</span>}
                        </>
                      ) : (
                        <span className={styles.analysisLabel}>전 문항 정답</span>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.statusBlock}>
                  <GradeBadge passed={e.is_pass} achievement={e.achievement} label={labels} />
                  <div className={styles.statusMeta}>
                    {e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED" && (
                      <span className={styles.rankBadge}>
                        {e.rank}/{e.cohort_size}등
                      </span>
                    )}
                    {e.total_score != null && e.max_score > 0 && (
                      <span className={styles.scorePercent}>
                        {Math.round((e.total_score / e.max_score) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <IconChevronRight className={styles.chevron} />
              </div>
            </Link>
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
          {count}건{avgPct != null ? ` · 평균 ${avgPct}점` : ""}
        </div>
      </div>
    </div>
  );
}
