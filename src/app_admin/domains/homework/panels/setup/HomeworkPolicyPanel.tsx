// PATH: src/app_admin/domains/homework/panels/setup/HomeworkPolicyPanel.tsx

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/ui/feedback/feedback";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { extractApiError } from "@/shared/utils/extractApiError";
import HomeworkPolicyCard from "../../components/HomeworkPolicyCard";
import { updateAdminHomework } from "../../api/adminHomework";
import { useAdminHomework } from "../../hooks/useAdminHomework";
import { QUERY_KEYS } from "../../queryKeys";
import type { HomeworkCutlineSettings } from "../../types";

export default function HomeworkPolicyPanel({ homeworkId }: { homeworkId: number }) {
  const qc = useQueryClient();
  const { data: homework, isLoading, isError } = useAdminHomework(homeworkId);
  const sessionId = Number(homework?.session_id ?? 0);
  const settings = useMemo<HomeworkCutlineSettings | null>(() => {
    if (!homework) return null;
    return {
      cutline_mode: homework.effective_cutline_mode,
      cutline_value: homework.effective_cutline_value,
      round_unit_percent: homework.effective_round_unit_percent,
    };
  }, [homework]);

  const updateMut = useMutation({
    mutationFn: (payload: HomeworkCutlineSettings) =>
      updateAdminHomework(homeworkId, payload),
    onSuccess: async (updated) => {
      qc.setQueryData(QUERY_KEYS.ADMIN_HOMEWORK(homeworkId), updated);
      await Promise.all([
        qc.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_HOMEWORK(homeworkId) }),
        sessionId > 0
          ? qc.invalidateQueries({ queryKey: assessmentQueryKeys.sessionHomeworks(sessionId) })
          : Promise.resolve(),
        sessionId > 0
          ? qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) })
          : Promise.resolve(),
      ]);
      feedback.success("이 과제의 합격 기준이 저장되었습니다.");
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "과제 합격 기준 저장 실패"));
    },
  });

  return (
    <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
      <div>
        <div className="text-lg font-semibold text-[var(--color-text-primary)]">
          과제별 합격 기준
        </div>
        <div className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
          지금 선택한 과제에만 적용됩니다. 같은 회차의 다른 과제는 각자 저장한 기준을 사용합니다.
          기준 미만이면 클리닉 보강 대상이 됩니다.
        </div>
        {homework?.uses_session_cutline_default && (
          <div className="mt-2 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            현재는 기존 회차 기본값을 사용 중입니다. 저장하면 이 과제의 개별 기준으로 고정됩니다.
          </div>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-[var(--text-muted)]">합격 기준 불러오는 중...</div>
      )}
      {isError && (
        <div className="text-sm text-[var(--color-danger)]">합격 기준 조회 실패</div>
      )}
      {!isLoading && !isError && (
        <HomeworkPolicyCard
          policy={settings}
          isPatching={updateMut.isPending}
          onPatch={(data) => {
            if (!settings) return;
            updateMut.mutate({ ...settings, ...data });
          }}
        />
      )}
    </section>
  );
}
