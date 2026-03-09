// PATH: src/features/homework/components/common/HomeworkHeader.tsx
/**
 * HomeworkHeader
 * - DRAFT/OPEN/CLOSED는 사용자에게 노출하지 않음.
 * - 표시: 설정 중 / 진행 중 / 마감됨
 * - DRAFT → "진행하기" 버튼 (기본 설정 완료 후 배포), OPEN → "마감" 버튼
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { HomeworkSummary } from "../../types";
import { updateAdminHomework } from "../../api/adminHomework";
import { Button } from "@/shared/ui/ds";

const PHASE_LABEL: Record<string, string> = {
  DRAFT: "설정 중",
  OPEN: "진행 중",
  CLOSED: "마감됨",
};

type Props = {
  homework: HomeworkSummary;
};

export default function HomeworkHeader({ homework }: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<"progress" | "close" | null>(null);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["admin-homework", homework.id] });
    if (homework.session_id)
      qc.invalidateQueries({ queryKey: ["session-homeworks", homework.session_id] });
  };

  const handleProgress = async () => {
    setLoading("progress");
    try {
      await updateAdminHomework(homework.id, { status: "OPEN" });
      refetch();
    } finally {
      setLoading(null);
    }
  };

  const handleClose = async () => {
    setLoading("close");
    try {
      await updateAdminHomework(homework.id, { status: "CLOSED" });
      refetch();
    } finally {
      setLoading(null);
    }
  };

  const phaseLabel = PHASE_LABEL[homework.status] ?? "설정 중";
  const isDraft = homework.status === "DRAFT";
  const isOpen = homework.status === "OPEN";

  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {homework.title}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">{phaseLabel}</span>
          {isDraft && (
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
          {isOpen && (
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

      <div className="text-xs text-[var(--text-muted)]">
        ※ 과제의 <b>성적 입력 · 판정</b>은 <b>세션 &gt; 성적</b> 메뉴에서
        진행합니다.
      </div>
    </div>
  );
}
