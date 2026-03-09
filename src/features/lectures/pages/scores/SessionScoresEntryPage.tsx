// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - DomainListToolbar + 테이블, Tab/화살표 셀 이동, 편집 모드에서만 셀 편집
 * - 학생 체크박스 선택 시 메시지 발송·수업결과 발송·성적일괄변경·엑셀 다운로드 (students 도메인 참고)
 */

import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";
import {
  fetchSessionScores,
  type SessionScoreRow,
} from "@/features/scores/api/sessionScores";
import { scoresQueryKeys } from "@/features/scores/api/queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { feedback } from "@/shared/ui/feedback/feedback";

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
  const [examEditObjective, setExamEditObjective] = useState(false);
  const [examEditSubjective, setExamEditSubjective] = useState(false);
  const [homeworkEdit, setHomeworkEdit] = useState(false);
  /** 읽기 모드에서 시험 점수 표시: 합산(한 칸) | 객관식+주관식(두 칸) */
  const [scoreDisplayMode, setScoreDisplayMode] = useState<"total" | "breakdown">("total");
  const { openSendMessageModal } = useSendMessageModal();

  const setPresetTotalHw = () => {
    setExamEditTotal(true);
    setExamEditObjective(false);
    setExamEditSubjective(false);
    setHomeworkEdit(true);
  };
  const setPresetSubjectiveHw = () => {
    setExamEditTotal(false);
    setExamEditObjective(false);
    setExamEditSubjective(true);
    setHomeworkEdit(true);
  };

  /** 합산 선택 시: 이미 객관식/주관식이 켜져 있으면 경고 후 전환. 합산 버튼은 항상 클릭 가능 */
  const handleSelectTotal = () => {
    if (examEditTotal) {
      setExamEditTotal(false);
      return;
    }
    if (examEditObjective || examEditSubjective) {
      const ok = window.confirm(
        "합산점수로 입력시 객관식 점수와 주관식 점수는 제거됩니다. 합산점수로 입력하시겠습니까?"
      );
      if (!ok) return;
    }
    setExamEditTotal(true);
    setExamEditObjective(false);
    setExamEditSubjective(false);
  };

  /** 객관식/주관식 선택 시: 합산이 켜져 있으면 경고 후 전환. 객관식/주관식 버튼은 항상 클릭 가능 */
  const handleSelectObjective = () => {
    if (examEditTotal) {
      const ok = window.confirm(
        "합산 입력이 해제됩니다. 객관식 방식으로 입력하시겠습니까?"
      );
      if (!ok) return;
      setExamEditTotal(false);
    }
    setExamEditObjective((v) => !v);
    setExamEditTotal(false);
  };
  const handleSelectSubjective = () => {
    if (examEditTotal) {
      const ok = window.confirm(
        "합산 입력이 해제됩니다. 주관식 방식으로 입력하시겠습니까?"
      );
      if (!ok) return;
      setExamEditTotal(false);
    }
    setExamEditSubjective((v) => !v);
    setExamEditTotal(false);
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
          className="rounded-xl border text-sm"
          style={{
            background: "var(--color-bg-surface)",
            borderColor: "var(--color-border-divider)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border-divider)" }}>
            <span className="font-semibold text-[var(--color-text-primary)]">편집할 항목 선택</span>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              셀 쓰기를 허용할 시험·과제 항목을 블록을 눌러 선택하세요. 합산과 객관식/주관식은 동시에 선택할 수 없습니다.
            </p>
          </div>
          <div className="p-4 flex flex-col gap-5">
            {/* 프리셋 */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">빠른 선택</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={setPresetTotalHw}
                  className={`min-w-[100px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
                    examEditTotal && homeworkEdit && !examEditSubjective
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-sm"
                      : "bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-bg-surface)]"
                  }`}
                >
                  합산 + 과제
                </button>
                <button
                  type="button"
                  onClick={setPresetSubjectiveHw}
                  className={`min-w-[100px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
                    examEditSubjective && homeworkEdit && !examEditTotal
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-sm"
                      : "bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-bg-surface)]"
                  }`}
                >
                  주관식 + 과제
                </button>
              </div>
            </div>

            {/* 시험: 합산 | 객관식 | 주관식 */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">시험</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSelectTotal}
                  className={`min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-2 select-none ${
                    examEditTotal
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-sm"
                      : "bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-bg-surface)]"
                  }`}
                >
                  합산
                </button>
                <button
                  type="button"
                  onClick={handleSelectObjective}
                  className={`min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-2 select-none ${
                    examEditObjective
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-sm"
                      : "bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-bg-surface)]"
                  }`}
                >
                  객관식
                </button>
                <button
                  type="button"
                  onClick={handleSelectSubjective}
                  className={`min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-2 select-none ${
                    examEditSubjective
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-sm"
                      : "bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-bg-surface)]"
                  }`}
                >
                  주관식
                </button>
              </div>
            </div>

            {/* 과제 */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">과제</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSelectHomework}
                  className={`min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border-2 select-none ${
                    homeworkEdit
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-sm"
                      : "bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-bg-surface)]"
                  }`}
                >
                  과제
                </button>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 border-t text-xs text-[var(--color-text-muted)]" style={{ borderColor: "var(--color-border-divider)" }}>
            Tab / Enter / 방향키로 셀 이동 · 미제출: <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-soft)] border border-[var(--color-border-divider)] font-mono">/</kbd> + Enter
          </div>
        </div>
      )}

      {!isEditMode && (
        <div
          className="rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3"
          style={{
            background: "var(--color-bg-surface)",
            borderColor: "var(--color-border-divider)",
          }}
        >
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">시험 점수 표시</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScoreDisplayMode("total")}
              className={`min-w-[72px] px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                scoreDisplayMode === "total"
                  ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]"
                  : "bg-transparent text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50"
              }`}
            >
              합산
            </button>
            <button
              type="button"
              onClick={() => setScoreDisplayMode("breakdown")}
              className={`min-w-[72px] px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                scoreDisplayMode === "breakdown"
                  ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]"
                  : "bg-transparent text-[var(--color-text-primary)] border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]/50"
              }`}
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
          sessionId={numericSessionId}
          search={searchInput}
          isEditMode={isEditMode}
          examEditTotal={examEditTotal}
          examEditObjective={examEditObjective}
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
