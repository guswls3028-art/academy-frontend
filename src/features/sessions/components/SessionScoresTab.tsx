// PATH: src/features/sessions/components/SessionScoresTab.tsx
/**
 * SessionScoresTab
 *
 * 책임:
 * - sessions 탭에서 scores 도메인 화면을 연결
 * - Excel-like 편집 모드 툴바 제공 (편집 타입 선택, 검색, 표시 방식)
 * - 편집 중 임시 저장(draft) 자동 저장·복원·상태 표시
 *
 * 원칙:
 * - sessionId는 useSessionParams에서 직접 획득
 * - 편집 모드 상태는 이 컴포넌트에서 관리
 * - scores 도메인의 SessionScoresPanel이 실제 렌더링 단일 진실
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionParams } from "../hooks/useSessionParams";
import SessionScoresPanel, { type SessionScoresPanelHandle } from "@/features/scores/panels/SessionScoresPanel";
import { useScoreEditDraft } from "@/features/scores/hooks/useScoreEditDraft";
import { postScoreDraftCommit } from "@/features/scores/api/scoreDraft";
import { fetchSessionScores } from "@/features/scores/api/sessionScores";
import { scoresQueryKeys } from "@/features/scores/api/queryKeys";
import { downloadClinicPdf } from "@/features/scores/utils/clinicPdfGenerator";

type EditConfig = {
  examEditTotal: boolean;
  examEditSubjective: boolean;
  homeworkEdit: boolean;
};

const DEFAULT_EDIT_CONFIG: EditConfig = {
  examEditTotal: true,
  examEditSubjective: false,
  homeworkEdit: true,
};

type ScoreDisplayMode = "total" | "breakdown";

export default function SessionScoresTab() {
  const { sessionId, lectureId } = useSessionParams();
  const qc = useQueryClient();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editConfig, setEditConfig] = useState<EditConfig>(DEFAULT_EDIT_CONFIG);
  const [scoreDisplayMode, setScoreDisplayMode] = useState<ScoreDisplayMode>("total");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const panelRef = useRef<SessionScoresPanelHandle>(null);

  const numericSessionId = sessionId != null ? Number(sessionId) : 0;
  const draft = useScoreEditDraft({
    sessionId: numericSessionId,
    panelRef,
    isEditMode: !!isEditMode && numericSessionId > 0,
  });

  // "n초 전" 갱신용
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isEditMode || draft.draftStatus !== "saved") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isEditMode, draft.draftStatus]);

  if (!sessionId) {
    return (
      <div className="text-sm text-red-600">
        잘못된 sessionId
      </div>
    );
  }

  function handleToggleEditMode() {
    if (isEditMode) {
      // 편집 종료: 최종 반영(flush) 후 draft 삭제(commit), 모드 해제
      void panelRef.current?.flushPendingChanges?.().then(async () => {
        try {
          await postScoreDraftCommit(numericSessionId);
        } finally {
          setIsEditMode(false);
          setEditConfig(DEFAULT_EDIT_CONFIG);
        }
      });
      return;
    }
    setIsEditMode(true);
    setEditConfig(DEFAULT_EDIT_CONFIG);
  }

  function handleEditTypeClick(type: keyof EditConfig) {
    setEditConfig((prev) => {
      if (type === "homeworkEdit") {
        return { ...prev, homeworkEdit: !prev.homeworkEdit };
      }
      if (type === "examEditTotal") {
        const next = !prev.examEditTotal;
        return {
          ...prev,
          examEditTotal: next,
          examEditSubjective: next ? false : prev.examEditSubjective,
        };
      }
      if (type === "examEditSubjective") {
        const next = !prev.examEditSubjective;
        return {
          ...prev,
          examEditSubjective: next,
          examEditTotal: next ? false : prev.examEditTotal,
        };
      }
      return prev;
    });
  }

  const editTypes: { key: keyof EditConfig; label: string }[] = [
    { key: "examEditTotal", label: "합산" },
    { key: "examEditSubjective", label: "주관식만" },
    { key: "homeworkEdit", label: "과제" },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* ── Toolbar ── */}
      <div
        className={[
          "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2",
          "border bg-[var(--color-bg-surface)]",
          isEditMode
            ? "border-[var(--color-brand-primary)] shadow-[0_0_0_1px_var(--color-brand-primary)]"
            : "border-[var(--color-border-divider)]",
        ].join(" ")}
      >
        {isEditMode ? (
          /* 편집 모드 ON: 편집 타입 세그먼트 버튼 */
          <div className="flex items-center gap-1">
            {editTypes.map(({ key, label }) => {
              const active = editConfig[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleEditTypeClick(key)}
                  className={[
                    "h-8 rounded px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : (
          /* 편집 모드 OFF: 표시 방식 토글 */
          <div className="flex items-center gap-1">
            {(["total", "breakdown"] as ScoreDisplayMode[]).map((mode) => {
              const active = scoreDisplayMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScoreDisplayMode(mode)}
                  className={[
                    "h-8 rounded px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  {mode === "total" ? "합산" : "세부"}
                </button>
              );
            })}
          </div>
        )}

        {/* 구분선 */}
        <div className="h-5 w-px bg-[var(--color-border-divider)]" />

        {/* 검색 입력 (항상 표시) */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 이름 검색..."
          className={[
            "h-8 rounded border px-2.5 text-sm transition-colors",
            "border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:border-[var(--color-brand-primary)] focus:outline-none",
            "w-[180px] min-w-[120px]",
          ].join(" ")}
        />

        {/* 편집 모드: 임시 저장 상태 */}
        {isEditMode && (
          <span className="text-xs text-[var(--color-text-muted)] ml-1">
            {draft.draftStatus === "saving" && "임시저장 중..."}
            {draft.draftStatus === "saved" && draft.lastSavedAt != null && (
              `임시저장됨 · ${Math.max(0, Math.floor((Date.now() - draft.lastSavedAt) / 1000))}초 전`
            )}
            {draft.draftStatus === "error" && (
              <>
                <span className="text-[var(--color-error)]">임시저장 실패</span>
                {" "}
                <button
                  type="button"
                  className="underline text-[var(--color-brand-primary)]"
                  onClick={() => void draft.performSave()}
                >
                  다시 시도
                </button>
              </>
            )}
            {draft.draftStatus === "idle" && (
              <span className="text-[var(--color-text-muted)]">저장 안 됨</span>
            )}
          </span>
        )}
      </div>

      {/* 복원 확인 모달 */}
      {draft.hasDraftToRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-restore-title"
        >
          <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg p-6 max-w-md mx-4 border border-[var(--color-border-divider)]">
            <h2 id="draft-restore-title" className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
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

      {/* ── 편집 모드 토글 + 클리닉 PDF (테이블 바로 위) ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggleEditMode}
          className={[
            "h-9 rounded-lg px-4 text-sm font-semibold transition-all",
            isEditMode
              ? "bg-[var(--color-brand-primary)] text-white shadow-sm hover:opacity-90"
              : "border-2 border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/8 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)] hover:text-white",
          ].join(" ")}
        >
          {isEditMode ? "✓ 편집 종료" : "편집 모드"}
        </button>
        {isEditMode && (
          <span className="text-xs text-[var(--color-text-muted)]">
            셀을 클릭하여 성적을 입력하세요
          </span>
        )}

        {!isEditMode && (
          <button
            type="button"
            onClick={() => {
              const scoresData = qc.getQueryData<import("@/features/scores/api/sessionScores").SessionScoresResponse>(
                scoresQueryKeys.sessionScores(numericSessionId),
              );
              if (!scoresData) return;
              const session = qc.getQueryData<{ title?: string; date?: string }>(["session", sessionId]);
              const lecture = qc.getQueryData<{ title?: string; name?: string }>(["lecture", lectureId]);
              downloadClinicPdf(
                scoresData.rows,
                scoresData.meta,
                session?.title ?? "",
                lecture?.title ?? lecture?.name ?? "",
                session?.date ?? undefined,
              );
            }}
            className="h-9 rounded-lg px-4 text-sm font-semibold border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            클리닉 대상자 PDF
          </button>
        )}
      </div>

      {/* ── Scores Panel ── */}
      <SessionScoresPanel
        ref={panelRef}
        sessionId={sessionId}
        search={search}
        isEditMode={isEditMode}
        examEditTotal={editConfig.examEditTotal}
        examEditObjective={false}
        examEditSubjective={editConfig.examEditSubjective}
        homeworkEdit={editConfig.homeworkEdit}
        scoreDisplayMode={scoreDisplayMode}
        selectedEnrollmentIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
