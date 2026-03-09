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
          className="flex flex-col gap-2 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: "color-mix(in srgb, var(--color-brand-primary) 12%, var(--color-bg-surface))",
            color: "var(--color-brand-primary)",
            border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, var(--color-border-divider))",
          }}
        >
          <span aria-live="polite">편집 모드 — 셀 쓰기 대상 선택</span>
          <div className="flex flex-wrap items-center gap-6 font-normal">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-secondary)] mr-1">프리셋:</span>
              <button
                type="button"
                onClick={setPresetTotalHw}
                className={`px-2 py-1 rounded text-xs font-medium border ${examEditTotal && homeworkEdit && !examEditSubjective ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]" : "bg-transparent border-[var(--color-border-divider)] text-[var(--color-text-primary)]"}`}
              >
                합산+과제
              </button>
              <button
                type="button"
                onClick={setPresetSubjectiveHw}
                className={`px-2 py-1 rounded text-xs font-medium border ${examEditSubjective && homeworkEdit ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]" : "bg-transparent border-[var(--color-border-divider)] text-[var(--color-text-primary)]"}`}
              >
                주관식+과제
              </button>
            </div>
            <span className="text-[var(--color-border-divider)]">|</span>
            <div className="flex items-center gap-3">
              <span className="text-[var(--color-text-secondary)] font-semibold">시험</span>
              <label id="exam-edit-objective-label" className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  id="exam-edit-objective"
                  type="checkbox"
                  checked={examEditObjective}
                  onChange={(e) => setExamEditObjective(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                  aria-label="객관식 셀 쓰기"
                />
                <span className="text-[var(--color-text-primary)]">객관식</span>
              </label>
              <label id="exam-edit-subjective-label" className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  id="exam-edit-subjective"
                  type="checkbox"
                  checked={examEditSubjective}
                  onChange={(e) => setExamEditSubjective(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                  aria-label="주관식 셀 쓰기"
                />
                <span className="text-[var(--color-text-primary)]">주관식</span>
              </label>
              <label id="exam-edit-total-label" className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  id="exam-edit-total"
                  type="checkbox"
                  checked={examEditTotal}
                  onChange={(e) => setExamEditTotal(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                  aria-label="합산 셀 쓰기"
                />
                <span className="text-[var(--color-text-primary)]">합산</span>
              </label>
            </div>
            <span className="text-[var(--color-border-divider)]">|</span>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-secondary)] font-semibold">과제</span>
              <label id="homework-edit-label" className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  id="homework-edit"
                  type="checkbox"
                  checked={homeworkEdit}
                  onChange={(e) => setHomeworkEdit(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                  aria-label="과제 셀 쓰기"
                />
                <span className="text-[var(--color-text-primary)]">과제</span>
              </label>
            </div>
          </div>
          <span className="text-[var(--color-text-muted)] text-xs">
            엑셀과 동일 조작 · Tab/Enter/방향키 셀 이동 · 미제출: <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)]">/</kbd>+Enter
          </span>
        </div>
      )}

      {!isEditMode && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">시험 점수 표시:</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="scoreDisplayMode" checked={scoreDisplayMode === "total"} onChange={() => setScoreDisplayMode("total")} className="cursor-pointer" />
            <span>합산</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="scoreDisplayMode" checked={scoreDisplayMode === "breakdown"} onChange={() => setScoreDisplayMode("breakdown")} className="cursor-pointer" />
            <span>객관식 + 주관식</span>
          </label>
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
