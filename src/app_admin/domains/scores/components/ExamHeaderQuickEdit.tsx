/**
 * ExamHeaderQuickEdit
 *
 * 성적탭 시험 컬럼 헤더에 인라인 max_score/pass_score 편집.
 * ⚙ 버튼 클릭 → 작은 popover에서 만점·커트라인 수정 → 저장.
 * 학원장 피드백: "이미 설정된 시험의 총점 수정이 용이해야 함. 드로어에서 가능해도 OK".
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/ui/feedback/feedback";
import { updateAdminExam } from "@admin/domains/exams/api/adminExam";
import { scoresQueryKeys } from "../api/queryKeys";

type Props = {
  examId: number;
  examTitle: string;
  initialMaxScore: number | null;
  initialPassScore: number | null;
  sessionId: number;
};

export default function ExamHeaderQuickEdit({
  examId,
  examTitle,
  initialMaxScore,
  initialPassScore,
  sessionId,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [maxScore, setMaxScore] = useState<number | "">(initialMaxScore ?? 100);
  const [passScore, setPassScore] = useState<number | "">(initialPassScore ?? 0);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMaxScore(initialMaxScore ?? 100);
    setPassScore(initialPassScore ?? 0);
  }, [initialMaxScore, initialPassScore]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const saveMut = useMutation({
    mutationFn: () => {
      const ms = typeof maxScore === "number" ? maxScore : 100;
      const ps = typeof passScore === "number" ? passScore : 0;
      if (ps > ms) throw new Error(`커트라인(${ps})이 만점(${ms})보다 클 수 없습니다.`);
      return updateAdminExam(examId, { max_score: ms, pass_score: ps });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
      await qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      feedback.success(`${examTitle} 점수 설정 저장됨`);
      setOpen(false);
    },
    onError: (e: any) => {
      feedback.error(e?.message || e?.response?.data?.detail || "저장 실패");
    },
  });

  return (
    <span className="relative inline-flex" ref={popRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="text-[11px] leading-none px-1 py-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-bg-surface-hover)]"
        title="만점/커트라인 빠른 수정"
        aria-label={`${examTitle} 만점/커트라인 편집`}
      >
        ⚙
      </button>
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-3 shadow-lg whitespace-nowrap"
          style={{ minWidth: 220 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-2 truncate">
            {examTitle}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-[var(--color-text-muted)] w-12">만점</label>
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { setMaxScore(""); return; }
                const n = parseInt(v, 10);
                setMaxScore(Number.isFinite(n) ? n : "");
              }}
              className="ds-input w-20 text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-[var(--color-text-muted)] w-12">커트라인</label>
            <input
              type="number"
              min={0}
              value={passScore}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { setPassScore(""); return; }
                const n = parseInt(v, 10);
                setPassScore(Number.isFinite(n) ? n : "");
              }}
              className="ds-input w-20 text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="ds-button"
              data-intent="ghost"
              data-size="sm"
              onClick={() => setOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="ds-button"
              data-intent="primary"
              data-size="sm"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
