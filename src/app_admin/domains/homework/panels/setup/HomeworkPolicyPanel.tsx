import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, EmptyState } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { feedback } from "@/shared/ui/feedback/feedback";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { extractApiError } from "@/shared/utils/extractApiError";

import { updateAdminHomework, type AdminHomeworkDetail } from "../../api/adminHomework";
import { useAdminHomework } from "../../hooks/useAdminHomework";
import { QUERY_KEYS } from "../../queryKeys";
import type { HomeworkCutlineMode } from "../../types";

type HomeworkPolicyForm = {
  title: string;
  dueDate: string;
  maxScore: string;
  cutlineMode: HomeworkCutlineMode;
  cutlineValue: string;
  roundUnitPercent: string;
};

function formFromHomework(homework: AdminHomeworkDetail): HomeworkPolicyForm {
  const dueDate = typeof homework.meta?.due_date === "string" ? homework.meta.due_date : "";
  return {
    title: homework.title,
    dueDate,
    maxScore: String(homework.max_score ?? homework.default_max_score ?? 100),
    cutlineMode: homework.effective_cutline_mode,
    cutlineValue: String(homework.effective_cutline_value),
    roundUnitPercent: String(homework.effective_round_unit_percent),
  };
}

function validateForm(form: HomeworkPolicyForm): string | null {
  const maxScore = Number(form.maxScore);
  const cutlineValue = Number(form.cutlineValue);
  const roundUnit = Number(form.roundUnitPercent);

  if (!form.title.trim()) return "과제명을 입력해 주세요.";
  if (!Number.isFinite(maxScore) || maxScore < 1) return "만점은 1점 이상이어야 합니다.";
  if (!Number.isInteger(cutlineValue) || cutlineValue < 0) return "합격 기준은 0 이상의 정수여야 합니다.";
  if (form.cutlineMode === "PERCENT" && cutlineValue > 100) {
    return "퍼센트 합격 기준은 100% 이하로 입력해 주세요.";
  }
  if (form.cutlineMode === "COUNT" && cutlineValue > maxScore) {
    return "점수 합격 기준은 만점을 넘을 수 없습니다.";
  }
  if (!Number.isInteger(roundUnit) || roundUnit < 1 || roundUnit > 50) {
    return "반올림 단위는 1부터 50까지 입력해 주세요.";
  }
  return null;
}

