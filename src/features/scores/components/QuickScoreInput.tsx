// PATH: src/features/scores/components/QuickScoreInput.tsx
/**
 * 빠른 점수 입력 UI
 * - 95, 95%, 16/64 같은 입력을 지원 (편의 기능)
 * - 실제 판정(passed)은 서버 PATCH 결과 단일 진실
 */

import React, { useMemo, useState } from "react";

type Props = {
  defaultValue: number | null;
  maxScore?: number | null;

  disabled?: boolean;
  disabledReason?: string;

  onSubmit: (score: number) => Promise<void>;
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

const QuickScoreInput = React.forwardRef<HTMLInputElement, Props>(
  function QuickScoreInput(
    {
      defaultValue,
      maxScore,
      disabled,
      disabledReason,
      onSubmit,
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

    const commit = async () => {
      const parsed = parseScore(value, maxScore);
      if (parsed == null) return;

      try {
        setSaving(true);
        await onSubmit(parsed);
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
          if (!disabled) void commit();
        }}
        onKeyDown={async (e) => {
          if (disabled) return;

          if (e.key === "Enter") {
            e.preventDefault();
            await commit();
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
            : "Enter/blur 저장 · 95% / 16/64 입력 가능"
        }
      />
    );
  }
);

export default QuickScoreInput;
