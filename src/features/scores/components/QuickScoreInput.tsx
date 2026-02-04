// PATH: src/features/scores/components/QuickScoreInput.tsx
/**
 * 빠른 점수 입력 UI
 *
 * 확장:
 * - "/" + Enter → 미제출 (status=NOT_SUBMITTED)
 */

import React, { useMemo, useState } from "react";

type Props = {
  defaultValue: number | null;
  maxScore?: number | null;

  disabled?: boolean;
  disabledReason?: string;

  onSubmitScore: (score: number) => Promise<void>;
  onSubmitNotSubmitted: () => Promise<void>;

  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

const QuickScoreInput = React.forwardRef<HTMLInputElement, Props>(
  function QuickScoreInput(
    {
      defaultValue,
      maxScore,
      disabled,
      disabledReason,
      onSubmitScore,
      onSubmitNotSubmitted,
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
      const n = Number(value);
      if (!Number.isFinite(n)) return;

      try {
        setSaving(true);
        await onSubmitScore(n);
      } finally {
        setSaving(false);
      }
    };

    const commitNotSubmitted = async () => {
      try {
        setSaving(true);
        await onSubmitNotSubmitted();
        setValue(""); // UX: 입력 초기화
      } finally {
        setSaving(false);
      }
    };

    return (
      <input
        ref={ref}
        className={[
          "w-20 rounded border px-1 py-0.5 text-xs",
          disabled
            ? "bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
            : "bg-[var(--bg-surface)] text-[var(--text-primary)]",
        ].join(" ")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={async (e) => {
          if (disabled) return;

          // ✅ "/" → 미제출
          if (e.key === "/") {
            e.preventDefault();
            setValue("/");
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();

            if (value.trim() === "/") {
              await commitNotSubmitted();
              return;
            }

            await commitScore();
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            onMoveUp?.();
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            onMoveDown?.();
          }
        }}
        disabled={disabled || saving}
        title={
          disabled
            ? disabledReason ?? "편집 불가"
            : "숫자+Enter: 점수 · '/' + Enter: 미제출"
        }
      />
    );
  }
);

export default QuickScoreInput;
