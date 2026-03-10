// PATH: src/features/sessions/components/SessionScoresTab.tsx
/**
 * SessionScoresTab
 *
 * 책임:
 * - sessions 탭에서 scores 도메인 화면을 연결
 * - Excel-like 편집 모드 툴바 제공 (편집 타입 선택, 검색, 표시 방식)
 *
 * 원칙:
 * - sessionId는 useSessionParams에서 직접 획득
 * - 편집 모드 상태는 이 컴포넌트에서 관리
 * - scores 도메인의 SessionScoresPanel이 실제 렌더링 단일 진실
 */

import { useState, useRef } from "react";
import { useSessionParams } from "../hooks/useSessionParams";
import SessionScoresPanel, { type SessionScoresPanelHandle } from "@/features/scores/panels/SessionScoresPanel";

type EditConfig = {
  examEditTotal: boolean;
  examEditObjective: boolean;
  examEditSubjective: boolean;
  homeworkEdit: boolean;
};

const DEFAULT_EDIT_CONFIG: EditConfig = {
  examEditTotal: true,
  examEditObjective: false,
  examEditSubjective: false,
  homeworkEdit: true,
};

type ScoreDisplayMode = "total" | "breakdown";

export default function SessionScoresTab() {
  const { sessionId } = useSessionParams();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editConfig, setEditConfig] = useState<EditConfig>(DEFAULT_EDIT_CONFIG);
  const [scoreDisplayMode, setScoreDisplayMode] = useState<ScoreDisplayMode>("total");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const panelRef = useRef<SessionScoresPanelHandle>(null);

  if (!sessionId) {
    return (
      <div className="text-sm text-red-600">
        잘못된 sessionId
      </div>
    );
  }

  function handleToggleEditMode() {
    if (isEditMode) {
      // 편집 종료: 대기 중인 변경 한 번에 저장 후 모드 해제
      void panelRef.current?.flushPendingChanges?.().then(() => {
        setIsEditMode(false);
        setEditConfig(DEFAULT_EDIT_CONFIG);
      });
      return;
    }
    setIsEditMode(true);
    setEditConfig(DEFAULT_EDIT_CONFIG);
  }

  function handleEditTypeClick(type: keyof EditConfig) {
    setEditConfig((prev) => {
      // homeworkEdit은 독립적으로 토글
      if (type === "homeworkEdit") {
        return { ...prev, homeworkEdit: !prev.homeworkEdit };
      }

      // 합산 직접 입력: 객관식/주관식 OFF
      if (type === "examEditTotal") {
        const next = !prev.examEditTotal;
        return {
          ...prev,
          examEditTotal: next,
          examEditObjective: next ? false : prev.examEditObjective,
          examEditSubjective: next ? false : prev.examEditSubjective,
        };
      }

      // 객관식 또는 주관식: 합산 OFF
      if (type === "examEditObjective" || type === "examEditSubjective") {
        const next = !prev[type];
        return {
          ...prev,
          examEditTotal: next ? false : prev.examEditTotal,
          [type]: next,
        };
      }

      return prev;
    });
  }

  const editTypes: { key: keyof EditConfig; label: string }[] = [
    { key: "examEditTotal", label: "합산직접입력" },
    { key: "examEditObjective", label: "객관식" },
    { key: "examEditSubjective", label: "주관식" },
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
        {/* 편집 모드 토글 버튼 */}
        <button
          type="button"
          onClick={handleToggleEditMode}
          className={[
            "h-8 rounded px-3 text-sm font-medium transition-colors",
            isEditMode
              ? "bg-[var(--color-brand-primary)] text-white"
              : "border border-[var(--color-border-divider)] bg-transparent text-[var(--color-text-muted)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
          ].join(" ")}
        >
          편집 모드
        </button>

        {/* 구분선 */}
        <div className="h-5 w-px bg-[var(--color-border-divider)]" />

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
      </div>

      {/* ── Scores Panel ── */}
      <SessionScoresPanel
        sessionId={sessionId}
        search={search}
        isEditMode={isEditMode}
        examEditTotal={editConfig.examEditTotal}
        examEditObjective={editConfig.examEditObjective}
        examEditSubjective={editConfig.examEditSubjective}
        homeworkEdit={editConfig.homeworkEdit}
        scoreDisplayMode={scoreDisplayMode}
        selectedEnrollmentIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
