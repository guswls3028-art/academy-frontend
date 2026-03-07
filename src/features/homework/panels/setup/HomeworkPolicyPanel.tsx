// PATH: src/features/homework/panels/setup/HomeworkPolicyPanel.tsx
/**
 * HomeworkPolicyPanel
 * - exams/setup/ExamPolicyPanel UX 복제
 * - Wrapper 카드(과제 설정)만 담당
 */

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useHomeworkPolicy } from "../../hooks/useHomeworkPolicy";
import { patchHomeworkPolicy } from "../../api/homeworkPolicy";
import HomeworkPolicyCard from "../../components/HomeworkPolicyCard";
import type { HomeworkPolicy } from "../../types";

export default function HomeworkPolicyPanel({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();

  const safeSessionId = useMemo(() => {
    const v = Number(sessionId);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [sessionId]);

  const { data: policy, isLoading, isError } = useHomeworkPolicy(safeSessionId);

  const updateMut = useMutation({
    mutationFn: (payload: {
      id: number;
      data: Partial<
        Pick<HomeworkPolicy, "cutline_mode" | "cutline_value" | "round_unit_percent">
      >;
    }) => patchHomeworkPolicy(payload.id, payload.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["homework-policy", safeSessionId] });
      alert("과제 정책이 저장되었습니다.");
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || "과제 정책 저장 실패");
    },
  });

  return (
    <section className="space-y-3">
      <div className="ds-panel-card">
        <div className="ds-panel-card__header px-4 py-3">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            과제 설정
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
            커트라인 기준(%/문항 수) · 반올림 단위 설정
          </div>
        </div>

        <div className="p-4 space-y-3">
          {!safeSessionId && (
            <div className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)] p-3 text-sm text-[var(--color-text-muted)]">
              ⚠️ sessionId가 없어 과제 정책을 조회할 수 없습니다.
            </div>
          )}

          {safeSessionId > 0 && isLoading && (
            <div className="text-sm text-[var(--color-text-muted)]">정책 불러오는 중...</div>
          )}

          {safeSessionId > 0 && isError && (
            <div className="text-sm text-[var(--color-danger)]">정책 조회 실패</div>
          )}

          {safeSessionId > 0 && !isLoading && !isError && (
            <HomeworkPolicyCard
              policy={policy ?? null}
              isPatching={updateMut.isPending}
              onPatch={(data) => {
                if (!policy) return;
                updateMut.mutate({ id: policy.id, data });
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
