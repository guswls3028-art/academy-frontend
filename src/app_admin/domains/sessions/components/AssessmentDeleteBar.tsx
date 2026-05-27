// PATH: src/app_admin/domains/sessions/components/AssessmentDeleteBar.tsx
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteSessionExam } from "@admin/domains/sessions/api/deleteSessionExam";
import { deleteSessionHomework } from "@admin/domains/sessions/api/deleteSessionHomework";
import {
  invalidateSessionExamQueries,
  invalidateSessionHomeworkQueries,
  removeSessionExamFromQueryCache,
} from "@admin/domains/sessions/api/sessionAssessmentQueries";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { Button } from "@/shared/ui/ds";

type Props = {
  type: "exam" | "homework";
  id: number;
  sessionId: number;
  onDeleted: () => void;
};

export default function AssessmentDeleteBar({ type, id, sessionId, onDeleted }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const label = type === "exam" ? "시험 삭제하기" : "과제 삭제하기";
  const confirmMessage = type === "exam"
    ? "이 시험을 현재 차시에서 완전히 삭제합니다. 시험 목록, 성적 입력, 응시 대상에서 사라지며 이미 입력된 성적·제출 기록은 보존됩니다."
    : "이 과제를 삭제합니다. 대상 학생과 제출 상태도 함께 정리되며, 이미 제출된 기록은 정책에 따라 보존됩니다.";

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (type === "exam") {
        await deleteSessionExam(id, sessionId);
        removeSessionExamFromQueryCache(qc, { sessionId, examId: id });
        await invalidateSessionExamQueries(qc, { sessionId, examId: id });
      } else {
        await deleteSessionHomework(id);
        await invalidateSessionHomeworkQueries(qc, sessionId);
      }
      feedback.success(type === "exam" ? "시험이 현재 차시에서 완전히 삭제되었습니다." : "과제가 삭제되었습니다.");
      setConfirmOpen(false);
      onDeleted();
    } catch (e: unknown) {
      feedback.error(extractApiError(e, "삭제 실패"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          intent="danger"
          size="md"
          className="w-full !bg-[var(--color-error)] !text-white hover:!bg-[var(--color-error)]/90"
          onClick={() => setConfirmOpen(true)}
        >
          {label}
        </Button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-6 shadow-xl">
            <h3 id="delete-confirm-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
              삭제 확인
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {confirmMessage}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                intent="secondary"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                type="button"
                intent="danger"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
                className="!bg-[var(--color-error)] !text-white hover:!bg-[var(--color-error)]/90"
              >
                {loading ? "처리 중…" : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
