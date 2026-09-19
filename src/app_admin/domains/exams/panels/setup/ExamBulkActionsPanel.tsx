import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { Button } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";

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
  const confirm = useConfirm();
  const canOpenScores =
    Number.isFinite(lectureId) && Number(lectureId) > 0 &&
    Number.isFinite(sessionId) && Number(sessionId) > 0;

  const recalculate = useMutation({
    mutationFn: () => recalculateExam(examId),
    onSuccess: (result) => {
      if (result.failed.length > 0) {
        feedback.warning(`${result.graded}건 재채점, ${result.failed.length}건 실패했습니다. 다시 시도해 주세요.`);
      } else {
        feedback.success("저장된 정답·배점 기준으로 전체 재채점을 완료했습니다.");
      }
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResultsRoot(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamSummary(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.sessionScoresRoot() });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.clinicTargetsRoot() });
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

      <div className={formStyles.advancedBody}>
        <div className={formStyles.inlineStatus}>
          <div>
            <strong>시험 전체 재채점</strong>
            <p>정답·문항 배점·만점을 먼저 저장한 뒤, 기존 제출 결과 전체를 다시 계산하세요.</p>
          </div>
          <Button
            type="button"
            intent="danger"
            size="sm"
            disabled={recalculate.isPending}
            loading={recalculate.isPending}
            onClick={async () => {
              const confirmed = await confirm({
                title: "시험 전체 재채점",
                message: "저장된 문항·정답·배점을 기준으로 이 시험의 기존 제출 결과 전체와 합격·클리닉 판정을 다시 계산합니다. 아직 저장하지 않은 변경은 반영되지 않습니다.",
                confirmText: "재채점 실행",
                danger: true,
              });
              if (confirmed) recalculate.mutate();
            }}
          >
            {recalculate.isPending ? "재채점 중…" : "전체 재채점"}
          </Button>
        </div>
        {recalculate.data && (
          <p role={recalculate.data.failed.length ? "alert" : "status"}>
            재채점 {recalculate.data.graded}건 · 처리 중·미응시 등 제외 {recalculate.data.skipped}건 · 실패 {recalculate.data.failed.length}건
            {recalculate.data.failed.length > 0 && " — 실패한 제출은 확인 후 다시 시도해 주세요."}
          </p>
        )}
      </div>
    </section>
  );
}
