// PATH: src/features/scores/components/ScoreInputCell.tsx
/**
 * ✅ ScoreInputCell
 * - 인라인 점수 입력
 * - blur / Enter 시 즉시 저장
 * - (추가) Enter 저장 후 다음 셀로 이동 가능(onMoveNext)
 * - (추가) ArrowLeft/Right로 이전/다음 이동 가능(onMovePrev/onMoveNext)
 *
 * ⚠️ 단일진실: results PATCH 응답
 * - optimistic update 금지
 */

import { useEffect, useState } from "react";
import { patchExamItemScore } from "../api/patchItemScore";

type Props = {
  examId: number;
  enrollmentId: number;
  questionId: number;
  value: number | null;
  maxScore: number;
  disabled: boolean;
  onSaved: () => void;

  /** optional: 외부에서 focus 제어 */
  inputRef?: (el: HTMLInputElement | null) => void;

  /** optional: 키보드 연속 입력용 */
  onMovePrev?: () => void;
  onMoveNext?: () => void;
};

export default function ScoreInputCell({
  examId,
  enrollmentId,
  questionId,
  value,
  maxScore,
  disabled,
  onSaved,
  inputRef,
  onMovePrev,
  onMoveNext,
}: Props) {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const commit = async () => {
    if (disabled) return false;

    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0 || next > maxScore) {
      setDraft(value == null ? "" : String(value));
      return false;
    }

    try {
      setSaving(true);
      await patchExamItemScore({
        examId,
        enrollmentId,
        questionId,
        score: next,
      });
      onSaved();
      return true;
    } catch {
      setDraft(value == null ? "" : String(value));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      min={0}
      max={maxScore}
      value={draft}
      disabled={disabled || saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        void commit();
      }}
      onKeyDown={async (e) => {
        if (disabled) return;

        if (e.key === "Enter") {
          e.preventDefault();
          const ok = await commit();
          if (ok) onMoveNext?.();
          return;
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onMovePrev?.();
          return;
        }

        if (e.key === "ArrowRight") {
          e.preventDefault();
          onMoveNext?.();
          return;
        }
      }}
      className="rounded-lg border px-2 py-1.5 text-sm text-right font-medium transition-all"
      style={{
        width: 72,
        borderColor: disabled
          ? "var(--color-border-divider)"
          : "var(--color-border-divider-strong)",
        background: disabled
          ? "var(--color-bg-surface-soft)"
          : "var(--color-bg-surface)",
        color: disabled
          ? "var(--color-text-muted)"
          : "var(--color-text-primary)",
        cursor: disabled ? "not-allowed" : "text",
      }}
      title={
        disabled
          ? "채점 중이거나 편집 불가 상태"
          : "Enter 저장 · ←/→ 이동 · blur 저장 · 객관식/주관식 모두 지원"
      }
    />
  );
}
