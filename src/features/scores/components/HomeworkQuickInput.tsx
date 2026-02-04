// PATH: src/features/scores/components/HomeworkQuickInput.tsx
/**
 * HomeworkQuickInput
 * - QuickScoreInput과 동일 UX + 최소 확장
 * - `/ + Enter` → meta.status = "NOT_SUBMITTED"
 * - (옵션) 빈 값 + Enter → meta.status 해제 + score null (미입력)
 *
 * ⚠️ 판정/계산 금지: 서버 응답만 신뢰
 */

import React, { useMemo, useState } from "react";

type Props = {
  defaultValue: number | null;
  maxScore?: number | null;

  disabled?: boolean;
  disabledReason?: string;

  // ✅ score 저장
  onSubmitScore: (score: number) => Promise<void>;

  // ✅ 미제출 저장
  onMarkNotSubmitted: () => Promise<void>;

  // ✅ 미제출 해제/미입력(선택)
  onClearStatus?: () => Promise<void>;

  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function parseScore(input: string, maxScore?: number | null): number | null {
  const v = input.trim();
  const hasMax =
    maxScore != null &&
    Number.isFinite(Number(maxScore)) &&
    Number(maxScore) > 0;

  if (v.endsWith("%") && hasMax) {
    const p = Number(v.slice(0, -1));
    if (Number.isFinite(p)) {
      return Math.round((p / 100) * Number(maxScore));
    }
  }

  if (v.includes("/") && hasMax) {
    const [aRaw, bRaw] = v.split("/");
    const a = Number(aRaw);
    const b = Number(bRaw);
    if (Number.isFinite(a) && Number.isFinite(b) && b > 0) {
      return Math.round((a / b) * Number(maxScore));
    }
  }

  const n = Number(v);
  if (Number.isFinite(n)) return n;

  return null;
}

const HomeworkQuickInput = React.forwardRef<HTMLInputElement, Props>(
  function HomeworkQuickInput(
    {
      defaultValue,
      maxScore,
      disabled,
      disabledReason,
      onSubmitScore,
      onMarkNotSubmitted,
      onClearStatus,
      onMoveUp,
      onMoveDown,
    },
    ref
  ) {
    const initial = useMemo(
      () => (defaultValue == null ? "" : String(defaultValue)),
      [defaultValue]
    );

    const [value, setValue] = useState(initial);
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
      setValue(initial);
    }, [initial]);

    const commitScore = async () => {
      const parsed = parseScore(value, maxScore);
      if (parsed == null) return;

      try {
        setSaving(true);
        await onSubmitScore(parsed);
      } finally {
        setSaving(false);
      }
    };

    const commitNotSubmitted = async () => {
      try {
        setSaving(true);
        await onMarkNotSubmitted();
      } finally {
        setSaving(false);
      }
    };

    const commitClear = async () => {
      if (!onClearStatus) return;
      try {
        setSaving(true);
        await onClearStatus();
      } finally {
        setSaving(false);
      }
    };

    return (
      <input
        ref={ref}
        className={[
          "w-20 rounded border px-1 py-0.5 text-xs",
          "border-[var(--border-default)]",
          disabled
            ? "bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
            : "bg-[var(--bg-surface)] text-[var(--text-primary)]",
        ].join(" ")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (disabled) return;
          void commitScore();
        }}
        onKeyDown={async (e) => {
          if (disabled) return;

          if (e.key === "Enter") {
            e.preventDefault();

            const trimmed = value.trim();

            // ✅ `/ + Enter` → 미제출
            if (trimmed === "/") {
              await commitNotSubmitted();
              return;
            }

            // ✅ 빈 값 + Enter → 상태 해제(선택)
            if (trimmed === "") {
              await commitClear();
              return;
            }

            await commitScore();
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            onMoveUp?.();
            return;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            onMoveDown?.();
            return;
          }
        }}
        disabled={disabled || saving}
        title={
          disabled
            ? disabledReason ?? "편집 불가"
            : "Enter/blur 저장 · 95% / 16/64 입력 가능 · `/ + Enter` 미제출"
        }
      />
    );
  }
);

export default HomeworkQuickInput;
