// PATH: src/features/scores/components/InlineExamItemsRow.tsx
/**
 * 시험 서술형 문항 인라인 빠른 입력 Row
 * - 테이블 내부 확장(선택된 학생 아래)
 * - results API 소비 (READ/WRITE)
 * - 키보드 연속 입력 전용:
 *   - Enter 저장 후 다음 칸 자동 이동
 *   - ←/→ 이동 지원
 */

import { useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEditableExamItems } from "../api/fetchEditableExamItems";
import ScoreInputCell from "./ScoreInputCell";

type Props = {
  examId: number;
  enrollmentId: number;
  colSpan?: number;
  /** 'table' = tr/td (기존), 'block' = div만 (그리드 확장행용) */
  variant?: "table" | "block";
};

export default function InlineExamItemsRow({
  examId,
  enrollmentId,
  colSpan = 1,
  variant = "table",
}: Props) {
  const qc = useQueryClient();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["exam-items", examId, enrollmentId],
    queryFn: () => fetchEditableExamItems({ examId, enrollmentId }),
    enabled: Number.isFinite(examId) && examId > 0 && Number.isFinite(enrollmentId) && enrollmentId > 0,
  });

  const list = useMemo(() => items ?? [], [items]);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const focusAt = (idx: number) => {
    const el = inputRefs.current[idx];
    if (el) el.focus();
  };

  if (isLoading) {
    return (
      <div className="text-xs text-[var(--color-text-muted)]">
        문항 불러오는 중…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-xs text-[var(--color-text-muted)]">
        문항 점수 입력을 사용할 수 없습니다. (제출/결과 데이터가 없을 수 있습니다)
      </div>
    );
  }

  if (!list || list.length === 0) {
    return (
      <div className="text-xs text-[var(--color-text-muted)]">
        편집 가능한 문항이 없습니다.
      </div>
    );
  }

  const inner = (
    <>
      <div className="flex flex-wrap gap-2">
        {list.map((it, i) => {
          const disabled = !it.is_editable || it.is_locked;

          return (
            <div
              key={it.question_id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-all"
              style={{
                borderColor: disabled
                  ? "var(--color-border-divider)"
                  : "var(--color-border-divider-strong)",
                background: disabled
                  ? "var(--color-bg-surface-soft)"
                  : "var(--color-bg-surface)",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-title)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Q{it.question_id}
              </span>

              <ScoreInputCell
                examId={it.exam_id}
                enrollmentId={it.enrollment_id}
                questionId={it.question_id}
                value={it.score}
                maxScore={it.max_score}
                disabled={disabled}
                inputRef={(el) => {
                  inputRefs.current[i] = el;
                }}
                onMovePrev={() => focusAt(Math.max(0, i - 1))}
                onMoveNext={() => focusAt(Math.min(list.length - 1, i + 1))}
                onSaved={() => {
                  qc.invalidateQueries({
                    queryKey: ["exam-items", examId, enrollmentId],
                  });
                  qc.invalidateQueries({ queryKey: ["session-scores"] });
                }}
              />
              {disabled && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--color-text-muted)",
                    fontStyle: "italic",
                  }}
                >
                  {it.is_locked ? "잠김" : "편집 불가"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div
        className="mt-2"
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--color-text-muted)",
          fontWeight: "var(--font-meta)",
        }}
      >
        💡 Enter 저장 · ←/→ 이동 · 객관식/주관식 모두 수동 채점 가능
      </div>
    </>
  );

  if (variant === "block") {
    return <div>{inner}</div>;
  }

  return (
    <tr
      style={{
        background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
      }}
    >
      <td colSpan={colSpan} style={{ padding: "var(--space-4)" }}>
        {inner}
      </td>
    </tr>
  );
}