export default function HomeworkPolicyPanel({ homeworkId }: { homeworkId: number }) {
  const qc = useQueryClient();
  const { data: homework, isLoading, isError } = useAdminHomework(homeworkId);
  const [form, setForm] = useState<HomeworkPolicyForm | null>(null);
  const initializedHomeworkId = useRef<number | null>(null);

  useEffect(() => {
    if (!homework || initializedHomeworkId.current === homework.id) return;
    initializedHomeworkId.current = homework.id;
    setForm(formFromHomework(homework));
  }, [homework]);

  const dirty = useMemo(() => {
    if (!homework || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(formFromHomework(homework));
  }, [homework, form]);
  const validationError = form ? validateForm(form) : null;
  const sessionId = Number(homework?.session_id ?? 0);

  const updateMutation = useMutation({
    mutationFn: async (nextForm: HomeworkPolicyForm) => {
      if (!homework) throw new Error("과제 정보를 불러오지 못했습니다.");
      const nextMeta: Record<string, unknown> = { ...(homework.meta ?? {}) };
      if (nextForm.dueDate) nextMeta.due_date = nextForm.dueDate;
      else delete nextMeta.due_date;

      return updateAdminHomework(homeworkId, {
        title: nextForm.title.trim(),
        max_score: Number(nextForm.maxScore),
        cutline_mode: nextForm.cutlineMode,
        cutline_value: Number(nextForm.cutlineValue),
        round_unit_percent: Number(nextForm.roundUnitPercent),
        meta: nextMeta,
      });
    },
    onSuccess: async (updated) => {
      qc.setQueryData(QUERY_KEYS.ADMIN_HOMEWORK(homeworkId), updated);
      setForm(formFromHomework(updated));
      await Promise.all([
        qc.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_HOMEWORK(homeworkId) }),
        sessionId > 0
          ? qc.invalidateQueries({ queryKey: assessmentQueryKeys.sessionHomeworks(sessionId) })
          : Promise.resolve(),
        sessionId > 0
          ? qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) })
          : Promise.resolve(),
      ]);
      feedback.success("과제 운영 설정을 저장했습니다.");
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "과제 운영 설정을 저장하지 못했습니다."));
    },
  });

  if (isError) {
    return <EmptyState mode="embedded" scope="panel" tone="error" title="과제 설정을 불러오지 못했습니다." />;
  }
  if (isLoading || !homework || !form) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="과제 설정 불러오는 중…" />;
  }

  return (
    <section id="assessment-policy" tabIndex={-1} className={formStyles.section}>
      <div className={formStyles.header}>
        <div>
          <h2 className={formStyles.title}>과제 운영 설정</h2>
          <p className={formStyles.description}>
            과제명, 제출기한, 만점과 합격 기준을 한 번에 관리합니다.
          </p>
        </div>
      </div>

      <div className={formStyles.body}>
        <div className={formStyles.group}>
          <h3 className={formStyles.groupTitle}>기본 정보</h3>
          <div className={formStyles.fieldGrid}>
            <label className={formStyles.field}>
              <span className={formStyles.label}>과제명</span>
              <input
                className={formStyles.input}
                value={form.title}
                maxLength={255}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>제출기한</span>
              <input
                type="date"
                className={formStyles.input}
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
              <span className={formStyles.helper}>비워 두면 제출기한 없이 운영합니다.</span>
            </label>
          </div>
        </div>

        <div className={formStyles.group}>
          <h3 className={formStyles.groupTitle}>점수와 합격 기준</h3>
          <p className={formStyles.groupDescription}>
            기준 미만은 클리닉 보강 대상으로 표시됩니다. 합격 여부는 서버가 계산합니다.
          </p>

          {homework.uses_session_cutline_default && (
            <div className={formStyles.inlineStatus}>
              <div>
                <strong>현재 차시 기본 기준을 사용 중입니다</strong>
                <p>저장하면 이 과제의 개별 기준으로 고정됩니다.</p>
              </div>
            </div>
          )}

          <div className={`${formStyles.choiceGrid} ${formStyles.choiceGridThree}`} role="group" aria-label="과제 합격 기준 방식">
            <button
              type="button"
              className={formStyles.choiceButton}
              aria-pressed={form.cutlineMode === "PERCENT"}
              onClick={() => setForm({ ...form, cutlineMode: "PERCENT" })}
            >
              <strong>퍼센트 기준</strong>
              <small>만점 대비 달성률로 합격을 판단합니다.</small>
            </button>
            <button
              type="button"
              className={formStyles.choiceButton}
              aria-pressed={form.cutlineMode === "COUNT"}
              onClick={() => setForm({ ...form, cutlineMode: "COUNT" })}
            >
              <strong>점수 기준</strong>
              <small>입력한 원점수 이상이면 합격입니다.</small>
            </button>
          </div>

          <div className={formStyles.fieldGridThree}>
            <label className={formStyles.field}>
              <span className={formStyles.label}>만점</span>
              <input
                type="number"
                min={1}
                step={1}
                className={formStyles.input}
                value={form.maxScore}
                onChange={(event) => setForm({ ...form, maxScore: event.target.value })}
              />
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>
                합격 기준 ({form.cutlineMode === "PERCENT" ? "%" : "점"})
              </span>
              <input
                type="number"
                min={0}
                max={form.cutlineMode === "PERCENT" ? 100 : undefined}
                step={1}
                className={formStyles.input}
                value={form.cutlineValue}
                onChange={(event) => setForm({ ...form, cutlineValue: event.target.value })}
              />
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>퍼센트 반올림 단위</span>
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                className={formStyles.input}
                value={form.roundUnitPercent}
                disabled={form.cutlineMode !== "PERCENT"}
                onChange={(event) => setForm({ ...form, roundUnitPercent: event.target.value })}
              />
              <span className={formStyles.helper}>점수 기준에서는 사용하지 않습니다.</span>
            </label>
          </div>
        </div>

        {validationError && <p className={formStyles.error} role="alert">{validationError}</p>}
      </div>

      <div className={formStyles.footer}>
        <span className={formStyles.footerCopy}>저장 후 성적표와 클리닉 판정에 같은 기준이 적용됩니다.</span>
        <Button
          type="button"
          intent="primary"
          size="md"
          disabled={!dirty || Boolean(validationError) || updateMutation.isPending}
          loading={updateMutation.isPending}
          onClick={() => updateMutation.mutate(form)}
        >
          {updateMutation.isPending ? "저장 중…" : "운영 설정 저장"}
        </Button>
      </div>
    </section>
  );
}
