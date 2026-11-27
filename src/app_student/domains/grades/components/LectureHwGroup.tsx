/**
 * 강좌별 과제 성적 그룹 — GradesPage에서 추출
 */
import { Link } from "react-router";
import { useAuthContext } from "@/auth/context/AuthContext";
import { homeworkSubmissionHref } from "../public/homeworkSubmission";
import { IconClipboard } from "@student/shared/ui/icons/Icons";
import GradeBadge from "./GradeBadge";
import { ParentAssessmentComment } from "./ParentAssessmentComments";
import type { MyHomeworkGradeSummary } from "../api/grades.api";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";
import styles from "./LectureGradeGroup.module.css";

export type HwGroup = {
  key: string;
  label: string;
  homeworks: MyHomeworkGradeSummary[];
  avgPct: number | null;
};

const HOMEWORK_SCORE_NUMBER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

export default function LectureHwGroup({ group }: { group: HwGroup }) {
  const { user } = useAuthContext();
  const wrongCompletionOnly = useWrongCompletionDisplay();
  return (
    <div>
      <div className={styles.groupHeader}>
        <div className={styles.groupTitleBlock}>
          <div className={styles.groupTitle}>{group.label}</div>
          <div className={`stu-muted ${styles.groupMeta}`}>
            {group.homeworks.length}건{group.avgPct != null ? ` · 평균 득점률 ${group.avgPct}%` : ""}
          </div>
        </div>
      </div>
      <div className={styles.list}>
        {group.homeworks.map((h, idx) => {
          const submissionHref = user?.tenantRole === "student" ? homeworkSubmissionHref(h) : null;
          const gradingMode = h.grading_mode ?? "SCORE";
          const score = typeof h.score === "number" && Number.isFinite(h.score) ? h.score : null;
          const maxScore = typeof h.max_score === "number" && Number.isFinite(h.max_score) && h.max_score > 0
            ? h.max_score
            : null;
          const inspectionPending = h.inspection_status === "VIDEO_MAKEUP";
          const pendingGrade = Boolean(h.practice_inspection) && score == null;
          const awaitingReview = h.submission_state === "awaiting_review";
          const showGradeBadge = (!pendingGrade || h.teacher_resolved || h.achievement === "REMEDIATED")
            && !(awaitingReview && (score == null || h.achievement === "NOT_SUBMITTED"));
          let scoreText = score == null
            ? maxScore == null ? "검사 전" : `–/${HOMEWORK_SCORE_NUMBER.format(maxScore)}`
            : maxScore == null ? HOMEWORK_SCORE_NUMBER.format(score)
              : `${HOMEWORK_SCORE_NUMBER.format(score)}/${HOMEWORK_SCORE_NUMBER.format(maxScore)}`;
          if (h.teacher_accepted) {
            if (score == null) scoreText = "점수 미입력";
          } else if (pendingGrade) {
            scoreText = gradingMode === "COMPLETION" ? "통과 판정 미입력" : "점수 미입력";
          } else if (inspectionPending) {
            scoreText = "검사 대기";
          } else if (gradingMode === "COMPLETION") {
            scoreText = score == null ? "검사 전" : score > 0 ? "통과" : "미통과";
          }
          const badgePassed = h.teacher_resolved
            ? true
            : h.achievement == null && score == null ? null : h.passed;
          return (
            <div
              key={`${h.homework_id}-${h.lecture_title ?? ""}-${idx}`}
              className={`stu-panel stu-panel--accent ${styles.homeworkCard}`}
              data-session-type={h.session_type ?? "UNCLASSIFIED"}
              data-session-order={h.session_order ?? ""}
            >
              <div className={styles.row}>
                <div className={styles.iconWrap}>
                  <IconClipboard className={styles.itemIcon} />
                </div>
                <div className={styles.content}>
                  <div id={`grade-homework-${h.homework_id}-${h.enrollment_id}`} className={styles.title}>{h.title}</div>
                  <div className={`stu-muted ${styles.meta}`}>
                    {h.session_title ?? "차시 미지정"}
                    <span aria-hidden> · </span>
                    {gradingMode === "COMPLETION" ? "통과형 과제" : "점수형 과제"}
                  </div>
                </div>
                <div className={styles.homeworkStatus}>
                  <strong className={styles.homeworkScore}>{scoreText}</strong>
                  {pendingGrade && inspectionPending && <span className="stu-muted">영상 보강 검사 대기</span>}
                  {!inspectionPending && awaitingReview && (
                    <span className="stu-muted">온라인 제출물 확인 대기</span>
                  )}
                  {pendingGrade && !inspectionPending && h.submission_state === "needs_submission" && (
                    <span className="stu-muted">온라인 제출 필요</span>
                  )}
                  {h.teacher_accepted ? <span className="stu-badge stu-badge--success stu-badge--sm">과제 통과 인정</span> : !inspectionPending && showGradeBadge && <GradeBadge
                    passed={badgePassed}
                    achievement={h.achievement}
                    label={gradingMode === "COMPLETION" ? { pass: "통과", fail: "미통과" } : { pass: "완료", fail: "미완료" }}
                    showNotSubmitted
                    notSubmittedLabel="미제출"
                    emptyLabel="검사 전"
                    remediatedLabel={h.teacher_resolved || wrongCompletionOnly ? "교사 확인 완료" : "보강 완료"}
                    size="sm"
                  />}
                </div>
              </div>
              {h.practice_inspection && <section className={styles.practiceInspection} aria-label="과제 검사 결과">
                <strong>과제 검사 결과</strong>
                {h.practice_inspection.solved != null && <span>{h.practice_inspection.solved}/{h.practice_inspection.total}문제 풀이</span>}
                {h.practice_inspection.feedback && <p>{h.practice_inspection.feedback}</p>}
              </section>}
              <ParentAssessmentComment kind="homework" assessmentId={h.homework_id} sessionId={h.session_id} />
              {gradingMode === "SCORE" && maxScore != null && !pendingGrade && (
                <progress
                  className={styles.homeworkProgress}
                  value={Math.min(Math.max(score ?? 0, 0), maxScore)}
                  max={maxScore}
                  aria-label={`${h.title} 진행 ${score == null ? "검사 전" : `${HOMEWORK_SCORE_NUMBER.format(score)}/${HOMEWORK_SCORE_NUMBER.format(maxScore)}`}`}
                />
              )}
              {submissionHref && <Link to={submissionHref} aria-describedby={`grade-homework-${h.homework_id}-${h.enrollment_id}`} className={`stu-btn stu-btn--primary ${styles.submissionLink}`}>
                {awaitingReview ? "제출 파일 확인·추가" : "온라인 제출"}
              </Link>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
