// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (students 도메인 SSOT)
 *
 * - DomainListToolbar + 테이블 위주 구성
 * - 차시블럭·레거시 요약 제거 (출결탭에만 차시블럭)
 */

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

export default function SessionScoresEntryPage({
  onOpenEnrollModal,
  onOpenStudentModal,
}: Props) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const numericSessionId = Number(sessionId);

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
    <div className="flex items-center gap-2">
      {onOpenEnrollModal && (
        <Button type="button" intent="primary" size="sm" onClick={onOpenEnrollModal}>
          수강생 등록
        </Button>
      )}
      {onOpenStudentModal && (
        <Button type="button" intent="secondary" size="sm" onClick={onOpenStudentModal}>
          학생 추가
        </Button>
      )}
    </div>
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
            id="scores-search"
            style={{ maxWidth: 280 }}
            aria-label="학생 이름 검색"
          />
        }
        filterSlot={null}
        primaryAction={primaryAction}
      />

      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />
      )}

      {!isLoading && isError && (
        <EmptyState scope="panel" tone="error" title="성적 로드 실패" />
      )}

      {!isLoading && !isError && (
        <SessionScoresPanel
          sessionId={numericSessionId}
          searchInputId="scores-search"
        />
      )}
    </div>
  );
}
