// PATH: src/features/homework/components/HomeworkPolicyCard.tsx
/**
 * HomeworkPolicyCard
 *
 * ⚠️ 로직 / 상태 / API 변경 없음
 * ✅ 전역 디자인 토큰 적용만 수행
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
      {/* 커트라인 기준 */}
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

      {/* 값 설정 */}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
            커트라인 값
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={mode === "PERCENT" ? 100 : undefined}
              className="w-full rounded-lg border border-[var(--color-border-divider)] px-3 py-2 text-sm bg-[var(--color-bg-app)] text-[var(--color-text-primary)]"
              value={Number.isFinite(cutlineValue) ? cutlineValue : 0}
              onChange={(e) =>
                setCutlineValue(
                  clampCutline(Number(e.target.value), mode)
                )
              }
              disabled={!canEdit}
            />
            <span className="text-xs text-[var(--color-text-muted)]">
              {mode === "PERCENT" ? "%" : "문항"}
            </span>
          </div>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
            반올림 단위
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              className="w-full rounded-lg border border-[var(--color-border-divider)] px-3 py-2 text-sm bg-[var(--color-bg-app)] text-[var(--color-text-primary)]"
              value={Number.isFinite(roundUnit) ? roundUnit : 5}
              onChange={(e) =>
                setRoundUnit(Math.max(1, Number(e.target.value)))
              }
              disabled={!canEdit || mode !== "PERCENT"}
            />
            <span className="text-xs text-[var(--color-text-muted)]">%</span>
          </div>
        </label>
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
