// PATH: src/features/sessions/components/AssessmentDeleteBar.tsx
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteSessionExam } from "@/features/sessions/api/deleteSessionExam";
import { deleteSessionHomework } from "@/features/sessions/api/deleteSessionHomework";
import { feedback } from "@/shared/ui/feedback/feedback";
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

  const invalidateExams = () => qc.invalidateQueries({ queryKey: ["admin-session-exams", sessionId] });
  const invalidateHomeworks = () => qc.invalidateQueries({ queryKey: ["session-homeworks", sessionId] });
  const invalidateScores = () => qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (type === "exam") {
        await deleteSessionExam(id);
        invalidateExams();
      } else {
        await deleteSessionHomework(id);
        invalidateHomeworks();
      }
      invalidateScores();
      feedback.success(type === "exam" ? "시험이 삭제되었습니다." : "과제가 삭제되었습니다.");
      setConfirmOpen(false);
      onDeleted();
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "삭제 실패");
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
          className="w-full !bg-[var(--color-error)] hover:!bg-[var(--color-error)]/90"
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
              정말로 삭제하시겠습니까? 연결된 모든 데이터가 삭제됩니다.
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
                className="!bg-[var(--color-error)] hover:!bg-[var(--color-error)]/90"
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
