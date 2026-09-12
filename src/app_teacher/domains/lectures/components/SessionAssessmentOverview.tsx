import { Link, useNavigate } from "react-router";
import type { ScoreBlock, SessionScoresResponse } from "@/shared/api/contracts/sessionScores";
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import { deriveFinalPass } from "@/shared/scoring/achievement";
import { useWrongCompletionDisplay, wrongCompletionLabel } from "@/shared/scoring/assessmentStatusDisplay";
import { getHomeworkStatus } from "@/shared/scoring/homeworkStatus";
import { EmptyState } from "@/shared/ui/ds";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import styles from "./SessionAssessmentOverview.module.css";

type Assessment = {
  id: number;
  kind: "exam" | "homework";
  title: string;
  maxScore: number | null;
  passScore?: number;
  completion?: boolean;
};

function AssessmentTitle({ assessment }: { assessment: Assessment }) {
  return (
    <div className={styles.assessmentTitle}>
      <span className={styles.kind}>{assessment.kind === "exam" ? "시험" : "과제"}</span>
      <Link to={`/workspace/mobile/${assessment.kind === "exam" ? "exams" : "homeworks"}/${assessment.id}`}>
        {assessment.title}
      </Link>
      <span className={styles.criteria}>
        {assessment.completion ? "완료 여부 평가" : [
          assessment.maxScore != null ? `${assessment.maxScore}점 만점` : null,
          assessment.passScore != null && assessment.passScore > 0 ? `통과 기준 ${assessment.passScore}점` : null,
        ].filter(Boolean).join(" · ") || "점수 평가"}
      </span>
    </div>
  );
}

function AssessmentResult({ block, assessment, labels, wrongCompletion }: {
  block?: ScoreBlock;
  assessment: Assessment;
  labels: { pass: string; fail: string };
  wrongCompletion: boolean;
}) {
  if (!block) return <div className={styles.result}><span className={styles.status}>미배정</span></div>;
  const score = block?.score;
  const status = block?.meta?.status;
  const maxScore = assessment.maxScore ?? block?.max_score;
  const notSubmitted = status === "NOT_SUBMITTED";
  const needsReview = status === "OMR_REVIEW_REQUIRED" || block?.meta?.manual_review_required === true;
  let scoreText: string;
  if (assessment.kind === "exam") {
    scoreText = notSubmitted ? "미응시" : score == null ? "미채점" : `${score}${maxScore != null ? `/${maxScore}` : "점"}`;
  } else if (assessment.completion) {
    scoreText = score == null ? "미입력" : score >= 1 ? "완료" : "미완료";
  } else {
    const homeworkStatus = getHomeworkStatus({ score: score ?? null, metaStatus: notSubmitted ? "NOT_SUBMITTED" : null });
    scoreText = homeworkStatus === "NOT_SUBMITTED" ? "미제출" : homeworkStatus === "UNSET" ? "미입력" : `${score}${maxScore != null ? `/${maxScore}` : "점"}`;
  }
  // Only project server fields. The threshold is context, never a new pass/clinic decision.
  const finalPass = block ? deriveFinalPass({ ...block, meta_status: status }) : null;
  const showFinalPass = !(wrongCompletion && assessment.kind === "exam") && finalPass != null;
  return (
    <div className={styles.result}>
      <strong className={styles.score}>{scoreText}{block?.is_provisional && score != null ? " (임시)" : ""}</strong>
      {needsReview && <span className={styles.review}>검토 필요</span>}
      {assessment.completion && notSubmitted && <span className={styles.status}>미제출</span>}
      {showFinalPass && <span className={styles.status} data-tone={finalPass ? "success" : "danger"}>
        {block?.remediated || block?.achievement === "REMEDIATED" ? "보강 " : block?.final_pass != null ? "최종 " : ""}{finalPass ? labels.pass : labels.fail}
      </span>}
      {assessment.kind === "exam" && (wrongCompletion || block.correction_status === "PENDING") && <span className={styles.status}>{wrongCompletionLabel(block.correction_status)}</span>}
      {block?.teacher_resolved && <span className={styles.status}>선생님 확인 완료</span>}
    </div>
  );
}

export default function SessionAssessmentOverview({ scores, lecturePath }: { scores: SessionScoresResponse; lecturePath: string }) {
  const navigate = useNavigate();
  const labels = useTenantLabels();
  const wrongCompletion = useWrongCompletionDisplay();
  const assessments: Assessment[] = [
    ...scores.meta.exams.map((exam) => ({ id: exam.exam_id, kind: "exam" as const, title: exam.title, maxScore: exam.max_score, passScore: exam.pass_score })),
    ...scores.meta.homeworks.map((homework) => ({ id: homework.homework_id, kind: "homework" as const, title: homework.title, maxScore: homework.max_score, completion: homework.grading_mode === "COMPLETION" })),
  ];
  if (!assessments.length) return (
    <EmptyState scope="panel" tone="empty" title="이 차시에 등록된 시험과 과제가 없습니다"
      description="시험이나 과제를 추가하면 학생별 성적을 함께 확인할 수 있습니다."
      actions={<EmptyActionButton onClick={() => navigate(lecturePath)}>강의에서 추가</EmptyActionButton>} />
  );
  if (!scores.rows.length) return <EmptyState scope="panel" tone="empty" title="조회할 학생이 없습니다" description="차시의 수강생 배정을 확인해 주세요." />;
  return (
    <section className={styles.overview} aria-label="차시 성적 종합 조회">
      <div className={styles.summary}>
        <h2>학생별 성적</h2>
        <span>{scores.rows.length}명 · 시험 {scores.meta.exams.length}개 · 과제 {scores.meta.homeworks.length}개</span>
      </div>
      <p className={styles.hint}>시험·과제명을 누르면 상세 내용을 확인할 수 있습니다.<span className={styles.scrollHint}> 폭이 좁으면 표를 좌우로 이동해 확인하세요.</span></p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="학생별 시험 및 과제 비교표">
        <table className={styles.table} role="table">
          <thead role="rowgroup"><tr role="row">
            <th scope="col" role="columnheader" className={styles.studentHeading}>학생</th>
            {assessments.map((assessment) => <th key={`${assessment.kind}-${assessment.id}`} scope="col" role="columnheader"><AssessmentTitle assessment={assessment} /></th>)}
          </tr></thead>
          <tbody role="rowgroup">
            {scores.rows.map((row, index) => (
              <tr key={row.enrollment_id} role="row" data-testid={`session-assessment-student-${row.enrollment_id}`}>
                <th scope="row" role="rowheader" className={styles.studentName}><span className={styles.rowNumber}>{index + 1}</span>{row.student_name}</th>
                {assessments.map((assessment) => {
                  const block = assessment.kind === "exam"
                    ? row.exams.find((exam) => exam.exam_id === assessment.id)?.block
                    : row.homeworks.find((homework) => homework.homework_id === assessment.id)?.block;
                  return (
                    <td key={`${assessment.kind}-${assessment.id}`} role="cell" data-testid={`session-assessment-${assessment.kind}-${assessment.id}`}>
                      <div className={styles.mobileTitle}><AssessmentTitle assessment={assessment} /></div>
                      <AssessmentResult assessment={assessment} block={block} labels={labels} wrongCompletion={wrongCompletion} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
