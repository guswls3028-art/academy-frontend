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

import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionParams } from "../hooks/useSessionParams";
import SessionScoresPanel, { type SessionScoresPanelHandle } from "@/features/scores/panels/SessionScoresPanel";
import { useScoreEditDraft } from "@/features/scores/hooks/useScoreEditDraft";
import { postScoreDraftCommit } from "@/features/scores/api/scoreDraft";
import { scoresQueryKeys } from "@/features/scores/api/queryKeys";
import { downloadClinicPdf, getClinicStats } from "@/features/scores/utils/clinicPdfGenerator";
import { generateScoreReport, buildScoreDetail, substituteScoreVars } from "@/features/scores/utils/generateScoreReport";
import { fetchMessageTemplates } from "@/features/messages/api/messages.api";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import NotificationPreviewModal from "@/features/messages/components/NotificationPreviewModal";
import type { SessionScoresResponse } from "@/features/scores/api/sessionScores";

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
  const [scoreNotifModal, setScoreNotifModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfSchedule, setPdfSchedule] = useState("");
  const panelRef = useRef<SessionScoresPanelHandle>(null);
  const { openSendMessageModal } = useSendMessageModal();

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

  function getAttendanceMap(): Record<number, string> | undefined {
    const raw = qc.getQueryData(scoresQueryKeys.attendance(numericSessionId));
    if (!raw) return undefined;
    const list = Array.isArray(raw) ? raw : (raw as { results?: unknown[] })?.results ?? [];
    const map: Record<number, string> = {};
    for (const item of list as { enrollment_id?: number; enrollment?: number; status?: string }[]) {
      const eid = item.enrollment_id ?? item.enrollment;
      if (eid != null && item.status) map[eid] = item.status.toLowerCase();
    }
    return map;
  }

  function getPdfContext() {
    const scoresData = qc.getQueryData<SessionScoresResponse>(
      scoresQueryKeys.sessionScores(numericSessionId),
    );
    if (!scoresData) return null;
    const session = qc.getQueryData<{ title?: string; date?: string }>(["session", sessionId]);
    const lecture = qc.getQueryData<{ title?: string; name?: string }>(["lecture", lectureId]);
    return {
      rows: scoresData.rows,
      meta: scoresData.meta,
      sessionTitle: session?.title ?? "",
      lectureTitle: lecture?.title ?? lecture?.name ?? "",
      date: session?.date ?? undefined,
      attendanceMap: getAttendanceMap(),
    };
  }

  function handleOpenPdfModal() {
    const ctx = getPdfContext();
    if (!ctx) return;
    setShowPdfModal(true);
  }

  function handleGeneratePdf() {
    const ctx = getPdfContext();
    if (!ctx) return;
    downloadClinicPdf({ ...ctx, schedule: pdfSchedule || undefined });
    setShowPdfModal(false);
  }

  /** 체크박스 선택 학생 → 성적 발송 */
  const handleBulkScoreSend = useCallback(async () => {
    if (selectedIds.length === 0) return;
    const scoresData = qc.getQueryData<SessionScoresResponse>(
      scoresQueryKeys.sessionScores(numericSessionId),
    );
    if (!scoresData) return;
    const selectedRows = scoresData.rows.filter(
      (r) => selectedIds.includes(r.enrollment_id),
    );
    const studentIds = selectedRows
      .map((r) => r.student_id)
      .filter((id): id is number => id != null);
    if (studentIds.length === 0) return;

    const lecture = qc.getQueryData<{ title?: string; name?: string }>(["lecture", lectureId]);
    const lectureName = lecture?.title ?? lecture?.name ?? "";
    const session = qc.getQueryData<{ title?: string }>(["session", sessionId]);
    const sessionTitle = session?.title ?? "";
    const reportOptions = { lectureName, sessionTitle };

    // 성적 카테고리 템플릿이 있으면 템플릿 기반 치환, 없으면 기본 생성
    let initialBody: string | undefined;
    if (selectedRows.length === 1) {
      try {
        const templates = await fetchMessageTemplates("grades");
        // 사용자 커스텀 템플릿 우선, 없으면 기본 생성
        const customTpl = templates.find((t) => !t.name.startsWith("[학원플러스]"));
        if (customTpl) {
          initialBody = substituteScoreVars(customTpl.body, selectedRows[0], scoresData.meta, reportOptions);
        } else {
          initialBody = generateScoreReport(selectedRows[0], scoresData.meta, reportOptions);
        }
      } catch {
        initialBody = generateScoreReport(selectedRows[0], scoresData.meta, reportOptions);
      }
    }

    const scoreDetail = selectedRows.length === 1
      ? buildScoreDetail(selectedRows[0], scoresData.meta)
      : "";

    openSendMessageModal({
      studentIds,
      recipientLabel: `선택한 학생 ${studentIds.length}명 성적 발송`,
      blockCategory: "grades",
      initialBody,
      alimtalkExtraVars: {
        강의명: lectureName,
        차시명: sessionTitle,
        시험성적: scoreDetail,
      },
    });
  }, [selectedIds, numericSessionId, lectureId, qc, openSendMessageModal]);

  const editTypes: { key: keyof EditConfig; label: string }[] = [
    { key: "examEditTotal", label: "합산" },
    { key: "examEditSubjective", label: "주관식만" },
    { key: "homeworkEdit", label: "과제" },
  ];

  const segmentBtn = (active: boolean) => [
    "h-8 rounded px-2.5 text-xs font-medium transition-colors",
    active
      ? "bg-[var(--color-primary)] text-white"
      : "border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text-primary)]",
  ].join(" ");

  return (
    <div className="flex flex-col gap-2">
      {/* ── 통합 툴바 ── */}
      <div
        className={[
          "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2",
          "border bg-[var(--color-bg-surface)]",
          isEditMode
            ? "border-[var(--color-brand-primary)] shadow-[0_0_0_1px_var(--color-brand-primary)]"
            : "border-[var(--color-border-divider)]",
        ].join(" ")}
      >
        {/* 좌측: 보기/편집 옵션 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditMode ? (
            <div className="flex items-center gap-1">
              {editTypes.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => handleEditTypeClick(key)} className={segmentBtn(editConfig[key])}>
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {(["total", "breakdown"] as ScoreDisplayMode[]).map((mode) => (
                <button key={mode} type="button" onClick={() => setScoreDisplayMode(mode)} className={segmentBtn(scoreDisplayMode === mode)}>
                  {mode === "total" ? "합산" : "세부"}
                </button>
              ))}
            </div>
          )}

          <div className="h-5 w-px bg-[var(--color-border-divider)]" />

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 검색..."
            className={[
              "h-8 rounded border px-2.5 text-sm transition-colors",
              "border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:border-[var(--color-brand-primary)] focus:outline-none",
              "w-[160px] min-w-[100px]",
            ].join(" ")}
          />

          {/* 편집 모드 드래프트 상태 */}
          {isEditMode && (
            <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
              {draft.draftStatus === "saving" && "임시저장 중..."}
              {draft.draftStatus === "saved" && draft.lastSavedAt != null && (
                `임시저장됨 · ${Math.max(0, Math.floor((Date.now() - draft.lastSavedAt) / 1000))}초 전`
              )}
              {draft.draftStatus === "error" && (
                <>
                  <span className="text-[var(--color-error)]">임시저장 실패</span>
                  {" "}
                  <button type="button" className="underline text-[var(--color-brand-primary)]" onClick={() => void draft.performSave()}>
                    다시 시도
                  </button>
                </>
              )}
              {draft.draftStatus === "idle" && ""}
            </span>
          )}
        </div>

        {/* 우측: 액션 버튼 */}
        <div className="flex items-center gap-2">
          {/* 성적 알림 수동 발송 */}
          {!isEditMode && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setScoreNotifModal(true)}
              className="h-8 rounded-lg px-3 text-xs font-semibold border border-[var(--color-border-divider)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-soft)] transition-colors whitespace-nowrap"
            >
              성적 알림 발송
            </button>
          )}
          {!isEditMode && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkScoreSend}
              className="h-8 rounded-lg px-3 text-xs font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
              성적 발송 ({selectedIds.length})
            </button>
          )}
          {!isEditMode && (
            <button
              type="button"
              onClick={handleOpenPdfModal}
              className="h-8 rounded-lg px-3 text-xs font-semibold border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors whitespace-nowrap"
            >
              클리닉 대상 보기
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleEditMode}
            className={[
              "h-8 rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap",
              isEditMode
                ? "bg-[var(--color-brand-primary)] text-white shadow-sm hover:opacity-90"
                : "border-2 border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/8 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)] hover:text-white",
            ].join(" ")}
          >
            {isEditMode ? "✓ 편집 종료" : "편집 모드"}
          </button>
        </div>
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

      {/* ── PDF 생성 모달 ── */}
      {showPdfModal && (() => {
        const ctx = getPdfContext();
        const stats = ctx ? getClinicStats(ctx.rows, ctx.meta, ctx.attendanceMap) : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-modal-title"
          >
            <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg p-6 max-w-md w-full mx-4 border border-[var(--color-border-divider)]">
              <h2 id="pdf-modal-title" className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
                성적 현황 PDF 생성
              </h2>

              {stats && (
                <div className="flex gap-3 mb-4 text-sm">
                  <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                    <div className="text-emerald-700 font-bold text-lg">{stats.passedCount}</div>
                    <div className="text-emerald-600 text-xs font-medium">통과</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <div className="text-red-700 font-bold text-lg">{stats.clinicCount}</div>
                    <div className="text-red-600 text-xs font-medium">클리닉 대상</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                    <div className="text-gray-700 font-bold text-lg">{stats.totalPresent}</div>
                    <div className="text-gray-500 text-xs font-medium">현장 출석</div>
                  </div>
                </div>
              )}

              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                클리닉 시간표 (선택)
              </label>
              <textarea
                value={pdfSchedule}
                onChange={(e) => setPdfSchedule(e.target.value)}
                placeholder={"예) 금 17~22시\n토 13~22시\n일 15~22시"}
                rows={3}
                className={[
                  "w-full rounded border px-3 py-2 text-sm",
                  "border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]",
                  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                  "focus:border-[var(--color-brand-primary)] focus:outline-none resize-none",
                ].join(" ")}
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-4">
                입력하면 PDF 하단에 클리닉 시간표가 표시됩니다.
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="h-9 px-4 rounded text-sm font-medium border border-[var(--color-border-divider)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-soft)]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  className="h-9 px-4 rounded text-sm font-medium bg-[var(--color-brand-primary)] text-white hover:opacity-90"
                >
                  PDF 생성
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 편집 모드 안내 ── */}
      {isEditMode && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-xs border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] text-[var(--color-text-secondary)]"
        >
          <span><kbd className="score-help-kbd">숫자</kbd> + <kbd className="score-help-kbd">Enter</kbd> 점수 입력</span>
          <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
          <span><kbd className="score-help-kbd">/</kbd> + <kbd className="score-help-kbd">Enter</kbd> 미제출 처리 (과제)</span>
          <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
          <span><kbd className="score-help-kbd">Tab</kbd> 다음 칸 · <kbd className="score-help-kbd">Enter</kbd> 다음 학생</span>
          <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
          <span><kbd className="score-help-kbd">Esc</kbd> 입력 취소</span>
          <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
          <span><kbd className="score-help-kbd">80%</kbd> → 배점 비율 자동 계산</span>
        </div>
      )}

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

      {/* 성적 수동 발송 모달 */}
      <NotificationPreviewModal
        open={scoreNotifModal}
        onClose={() => setScoreNotifModal(false)}
        mode="manual"
        trigger="exam_score_published"
        studentIds={selectedIds}
        label="성적 공개 알림"
        sendTo="parent"
      />
    </div>
  );
}
