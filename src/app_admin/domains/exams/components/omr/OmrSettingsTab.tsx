import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { updateAdminExam } from "../../api/adminExam";
import { adminExamsQueryKeys, invalidateExamPolicyConsumers } from "../../queryKeys";
import type { Exam, EssayNumbering } from "../../types";
import OmrSheetBuilder, { MAX_MC_COUNT, MAX_ESSAY_COUNT } from "./OmrSheetBuilder";

/** OMR 답안지 탭 — 백엔드 SSOT 기반 설정 + 미리보기 + PDF 다운로드 */
export default function OmrSettingsTab({
  exam,
  lectureName,
  sessionName,
  choiceCount,
  essayCount,
  questionTypes,
  guidedPrint,
  onDownloaded,
}: {
  exam: Exam;
  lectureName: string;
  sessionName: string;
  choiceCount: number;
  essayCount: number;
  questionTypes: Array<"choice" | "essay">;
  guidedPrint?: boolean;
  onDownloaded?: () => void;
}) {
  const qc = useQueryClient();
  const saveNumbering = useMutation({
    mutationFn: (mode: EssayNumbering) => updateAdminExam(exam.id, { essay_numbering: mode }, exam.updated_at),
    onSuccess: async (updated) => {
      qc.setQueryData(adminExamsQueryKeys.adminExam(updated.id), updated);
      await invalidateExamPolicyConsumers(qc);
      feedback.success("서술형 번호를 시험에 저장했습니다.");
    },
    onError: async () => {
      await qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(exam.id), exact: true });
    },
  });
  const exceedsOmrLimit = choiceCount > MAX_MC_COUNT || essayCount > MAX_ESSAY_COUNT;
  return (
    <div className="answer-key-omr-tab">
      {exceedsOmrLimit && (
        <div className="answer-key-omr-limit-alert" role="status">
          OMR 답안지는 객관식 {MAX_MC_COUNT}문항, 서답형 {MAX_ESSAY_COUNT}문항까지 지원합니다.
          현재 시험은 객관식 {choiceCount}문항, 서답형 {essayCount}문항이라 OMR 미리보기와 PDF는 지원 범위까지만 표시됩니다.
        </div>
      )}
      <OmrSheetBuilder
        target={{ type: "exam", examId: exam.id }}
        initialExamTitle={exam.title || ""}
        initialLectureName={lectureName || ""}
        initialSessionName={sessionName || ""}
        initialMcCount={choiceCount}
        initialEssayCount={essayCount}
        examNumbering={{
          value: exam.essay_numbering,
          pendingValue: saveNumbering.isPending ? saveNumbering.variables : undefined,
          select: (mode) => saveNumbering.mutate(mode),
          saving: saveNumbering.isPending,
          error: saveNumbering.isError
            ? isStaleResourceConflict(saveNumbering.error)
              ? "다른 화면에서 시험을 변경했습니다. 현재 번호를 확인하고 다시 선택하세요."
              : extractApiError(saveNumbering.error, "서술형 번호를 저장하지 못했습니다. 원하는 방식을 다시 선택하세요.")
            : "",
        }}
        initialQuestionTypes={questionTypes}
        layout="modal"
        guidedPrint={guidedPrint}
        onDownloaded={onDownloaded}
      />
    </div>
  );
}
