// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - DomainListToolbar + 테이블, Tab/화살표 셀 이동, 편집 모드에서만 셀 편집
 * - 학생 체크박스 선택 시 메시지 발송·수업결과 발송·성적일괄변경·엑셀 다운로드 (students 도메인 참고)
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import SessionScoresPanel, { type SessionScoresPanelHandle } from "@/features/scores/panels/SessionScoresPanel";
import { useScoreEditDraft } from "@/features/scores/hooks/useScoreEditDraft";
import { postScoreDraftCommit } from "@/features/scores/api/scoreDraft";
import {
  fetchSessionScores,
  type SessionScoreRow,
} from "@/features/scores/api/sessionScores";
import { scoresQueryKeys } from "@/features/scores/api/queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { feedback } from "@/shared/ui/feedback/feedback";
import "./SessionScoresEntryPage.css";

type Props = {
  onOpenEnrollModal?: () => void;
  onOpenStudentModal?: () => void;
};

export default function SessionScoresEntryPage(_props: Props) {
  const { sessionId: sessionIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericSessionId = Number(sessionIdParam);
  const [searchInput, setSearchInput] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  /** 편집 시 어떤 셀을 쓰기 모드로 할지 */
  const [examEditTotal, setExamEditTotal] = useState(false);
  const [examEditSubjective, setExamEditSubjective] = useState(false);
  const [homeworkEdit, setHomeworkEdit] = useState(false);
  /** 읽기 모드에서 시험 점수 표시: 합산(한 칸) | 객관식+주관식(두 칸) */
  const [scoreDisplayMode, setScoreDisplayMode] = useState<"total" | "breakdown">("total");
  const { openSendMessageModal } = useSendMessageModal();
  const panelRef = useRef<SessionScoresPanelHandle>(null);

  const sessionIdForDraft = Number.isFinite(numericSessionId) ? numericSessionId : 0;
  const draft = useScoreEditDraft({
    sessionId: sessionIdForDraft,
    panelRef,
    isEditMode: !!isEditMode && sessionIdForDraft > 0,
  });
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isEditMode || draft.draftStatus !== "saved") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isEditMode, draft.draftStatus]);

  const setPresetTotalHw = () => {
    setExamEditTotal(true);
    setExamEditSubjective(false);
    setHomeworkEdit(true);
  };
  const setPresetSubjectiveHw = () => {
    setExamEditTotal(false);
    setExamEditSubjective(true);
    setHomeworkEdit(true);
  };

  const handleSelectTotal = () => {
    if (examEditTotal) {
      setExamEditTotal(false);
      return;
    }
    if (examEditSubjective) {
      const ok = window.confirm("주관식만 입력이 해제됩니다. 합산으로 입력하시겠습니까?");
      if (!ok) return;
      setExamEditSubjective(false);
    }
    setExamEditTotal(true);
  };
  const handleSelectSubjective = () => {
    if (examEditSubjective) {
      setExamEditSubjective(false);
      return;
    }
    if (examEditTotal) {
      const ok = window.confirm("합산 입력이 해제됩니다. 주관식만으로 입력하시겠습니까?");
      if (!ok) return;
      setExamEditTotal(false);
    }
    setExamEditSubjective(true);
  };
  const handleSelectHomework = () => setHomeworkEdit((v) => !v);

  const { data, isLoading, isError } = useQuery({
    queryKey: scoresQueryKeys.sessionScores(numericSessionId),
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

  const selectionBar = (
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
          disabled={selectedEnrollmentIds.length === 0}
        >
          메시지 발송
        </Button>
        <Button
          intent="secondary"
          size="sm"
          onClick={() => feedback.info("수업결과 발송 기능 준비 중입니다.")}
          disabled={selectedEnrollmentIds.length === 0}
        >
          수업결과 발송
        </Button>
        <Button
          intent="secondary"
          size="sm"
          onClick={() => feedback.info("성적 일괄 변경 기능 준비 중입니다.")}
          disabled={selectedEnrollmentIds.length === 0}
        >
          성적 일괄 변경
        </Button>
        <Button
          intent="secondary"
          size="sm"
          onClick={() => feedback.info("엑셀 다운로드 기능 준비 중입니다.")}
          disabled={selectedEnrollmentIds.length === 0}
        >
          엑셀 다운로드
        </Button>
      </div>
    </div>
  );

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
      onClick={() => {
        if (isEditMode) {
          void panelRef.current?.flushPendingChanges?.().then(async () => {
            try {
              await postScoreDraftCommit(sessionIdForDraft);
            } finally {
              setIsEditMode(false);
            }
          });
          return;
        }
        setIsEditMode(true);
      }}
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
        primaryAction={
          <div className="flex items-center gap-2">
            {primaryAction}
            {isEditMode && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {draft.draftStatus === "saving" && "임시저장 중..."}
                {draft.draftStatus === "saved" && draft.lastSavedAt != null &&
                  `임시저장됨 · ${Math.max(0, Math.floor((Date.now() - draft.lastSavedAt) / 1000))}초 전`}
                {draft.draftStatus === "error" && (
                  <>
                    <span className="text-[var(--color-error)]">임시저장 실패</span>
                    {" "}
                    <button type="button" className="underline text-[var(--color-brand-primary)]" onClick={() => void draft.performSave()}>
                      다시 시도
                    </button>
                  </>
                )}
                {draft.draftStatus === "idle" && <span className="text-[var(--color-text-muted)]">저장 안 됨</span>}
              </span>
            )}
          </div>
        }
        belowSlot={selectionBar}
      />

      {draft.hasDraftToRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-restore-title-entry"
        >
          <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg p-6 max-w-md mx-4 border border-[var(--color-border-divider)]">
            <h2 id="draft-restore-title-entry" className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
              이전에 임시저장된 편집 내용이 있습니다. 복원할까요?
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              복원하면 이전 편집 내용이 테이블에 다시 적용됩니다. 버리면 현재 서버 데이터만 표시됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => void draft.discardDraft()}
                className="h-9 px-4 rounded text-sm font-medium border border-[var(--color-border-divider)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-soft)]"
              >
                버리기
              </button>
              <button
                type="button"
                onClick={draft.restoreDraft}
                className="h-9 px-4 rounded text-sm font-medium bg-[var(--color-brand-primary)] text-white hover:opacity-90"
              >
                복원
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditMode && (
        <div className="scores-edit-bar">
          <span className="scores-edit-bar__label">편집 항목</span>
          <div className="scores-edit-bar__group" role="group" aria-label="빠른 선택">
            <button
              type="button"
              onClick={setPresetTotalHw}
              className="scores-edit-segment__btn scores-edit-segment__btn--wide"
              aria-pressed={examEditTotal && homeworkEdit && !examEditSubjective}
            >
              합산 + 과제
            </button>
            <button
              type="button"
              onClick={setPresetSubjectiveHw}
              className="scores-edit-segment__btn scores-edit-segment__btn--wide"
              aria-pressed={examEditSubjective && homeworkEdit && !examEditTotal}
            >
              주관식만 + 과제
            </button>
          </div>
          <span className="scores-edit-bar__divider" aria-hidden="true">|</span>
          <div className="scores-edit-bar__group" role="group" aria-label="시험">
            <button
              type="button"
              onClick={handleSelectTotal}
              className="scores-edit-segment__btn"
              aria-pressed={examEditTotal}
            >
              합산
            </button>
            <button
              type="button"
              onClick={handleSelectSubjective}
              className="scores-edit-segment__btn"
              aria-pressed={examEditSubjective}
            >
              주관식만
            </button>
          </div>
          <span className="scores-edit-bar__divider" aria-hidden="true">|</span>
          <div className="scores-edit-bar__group" role="group" aria-label="과제">
            <button
              type="button"
              onClick={handleSelectHomework}
              className="scores-edit-segment__btn"
              aria-pressed={homeworkEdit}
            >
              과제
            </button>
          </div>
        </div>
      )}

      {!isEditMode && (
        <div className="scores-display-bar">
          <span className="scores-display-bar__label">시험 점수 표시</span>
          <div className="scores-display-segment" role="group" aria-label="시험 점수 표시 방식">
            <button
              type="button"
              onClick={() => setScoreDisplayMode("total")}
              className="scores-display-segment__btn"
              aria-pressed={scoreDisplayMode === "total"}
            >
              합산
            </button>
            <button
              type="button"
              onClick={() => setScoreDisplayMode("breakdown")}
              className="scores-display-segment__btn"
              aria-pressed={scoreDisplayMode === "breakdown"}
            >
              객관식 + 주관식
            </button>
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
          ref={panelRef}
          sessionId={numericSessionId}
          search={searchInput}
          isEditMode={isEditMode}
          examEditTotal={examEditTotal}
          examEditObjective={false}
          examEditSubjective={examEditSubjective}
          homeworkEdit={homeworkEdit}
          scoreDisplayMode={scoreDisplayMode}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={setSelectedEnrollmentIds}
        />
      )}
    </div>
  );
}
