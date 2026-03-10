// PATH: src/features/homework/components/HomeworkPolicyCard.tsx
/**
 * HomeworkPolicyCard
 *
 * - 시험 정책(ExamPolicyPanel)과 커트라인 영역 사이즈/레이아웃 일치
 * - 숫자 입력 시 앞에 0이 표시되지 않도록 parseInt 정규화
 */

import { useEffect, useMemo, useState } from "react";
import type { HomeworkPolicy, HomeworkCutlineMode } from "../types";

type PatchPayload = Partial<
  Pick<HomeworkPolicy, "cutline_mode" | "cutline_value" | "round_unit_percent">
>;

export default function HomeworkPolicyCard({
  policy,
  onPatch,
  isPatching,
}: {
  policy: HomeworkPolicy | null;
  onPatch: (payload: PatchPayload) => void;
  isPatching: boolean;
}) {
  const canEdit = !!policy && !isPatching;

  const [mode, setMode] = useState<HomeworkCutlineMode>(
    policy?.cutline_mode ?? "PERCENT"
  );
  const [cutlineValue, setCutlineValue] = useState<number>(
    policy?.cutline_value ?? 80
  );
  const [roundUnit, setRoundUnit] = useState<number>(
    policy?.round_unit_percent ?? 5
  );

  function normalizeCutlineValue(
    raw: number | string | undefined,
    nextMode: HomeworkCutlineMode
  ): number {
    const n = parseInt(String(raw ?? 0), 10);
    if (!Number.isFinite(n)) return 0;
    if (nextMode === "PERCENT") return Math.max(0, Math.min(100, n));
    return Math.max(0, n);
  }

  function normalizeRoundUnit(raw: number | string | undefined): number {
    const n = parseInt(String(raw ?? 5), 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 5;
  }

  useEffect(() => {
    setMode(policy?.cutline_mode ?? "PERCENT");
    setCutlineValue(normalizeCutlineValue(policy?.cutline_value ?? 80, policy?.cutline_mode ?? "PERCENT"));
    setRoundUnit(normalizeRoundUnit(policy?.round_unit_percent ?? 5));
  }, [
    policy?.id,
    policy?.cutline_mode,
    policy?.cutline_value,
    policy?.round_unit_percent,
  ]);

  const dirty = useMemo(() => {
    if (!policy) return false;
    return (
      mode !== policy.cutline_mode ||
      cutlineValue !== policy.cutline_value ||
      roundUnit !== policy.round_unit_percent
    );
  }, [policy, mode, cutlineValue, roundUnit]);

  const clampCutline = (v: number, nextMode: HomeworkCutlineMode) => {
    if (!Number.isFinite(v)) return 0;
    if (nextMode === "PERCENT") return Math.max(0, Math.min(100, v));
    return Math.max(0, v);
  };

  if (!policy) {
    return (
      <div className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)] p-3 text-sm text-[var(--color-text-muted)]">
        ⚠️ 이 세션의 과제 정책이 아직 없습니다.
        <div className="mt-1 text-xs">
          - 정책 생성은 백엔드에서만 가능합니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 커트라인 기준 — 시험 정책과 동일 레이블 스타일 */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-[var(--text-muted)]">
          커트라인 기준
        </div>

        <div
          className="ds-segment"
          role="group"
          aria-label="커트라인 기준"
        >
          <button
            type="button"
            disabled={!canEdit}
            aria-pressed={mode === "PERCENT"}
            onClick={() => {
              const nextMode: HomeworkCutlineMode = "PERCENT";
              setMode(nextMode);
              setCutlineValue((prev) => clampCutline(prev, nextMode));
            }}
            className="ds-segment__btn"
          >
            퍼센트 (%)
          </button>
          <button
            type="button"
            disabled={!canEdit}
            aria-pressed={mode === "COUNT"}
            onClick={() => {
              const nextMode: HomeworkCutlineMode = "COUNT";
              setMode(nextMode);
              setCutlineValue((prev) => clampCutline(prev, nextMode));
            }}
            className="ds-segment__btn"
          >
            문항 수
          </button>
        </div>
      </div>

      {/* 커트라인 값 · 반올림 단위 — 시험 정책과 동일 입력 영역( w-[180px], border, px-3 py-2 ) */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1 text-sm text-[var(--text-muted)]">커트라인 값</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={mode === "PERCENT" ? 100 : undefined}
              step={1}
              className="w-[180px] rounded border border-[var(--border-divider)] px-3 py-2 text-4xl font-bold bg-[var(--bg-app)] text-[var(--text-primary)]"
              value={cutlineValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setCutlineValue(0);
                  return;
                }
                const num = parseInt(v, 10);
                setCutlineValue(clampCutline(Number.isFinite(num) ? num : 0, mode));
              }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v === "") return;
                const num = parseInt(v, 10);
                if (Number.isFinite(num)) setCutlineValue(clampCutline(num, mode));
              }}
              disabled={!canEdit}
              placeholder="입력"
              aria-label="커트라인 값"
            />
            <span className="text-sm text-[var(--text-muted)]">
              {mode === "PERCENT" ? "%" : "문항"}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1 text-sm text-[var(--text-muted)]">반올림 단위</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              className="w-[180px] rounded border border-[var(--border-divider)] px-3 py-2 text-sm bg-[var(--bg-app)] text-[var(--text-primary)]"
              value={roundUnit}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return;
                const num = parseInt(v, 10);
                setRoundUnit(Number.isFinite(num) ? Math.max(1, Math.min(50, num)) : 5);
              }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v === "") return;
                const num = parseInt(v, 10);
                if (Number.isFinite(num)) setRoundUnit(Math.max(1, Math.min(50, num)));
              }}
              disabled={!canEdit || mode !== "PERCENT"}
              aria-label="반올림 단위"
            />
            <span className="text-sm text-[var(--text-muted)]">%</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="ds-button disabled:opacity-50"
          data-intent="primary"
          data-size="sm"
          disabled={!canEdit || !dirty}
          onClick={() => {
            onPatch({
              cutline_mode: mode,
              cutline_value: cutlineValue,
              round_unit_percent: roundUnit,
            });
          }}
        >
          {isPatching ? "저장 중..." : "정책 저장"}
        </button>
      </div>
    </div>
  );
}
