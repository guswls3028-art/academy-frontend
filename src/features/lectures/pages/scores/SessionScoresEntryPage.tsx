// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - DomainListToolbar + 테이블, Tab/화살표 셀 이동, 편집 모드에서만 셀 편집
 */

import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";

type Props = {
  onOpenEnrollModal?: () => void;
  onOpenStudentModal?: () => void;
};

async function fetchSessionScores(sessionId: number) {
  const res = await api.get(`/results/admin/sessions/${sessionId}/scores/`);
  return res.data as { meta: unknown; rows: { enrollment_id: number; student_name: string }[] };
}

export default function SessionScoresEntryPage(_props: Props) {
  const { sessionId: sessionIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericSessionId = Number(sessionIdParam);
  const [searchInput, setSearchInput] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-scores", numericSessionId],
    queryFn: () => fetchSessionScores(numericSessionId),
    enabled: Number.isFinite(numericSessionId),
  });

  const totalCount = data?.rows?.length ?? 0;

  if (!Number.isFinite(numericSessionId)) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-error)" }}>
        유효하지 않은 sessionId 입니다.
      </div>
    );
  }

  const primaryAction = (
    <Button
      type="button"
      intent="primary"
      size="sm"
      onClick={() => setIsEditMode((v) => !v)}
      className={!isEditMode ? "!bg-[var(--color-brand-primary)] !text-white hover:!opacity-90" : undefined}
    >
      {isEditMode ? "편집 종료" : "편집 모드"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <DomainListToolbar
        totalLabel={isLoading ? "…" : `총 ${totalCount}명`}
        searchSlot={
          <input
            type="search"
            className="ds-input"
            placeholder="이름 검색 (초성 검색 가능)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 360 }}
            aria-label="학생 이름 검색"
          />
        }
        filterSlot={null}
        primaryAction={primaryAction}
        belowSlot={null}
      />

      {isEditMode && (
        <div
          className="flex flex-col gap-1 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: "color-mix(in srgb, var(--color-brand-primary) 12%, var(--color-bg-surface))",
            color: "var(--color-brand-primary)",
            border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, var(--color-border-divider))",
          }}
        >
          <span aria-live="polite">편집 모드</span>
          <span className="text-[var(--color-text-secondary)] font-normal">
            엑셀과 동일한 조작방식. · Tab/Enter/방향키로 셀 이동 · 숫자 입력 시 기존 값 대체 · 미제출: <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)]">/</kbd> + Enter
          </span>
        </div>
      )}

      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />
      )}

      {!isLoading && isError && (
        <EmptyState scope="panel" tone="error" title="성적 로드 실패" />
      )}

      {!isLoading && !isError && (
        <SessionScoresPanel
          sessionId={numericSessionId}
          search={searchInput}
          isEditMode={isEditMode}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={setSelectedEnrollmentIds}
        />
      )}
    </div>
  );
}
