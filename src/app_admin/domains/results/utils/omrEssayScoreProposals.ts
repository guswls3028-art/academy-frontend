import type {
  ManualGradeCell,
  ManualGradeOmrEssayScore,
  ManualGradeQuestion,
  ManualGradeRow,
} from "@admin/domains/results/api/manualExamGrading";

/**
 * Beta OMR 교사 채점란 → 점수표 채우기 계획.
 *
 * 비어 있는 서술형 점수 칸만 채운다. 이미 입력·저장된 점수, 결시 행, 배점을 넘는
 * 값, 읽지 못한 칸은 바꾸지 않는다. 채운 값은 기존 확인·확정 흐름으로 저장된다.
 * 계약: docs/GRADING-WRONG-NOTE-WORKFLOW.md "OMR 교사 채점란 (Beta)".
 */
export type OmrEssayScoreFillChange = {
  enrollmentId: number;
  questionId: number;
  before: ManualGradeCell;
  after: ManualGradeCell;
};

export type OmrEssayScoreFillPlan = {
  changes: OmrEssayScoreFillChange[];
  /** 이미 다른 점수가 입력돼 그대로 둔 칸 */
  keptDifferent: number;
  /** 판독 불가·배점 초과로 직접 확인해야 하는 칸 */
  needsCheck: number;
};

export function planOmrEssayScoreFill(
  rows: ManualGradeRow[],
  questions: ManualGradeQuestion[],
  maxScoreByQuestion: (question: ManualGradeQuestion) => number,
): OmrEssayScoreFillPlan {
  const plan: OmrEssayScoreFillPlan = { changes: [], keptDifferent: 0, needsCheck: 0 };
  const essayQuestions = questions.filter(
    (question) => question.kind === "essay" && question.editable && question.entry_method === "score",
  );
  for (const row of rows) {
    if (row.is_not_submitted || !row.omr_essay_scores) continue;
    for (const question of essayQuestions) {
      const key = String(question.question_id);
      const proposal = row.omr_essay_scores[key];
      const cell = row.cells[key];
      if (!proposal || !cell?.editable) continue;
      const fillable = omrProposalScore(proposal, maxScoreByQuestion(question));
      if (fillable == null) {
        plan.needsCheck += 1;
        continue;
      }
      if (cell.score != null) {
        if (Math.abs(cell.score - fillable) > 1e-6) plan.keptDifferent += 1;
        continue;
      }
      plan.changes.push({
        enrollmentId: row.enrollment_id,
        questionId: question.question_id,
        before: { ...cell },
        after: { ...cell, score: fillable },
      });
    }
  }
  return plan;
}

/** 채울 수 있는 점수, 아니면 null (판독 불가·배점 초과). */
export function omrProposalScore(
  proposal: ManualGradeOmrEssayScore,
  maxScore: number,
): number | null {
  if (proposal.status !== "ok" || proposal.score == null) return null;
  if (!Number.isFinite(proposal.score) || proposal.score < 0) return null;
  if (proposal.score > maxScore + 1e-6) return null;
  return Math.round(proposal.score * 10) / 10;
}

export function omrProposalHint(
  proposal: ManualGradeOmrEssayScore | undefined,
  value: number | null,
  maxScore: number,
): { text: string; tone: "info" | "warning" } | null {
  if (!proposal) return null;
  const fillable = omrProposalScore(proposal, maxScore);
  if (fillable == null) {
    return proposal.status === "needs_check" || proposal.score == null
      ? { text: "OMR 확인", tone: "warning" }
      : { text: `OMR ${Math.round(proposal.score * 10) / 10} 배점 초과`, tone: "warning" };
  }
  if (value != null && Math.abs(value - fillable) <= 1e-6) return null;
  return {
    text: `OMR ${fillable}`,
    tone: value == null ? "info" : "warning",
  };
}
