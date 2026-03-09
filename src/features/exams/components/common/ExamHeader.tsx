import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Exam } from "../../types";
import { updateAdminExam } from "../../api/adminExam";
import { Button } from "@/shared/ui/ds";

/**
 * 시험 단계 (과제와 동일). DRAFT/OPEN/CLOSED는 사용자에게 노출하지 않음.
 * - 설정 중: status DRAFT (생성 직후)
 * - 진행 중: status OPEN (기본 설정 완료 후 진행하기)
 * - 마감: status CLOSED (마감 버튼)
 */
const PHASE_LABEL: Record<string, string> = {
  DRAFT: "설정 중",
  OPEN: "진행 중",
  CLOSED: "마감",
};

export default function ExamHeader({ exam }: { exam: Exam }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<"progress" | "close" | null>(null);
  const phase = PHASE_LABEL[exam.status] ?? "설정 중";
  const isRegular = exam.exam_type === "regular";
  const isDraft = exam.status === "DRAFT";
  const isOpen = exam.status === "OPEN";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
  };

  const handleProgress = async () => {
    setLoading("progress");
    try {
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
          <div className="text-xs text-muted">
            {exam.exam_type === "template" ? "템플릿" : "운영"} ·{" "}
            {exam.subject || "과목 미지정"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">{phase}</span>
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

      <div className="text-xs text-muted">
        ※ 성적 입력 · 채점 · 판정은 <b>세션 &gt; 성적</b> 도메인이 단일진실입니다.
      </div>
    </div>
  );
}
