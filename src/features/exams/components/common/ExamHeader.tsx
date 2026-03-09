import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Exam } from "../../types";
import { saveExamAsTemplate } from "../../api/adminExam";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { FiSave } from "react-icons/fi";

/**
 * 시험 헤더: 제목, 상태 배지, 템플릿으로 저장(regular만).
 */
export default function ExamHeader({ exam }: { exam: Exam; sessionId?: number | null }) {
  const qc = useQueryClient();
  const isDraft = exam.status === "DRAFT";
  const isOpen = exam.status === "OPEN";
  const isClosed = exam.status === "CLOSED";
  const isRegular = exam.exam_type === "regular";
  const canSaveAsTemplate = isRegular && !exam.template_exam_id;

  const saveAsTemplateMut = useMutation({
    mutationFn: () => saveExamAsTemplate(exam.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
      feedback.success("템플릿으로 저장했습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "템플릿 저장에 실패했습니다.");
    },
  });

  const statusLabel = isDraft ? "초안" : isOpen ? "진행 중" : isClosed ? "마감" : exam.status;
  const statusTone = isOpen ? "success" : "neutral";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{exam.title}</h2>
            <span className="ds-status-badge" data-tone={statusTone}>{statusLabel}</span>
          </div>
        </div>
        {canSaveAsTemplate && (
          <Button
            type="button"
            intent="primary"
            size="md"
            onClick={() => saveAsTemplateMut.mutate()}
            disabled={saveAsTemplateMut.isPending}
            className="flex items-center gap-2"
          >
            <FiSave className="shrink-0" size={18} aria-hidden />
            템플릿으로 저장
          </Button>
        )}
        {isRegular && exam.template_exam_id && (
          <span className="text-sm text-[var(--text-muted)]">이미 템플릿 있음</span>
        )}
      </div>

      {canSaveAsTemplate && (
        <p className="text-sm text-[var(--text-muted)]">
          시험 템플릿으로 저장 시 다른 강의에서 동일한 시험을 응시할 수 있습니다.
        </p>
      )}

      {exam.description?.trim() && (
        <div className="text-sm text-muted whitespace-pre-wrap">
          {exam.description}
        </div>
      )}
    </div>
  );
}
