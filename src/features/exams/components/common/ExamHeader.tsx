import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Exam } from "../../types";
import { updateAdminExam, saveExamAsTemplate } from "../../api/adminExam";
import { Button } from "@/shared/ui/ds";

/**
 * 시험 단계 (과제와 동일). DRAFT/OPEN/CLOSED 문구 노출 없음. 진행하기/마감 버튼만.
 */
export default function ExamHeader({ exam }: { exam: Exam }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<"progress" | "close" | null>(null);
  const isRegular = exam.exam_type === "regular";
  const isDraft = exam.status === "DRAFT";
  const isOpen = exam.status === "OPEN";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
  };

  const handleProgress = async () => {
    setLoading("progress");
    try {
      if (isRegular && !exam.template_exam_id) {
        await saveExamAsTemplate(exam.id);
        invalidate();
      }
      await updateAdminExam(exam.id, { status: "OPEN" });
      invalidate();
    } finally {
      setLoading(null);
    }
  };

  const handleClose = async () => {
    setLoading("close");
    try {
      await updateAdminExam(exam.id, { status: "CLOSED" });
      invalidate();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{exam.title}</h2>
        </div>

        <div className="flex items-center gap-2">
          {isRegular && isDraft && (
            <Button
              type="button"
              intent="primary"
              size="sm"
              onClick={handleProgress}
              disabled={!!loading}
            >
              {loading === "progress" ? "처리 중…" : "진행하기"}
            </Button>
          )}
          {isRegular && isOpen && (
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={handleClose}
              disabled={!!loading}
            >
              {loading === "close" ? "처리 중…" : "마감"}
            </Button>
          )}
        </div>
      </div>

      {exam.description?.trim() && (
        <div className="text-sm text-muted whitespace-pre-wrap">
          {exam.description}
        </div>
      )}
    </div>
  );
}
