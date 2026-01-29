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
    setCutlineValue(policy?.cutline_value ?? 80);
    setRoundUnit(policy?.round_unit_percent ?? 5);
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

  const helperText = useMemo(() => {
    if (mode === "COUNT") return "예: 40문항 이상 통과";
    return `예: 70% (반올림 단위 ${roundUnit}% 적용)`;
  }, [mode, roundUnit]);

  if (!policy) {
    return (
      <div className="rounded border bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-muted)]">
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
        <div className="text-sm font-medium text-[var(--text-secondary)]">
          커트라인 기준
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              const nextMode: HomeworkCutlineMode = "PERCENT";
              setMode(nextMode);
              setCutlineValue((prev) => clampCutline(prev, nextMode));
            }}
            className={[
              "rounded border px-3 py-2 text-sm",
              mode === "PERCENT"
                ? "border-[var(--color-primary)] bg-[var(--bg-surface-soft)] font-semibold text-[var(--color-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]",
              !canEdit ? "opacity-50" : "",
            ].join(" ")}
          >
            퍼센트 (%)
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              const nextMode: HomeworkCutlineMode = "COUNT";
              setMode(nextMode);
              setCutlineValue((prev) => clampCutline(prev, nextMode));
            }}
            className={[
              "rounded border px-3 py-2 text-sm",
              mode === "COUNT"
                ? "border-[var(--color-primary)] bg-[var(--bg-surface-soft)] font-semibold text-[var(--color-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]",
              !canEdit ? "opacity-50" : "",
            ].join(" ")}
          >
            문항 수
          </button>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          {helperText}
        </div>
      </div>

      {/* 값 설정 */}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
            커트라인 값
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={mode === "PERCENT" ? 100 : undefined}
              className="w-full rounded border px-3 py-2 text-sm bg-[var(--bg-app)]"
              value={Number.isFinite(cutlineValue) ? cutlineValue : 0}
              onChange={(e) =>
                setCutlineValue(
                  clampCutline(Number(e.target.value), mode)
                )
              }
              disabled={!canEdit}
            />
            <span className="text-xs text-[var(--text-muted)]">
              {mode === "PERCENT" ? "%" : "문항"}
            </span>
          </div>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
            반올림 단위
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              className="w-full rounded border px-3 py-2 text-sm bg-[var(--bg-app)]"
              value={Number.isFinite(roundUnit) ? roundUnit : 5}
              onChange={(e) =>
                setRoundUnit(Math.max(1, Number(e.target.value)))
              }
              disabled={!canEdit || mode !== "PERCENT"}
            />
            <span className="text-xs text-[var(--text-muted)]">%</span>
          </div>
        </label>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-[var(--text-muted)]">
          ※ 판정은 서버 결과만 표시
        </div>

        <button
          type="button"
          className="btn disabled:opacity-50"
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
