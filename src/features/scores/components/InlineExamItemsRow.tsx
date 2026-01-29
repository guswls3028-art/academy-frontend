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
  colSpan: number;
};

export default function InlineExamItemsRow({ examId, enrollmentId, colSpan }: Props) {
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["exam-items", examId, enrollmentId],
    queryFn: () => fetchEditableExamItems({ examId, enrollmentId }),
    enabled: Number.isFinite(examId) && examId > 0 && Number.isFinite(enrollmentId) && enrollmentId > 0,
  });

  const list = useMemo(() => items ?? [], [items]);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  if (!list || list.length === 0) return null;

  const focusAt = (idx: number) => {
    const el = inputRefs.current[idx];
    if (el) el.focus();
  };

  return (
    <tr className="bg-[var(--bg-surface-soft)]">
      <td colSpan={colSpan} className="p-2">
        <div className="flex flex-wrap gap-2">
          {list.map((it, i) => {
            const disabled = !it.is_editable || it.is_locked;

            return (
              <div
                key={it.question_id}
                className={[
                  "flex items-center gap-1 rounded border px-2 py-1",
                  "border-[var(--border-divider)] bg-[var(--bg-surface)]",
                ].join(" ")}
              >
                <span className="text-xs text-muted">Q{it.question_id}</span>

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
                    // session-scores는 sessionId를 모르는 컴포넌트라 prefix로 invalidate
                    qc.invalidateQueries({
                      queryKey: ["session-scores"],
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}
