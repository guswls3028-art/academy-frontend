// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - DomainListToolbar + 테이블, Tab/화살표 셀 이동, 편집 모드에서만 셀 편집
 * - 학생 체크박스 선택 시 메시지 발송·수업결과 발송·성적일괄변경·엑셀 다운로드 (students 도메인 참고)
 */

import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";
import type { SessionScoreRow } from "@/features/scores/api/sessionScores";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  onOpenEnrollModal?: () => void;
  onOpenStudentModal?: () => void;
};

async function fetchSessionScores(sessionId: number) {
  const res = await api.get(`/results/admin/sessions/${sessionId}/scores/`);
  return res.data as { meta: unknown; rows: SessionScoreRow[] };
}

export default function SessionScoresEntryPage(_props: Props) {
  const { sessionId: sessionIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericSessionId = Number(sessionIdParam);
  const [searchInput, setSearchInput] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  /** 시험 점수 입력 모드: 합산(한 칸에 총점) | 주관식(문항별 점수) */
  const [examScoreInputMode, setExamScoreInputMode] = useState<"total" | "item">("total");
  const { openSendMessageModal } = useSendMessageModal();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-scores", numericSessionId],
    queryFn: () => fetchSessionScores(numericSessionId),
    enabled: Number.isFinite(numericSessionId),
  });

  const totalCount = data?.rows?.length ?? 0;
  const selectedStudentIds = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows
      .filter((r) => selectedEnrollmentIds.includes(r.enrollment_id))
      .map((r) => r.student_id)
      .filter((id): id is number => id != null && Number.isFinite(id));
  }, [data?.rows, selectedEnrollmentIds]);

  const selectionBar =
    selectedEnrollmentIds.length > 0 ? (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <span
            className="text-[13px] font-semibold"
            style={{
              color: "var(--color-brand-primary)",
            }}
          >
            {selectedEnrollmentIds.length}명 선택됨
          </span>
          <span className="text-[var(--color-border-divider)]">|</span>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => setSelectedEnrollmentIds([])}
            disabled={selectedEnrollmentIds.length === 0}
          >
            선택 해제
          </Button>
          <span className="text-[var(--color-border-divider)]">|</span>
          <Button
            intent="secondary"
            size="sm"
            onClick={() =>
              openSendMessageModal({
                studentIds: selectedStudentIds,
                recipientLabel: `선택한 수강생 ${selectedEnrollmentIds.length}명`,
              })
            }
          >
            메시지 발송
          </Button>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => feedback.info("수업결과 발송 기능 준비 중입니다.")}
          >
            수업결과 발송
          </Button>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => feedback.info("성적 일괄 변경 기능 준비 중입니다.")}
          >
            성적 일괄 변경
          </Button>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => feedback.info("엑셀 다운로드 기능 준비 중입니다.")}
          >
            엑셀 다운로드
          </Button>
        </div>
      </div>
    ) : null;

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
        belowSlot={selectionBar}
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
          <div className="flex flex-wrap items-center gap-4 font-normal">
            <span className="text-[var(--color-text-secondary)]">
              엑셀과 동일한 조작방식. · Tab/Enter/방향키로 셀 이동 · 숫자 입력 시 기존 값 대체 · 미제출: <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)]">/</kbd> + Enter
            </span>
            <fieldset className="flex items-center gap-3" aria-label="시험 점수 입력 방식">
              <legend className="sr-only">시험 점수 입력 방식</legend>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="examScoreInputMode"
                  checked={examScoreInputMode === "total"}
                  onChange={() => setExamScoreInputMode("total")}
                  className="cursor-pointer"
                />
                <span className="text-[var(--color-text-primary)]">합산점수입력</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="examScoreInputMode"
                  checked={examScoreInputMode === "item"}
                  onChange={() => setExamScoreInputMode("item")}
                  className="cursor-pointer"
                />
                <span className="text-[var(--color-text-primary)]">주관식점수만입력</span>
              </label>
            </fieldset>
          </div>
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
          examScoreInputMode={examScoreInputMode}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={setSelectedEnrollmentIds}
        />
      )}
    </div>
  );
}
