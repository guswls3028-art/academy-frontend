import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { Button } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { feedback } from "@/shared/ui/feedback/feedback";

import { recalculateExam } from "../../api/adminExam";
import { adminExamsQueryKeys } from "../../queryKeys";

type Props = {
  examId: number;
  lectureId?: number;
  sessionId?: number;
};

export default function ExamBulkActionsPanel({ examId, lectureId, sessionId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canOpenScores =
    Number.isFinite(lectureId) && Number(lectureId) > 0 &&
    Number.isFinite(sessionId) && Number(sessionId) > 0;

  const recalculate = useMutation({
    mutationFn: () => recalculateExam(examId),
    onSuccess: () => {
      feedback.success("현재 답안 기준으로 재채점을 완료했습니다.");
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResults(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminSubmissions });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminPendingSubmissions });
    },
    onError: (error: unknown) => {
      feedback.error((error as Error)?.message ?? "재채점하지 못했습니다.");
    },
  });

  const openScores = () => {
    if (!canOpenScores) {
      feedback.info("차시 성적 화면에서 채점을 시작할 수 있습니다.");
      return;
    }
    navigate(`/workspace/lectures/${lectureId}/sessions/${sessionId}/scores`);
  };

  return (
    <section id="assessment-next-step" tabIndex={-1} className={formStyles.section}>
      <div className={formStyles.header}>
        <div>
          <h2 className={formStyles.title}>다음 작업</h2>
          <p className={formStyles.description}>
            설정과 대상자를 확인했다면 차시 성적에서 OMR 또는 직접 채점을 시작하세요.
          </p>
        </div>
        <Button type="button" intent="primary" size="sm" onClick={openScores}>
          채점·성적 열기
        </Button>
      </div>

      <details className={formStyles.advanced}>
        <summary>고급 작업</summary>
        <div className={formStyles.advancedBody}>
          <div className={formStyles.inlineStatus}>
            <div>
              <strong>현재 답안으로 기존 결과 재채점</strong>
              <p>답안을 수정한 뒤 기존 제출 결과 전체를 다시 계산할 때만 사용합니다.</p>
            </div>
            <Button
              type="button"
              intent="danger"
              size="sm"
              disabled={recalculate.isPending}
              loading={recalculate.isPending}
              onClick={() => recalculate.mutate()}
            >
              {recalculate.isPending ? "재채점 중…" : "재채점 실행"}
            </Button>
          </div>
        </div>
      </details>
    </section>
  );
}
