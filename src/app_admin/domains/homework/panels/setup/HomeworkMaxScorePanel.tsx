/**
 * HomeworkMaxScorePanel
 *
 * 과제 만점(max_score) 설정 — Homework.meta.default_max_score 편집.
 * 채점 시 입력된 raw 점수에 대해 백분율 계산 기준으로 사용됨.
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { useAdminHomework } from "../../hooks/useAdminHomework";
import { extractApiError } from "@/shared/utils/extractApiError";

export default function HomeworkMaxScorePanel({ homeworkId }: { homeworkId: number }) {
  const qc = useQueryClient();
  const { data: homework } = useAdminHomework(homeworkId);
  const homeworkRecordId = homework?.id;
  const homeworkDefaultMaxScore = homework?.default_max_score;

  const [maxScore, setMaxScore] = useState<number | "">("");
  const [savedMaxScore, setSavedMaxScore] = useState<number | "">("");

  useEffect(() => {
    if (!homeworkRecordId) return;
    const value = typeof homeworkDefaultMaxScore === "number" && homeworkDefaultMaxScore > 0
      ? homeworkDefaultMaxScore
      : 100;
    setMaxScore(value);
    setSavedMaxScore(value);
  }, [homeworkRecordId, homeworkDefaultMaxScore]);

  const isDirty = maxScore !== savedMaxScore;

  const patchMut = useMutation({
    mutationFn: async (next: number) => {
      const meta = { ...(homework?.meta ?? {}), default_max_score: next };
      await api.patch(`/homeworks/${homeworkId}/`, { meta });
    },
    onSuccess: async (_, next) => {
      await qc.invalidateQueries({ queryKey: ["admin-homework", homeworkId] });
      setSavedMaxScore(next);
      feedback.success(`만점이 ${next}점으로 저장되었습니다.`);
    },
    onError: (e: unknown) => {
      feedback.error(extractApiError(e, "만점 저장에 실패했습니다."));
    },
  });

  const save = () => {
    const n = typeof maxScore === "number" ? maxScore : 100;
    if (!Number.isFinite(n) || n <= 0) {
      feedback.error("만점은 1 이상이어야 합니다.");
      return;
    }
    patchMut.mutate(n);
  };

  if (!homework) return null;

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-divider)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">과제 만점</div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">
          채점 시 입력한 점수를 이 만점 기준으로 백분율 환산합니다. (예: 만점 20점 · 입력 18점 → 90%)
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <div className="mb-1 text-sm text-[var(--text-muted)]">만점</div>
          <input
            type="number"
            min={1}
            step={1}
            value={maxScore === "" ? "" : maxScore}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setMaxScore("");
                return;
              }
              const num = parseInt(v, 10);
              setMaxScore(Number.isFinite(num) ? num : "");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isDirty && !patchMut.isPending) save();
            }}
            className="w-24 rounded border border-[var(--border-divider)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
            aria-label="과제 만점"
          />
        </div>
        <button
          type="button"
          className="ds-button"
          data-intent="primary"
          data-size="md"
          disabled={!isDirty || patchMut.isPending}
          onClick={save}
        >
          {patchMut.isPending ? "저장 중…" : "저장"}
        </button>
      </div>
    </section>
  );
}
