import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Exam } from "../../types";
import { updateAdminExam } from "../../api/adminExam";
import { Button } from "@/shared/ui/ds";

/**
 * 시험 단계 (사용자 노출용). DRAFT/OPEN/CLOSED 같은 용어 노출 없음.
 * - 설정 중: open_at 없음 → 기본 설정 완료 전
 * - 진행 중: open_at 있음, close_at 없음
 * - 마감: close_at 있음
 */
function derivePhase(exam: Exam): "설정 중" | "진행 중" | "마감" {
  const hasOpen = !!exam.open_at;
  const hasClose = !!exam.close_at;
  if (hasClose) return "마감";
  if (hasOpen) return "진행 중";
  return "설정 중";
}

export default function ExamHeader({ exam }: { exam: Exam }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<"progress" | "close" | null>(null);
  const phase = derivePhase(exam);
  const isRegular = exam.exam_type === "regular";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
  };

  const handleProgress = async () => {
    setLoading("progress");
    try {
      await updateAdminExam(exam.id, {
        open_at: new Date().toISOString(),
      });
      invalidate();
    } finally {
      setLoading(null);
    }
  };

  const handleClose = async () => {
    setLoading("close");
    try {
      await updateAdminExam(exam.id, {
        close_at: new Date().toISOString(),
      });
      invalidate();
    } finally {
      setLoading(null);
    }
  };

  const showProgressButton = isRegular && phase === "설정 중";
  const showCloseButton = isRegular && phase === "진행 중";

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
          {showProgressButton && (
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
          {showCloseButton && (
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
