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
import { useConfirm } from "@/shared/ui/confirm";

type Props = {
  type: "exam" | "homework";
  id: number;
  sessionId: number;
  onDeleted: () => void;
};

export default function AssessmentDeleteBar({ type, id, sessionId, onDeleted }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const label = type === "exam" ? "시험 제거하기" : "과제 제거하기";
  const confirmMessage = type === "exam"
    ? "이 시험을 현재 차시에서 제거합니다. 다른 차시에서 사용하는 시험과 이미 입력된 성적·제출 기록은 보존됩니다."
    : "이 과제를 현재 차시에서 제거합니다. 이미 제출된 기록과 성적은 보존됩니다.";

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: type === "exam" ? "시험 제거" : "과제 제거",
      message: confirmMessage,
      confirmText: "제거",
      danger: true,
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      if (type === "exam") {
        const outcome = await deleteSessionExam(id, sessionId);
        removeSessionExamFromQueryCache(qc, { sessionId, examId: id });
        await invalidateSessionExamQueries(qc, { sessionId, examId: id });
        const action = String(outcome?.action ?? "");
        feedback.success(
          action === "archived"
            ? "시험을 현재 차시에서 제거했습니다. 기존 성적·제출 기록은 보존됩니다."
            : action === "unlinked"
            ? "시험을 현재 차시에서만 제거했습니다. 다른 차시의 시험은 유지됩니다."
            : "시험을 현재 차시에서 제거했습니다.",
        );
      } else {
        await deleteSessionHomework(id);
        await invalidateSessionHomeworkQueries(qc, sessionId);
        feedback.success("과제를 현재 차시에서 제거했습니다. 기존 제출·성적 기록은 보존됩니다.");
      }
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
          onClick={() => void handleDelete()}
          disabled={loading}
        >
          {loading ? "처리 중…" : label}
        </Button>
      </div>
    </div>
  );
}
