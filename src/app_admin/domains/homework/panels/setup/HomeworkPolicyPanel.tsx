import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, EmptyState } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { feedback } from "@/shared/ui/feedback/feedback";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { useAssessmentDirtyRegistration } from "@/shared/ui/assessment/AssessmentEditGuard";
import { useAssessmentPolicyDraft } from "@/shared/ui/assessment/useAssessmentPolicyDraft";

import { updateAdminHomework, type AdminHomeworkDetail } from "../../api/adminHomework";
import { useAdminHomework } from "../../hooks/useAdminHomework";
import { QUERY_KEYS } from "../../queryKeys";
import type { HomeworkCutlineMode, HomeworkGradingMode } from "../../types";

type HomeworkPolicyForm = {
  title: string;
  dueDate: string;
  gradingMode: HomeworkGradingMode;
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
    gradingMode: homework.grading_mode,
    maxScore: String(homework.max_score ?? homework.default_max_score ?? 100),
    cutlineMode: homework.effective_cutline_mode,
    cutlineValue: String(homework.effective_cutline_value),
    roundUnitPercent: String(homework.effective_round_unit_percent),
  };
}

function validateForm(form: HomeworkPolicyForm): string | null {
  if (!form.title.trim()) return "과제명을 입력해 주세요.";
  if (form.gradingMode === "COMPLETION") return null;
  if (!form.maxScore.trim()) return "만점을 입력해 주세요.";
  if (!form.cutlineValue.trim()) return "합격 기준을 입력해 주세요.";
  if (!form.roundUnitPercent.trim()) return "반올림 단위를 입력해 주세요.";
  const maxScore = Number(form.maxScore);
  const cutlineValue = Number(form.cutlineValue);
  const roundUnit = Number(form.roundUnitPercent);

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
  const confirm = useConfirm();
  const { data: homework, isLoading, isError, refetch } = useAdminHomework(homeworkId);
  const [form, setForm] = useState<HomeworkPolicyForm | null>(null);
  const [conflictDetected, setConflictDetected] = useState(false);
  const initializedHomeworkId = useRef<number | null>(null);
  const baseFormRef = useRef<HomeworkPolicyForm | null>(null);
  const baseUpdatedAtRef = useRef("");

  const syncFromHomework = useCallback((nextHomework: AdminHomeworkDetail) => {
    const nextForm = formFromHomework(nextHomework);
    initializedHomeworkId.current = nextHomework.id;
    baseFormRef.current = nextForm;
    baseUpdatedAtRef.current = nextHomework.updated_at;
    setForm(nextForm);
    setConflictDetected(false);
  }, []);

  useEffect(() => {
    if (!homework || initializedHomeworkId.current === homework.id) return;
    syncFromHomework(homework);
  }, [homework, syncFromHomework]);

  const dirty = useMemo(() => {
    if (!form || !baseFormRef.current) return false;
    return JSON.stringify(form) !== JSON.stringify(baseFormRef.current);
  }, [form]);
  const validationError = form ? validateForm(form) : null;
  const sessionId = Number(homework?.session_id ?? 0);
  const remoteChanged = Boolean(
    homework?.updated_at &&
    baseUpdatedAtRef.current &&
    homework.updated_at !== baseUpdatedAtRef.current,
  );
  const {
    recoverableDraftSavedAt,
    restoreDraft,
    clearDraft,
  } = useAssessmentPolicyDraft<HomeworkPolicyForm>({
    resourceKind: "homework",
    resourceId: homeworkId,
    baseUpdatedAt: baseUpdatedAtRef.current,
    form,
    dirty,
    onRestore: setForm,
  });

  const updateMutation = useMutation({
    mutationFn: async (nextForm: HomeworkPolicyForm) => {
      if (!homework) throw new Error("과제 정보를 불러오지 못했습니다.");
      const baseForm = baseFormRef.current;
      if (!baseForm) throw new Error("과제 설정 기준값을 불러오지 못했습니다.");
      const payload: Partial<AdminHomeworkDetail> = {};

      if (nextForm.title !== baseForm.title) {
        payload.title = nextForm.title.trim();
      }
      if (nextForm.gradingMode !== baseForm.gradingMode) {
        payload.grading_mode = nextForm.gradingMode;
      }
      if (nextForm.maxScore !== baseForm.maxScore) {
        payload.max_score = Number(nextForm.maxScore);
      }
      if (
        nextForm.cutlineMode !== baseForm.cutlineMode ||
        nextForm.cutlineValue !== baseForm.cutlineValue ||
        nextForm.roundUnitPercent !== baseForm.roundUnitPercent
      ) {
        payload.cutline_mode = nextForm.cutlineMode;
        payload.cutline_value = Number(nextForm.cutlineValue);
        payload.round_unit_percent = Number(nextForm.roundUnitPercent);
      }
      if (nextForm.dueDate !== baseForm.dueDate) {
        const nextMeta: Record<string, unknown> = { ...(homework.meta ?? {}) };
        if (nextForm.dueDate) nextMeta.due_date = nextForm.dueDate;
        else delete nextMeta.due_date;
        payload.meta = nextMeta;
      }

      return updateAdminHomework(
        homeworkId,
        payload,
        baseUpdatedAtRef.current,
      );
    },
    onSuccess: async (updated) => {
      clearDraft();
      qc.setQueryData(QUERY_KEYS.ADMIN_HOMEWORK(homeworkId), updated);
      syncFromHomework(updated);
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
    onError: async (error: unknown) => {
      if (isStaleResourceConflict(error)) {
        setConflictDetected(true);
        await refetch();
        feedback.warning("다른 사용자의 변경을 확인했습니다. 최신 설정을 불러온 뒤 다시 저장해 주세요.");
        return;
      }
      feedback.error(extractApiError(error, "과제 운영 설정을 저장하지 못했습니다."));
    },
  });

  useEffect(() => {
    if (!homework || !form || dirty || !remoteChanged) return;
    syncFromHomework(homework);
  }, [dirty, form, homework, remoteChanged, syncFromHomework]);

  useAssessmentDirtyRegistration(
    `homework-policy:${homeworkId}`,
    dirty && !updateMutation.isPending,
  );

  if (isError) {
    return <EmptyState mode="embedded" scope="panel" tone="error" title="과제 설정을 불러오지 못했습니다." />;
  }
  if (isLoading || !homework || !form) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="과제 설정 불러오는 중…" />;
  }

  const loadLatest = async () => {
    if (dirty) {
      const confirmed = await confirm({
        title: "최신 설정 불러오기",
        message: "현재 입력한 변경사항을 버리고 다른 사용자가 저장한 최신 설정을 불러옵니다.",
        confirmText: "최신 설정 불러오기",
        danger: true,
      });
      if (!confirmed) return;
    }
    const result = await refetch();
    if (result.data) {
      clearDraft();
      syncFromHomework(result.data);
    }
  };

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
        {recoverableDraftSavedAt && (
          <div className={formStyles.inlineStatus} role="status" data-testid="assessment-draft-recovery">
            <div>
              <strong>저장되지 않은 과제 설정이 있습니다</strong>
              <p>
                {new Date(recoverableDraftSavedAt).toLocaleString("ko-KR")}에 이 브라우저에 임시 저장했습니다.
              </p>
            </div>
            <div className={formStyles.inlineActions}>
              <Button type="button" intent="secondary" size="sm" onClick={restoreDraft}>
                이어서 편집
              </Button>
              <Button type="button" intent="ghost" size="sm" onClick={clearDraft}>
                초안 지우기
              </Button>
            </div>
          </div>
        )}
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
          <h3 className={formStyles.groupTitle}>채점 방식</h3>
          <p className={formStyles.groupDescription}>
            문제 수를 기록할 과제와 완료 여부만 확인할 과제를 구분합니다.
          </p>
          <div className={formStyles.choiceGrid} role="group" aria-label="과제 채점 방식">
            <button
              type="button"
              className={formStyles.choiceButton}
              aria-pressed={form.gradingMode === "SCORE"}
              onClick={() => setForm({
                ...form,
                gradingMode: "SCORE",
                ...(form.gradingMode === "COMPLETION"
                  ? {
                      maxScore: "100",
                      cutlineMode: "PERCENT" as const,
                      cutlineValue: "80",
                      roundUnitPercent: "5",
                    }
                  : {}),
              })}
            >
              <strong>숫자 채점</strong>
              <small>0/30처럼 수행량이나 점수를 입력합니다.</small>
            </button>
            <button
              type="button"
              className={formStyles.choiceButton}
              aria-pressed={form.gradingMode === "COMPLETION"}
              onClick={() => setForm({
                ...form,
                gradingMode: "COMPLETION",
                maxScore: "1",
                cutlineMode: "COUNT",
                cutlineValue: "1",
                roundUnitPercent: "1",
              })}
            >
              <strong>완료 체크</strong>
              <small>완료와 미완료 두 상태로만 검사합니다.</small>
            </button>
          </div>
          <span className={formStyles.helper}>
            결과가 한 번이라도 입력된 과제는 기존 기록 보호를 위해 방식을 바꿀 수 없습니다.
          </span>
        </div>

        {form.gradingMode === "SCORE" ? (
        <div className={formStyles.group}>
          <h3 className={formStyles.groupTitle}>점수와 합격 기준</h3>
          <p className={formStyles.groupDescription}>
            기준 미만은 클리닉 보강 대상으로 표시됩니다. 합격 여부는 서버가 계산합니다.
          </p>

          {homework.uses_session_cutline_default && (
            <div className={formStyles.inlineStatus}>
              <div>
                <strong>현재 차시 기본 기준을 사용 중입니다</strong>
                <p>점수나 합격 기준을 바꿔 저장할 때만 이 과제의 개별 기준으로 고정됩니다.</p>
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
        ) : (
          <div className={formStyles.group}>
            <h3 className={formStyles.groupTitle}>완료 기준</h3>
            <div className={formStyles.inlineStatus} role="status">
              <div>
                <strong>완료를 선택하면 통과, 미완료를 선택하면 보강 대상으로 판정합니다.</strong>
                <p>성적표와 학생 상세에서는 숫자 대신 완료/미완료 버튼이 표시됩니다.</p>
              </div>
            </div>
          </div>
        )}

        {(conflictDetected || remoteChanged) && (
          <div className={formStyles.inlineStatus} role="alert">
            <div>
              <strong>다른 화면에서 설정이 변경되었습니다</strong>
              <p>현재 입력을 덮어쓰지 않았습니다. 최신 설정을 불러온 뒤 다시 편집해 주세요.</p>
            </div>
            <Button type="button" intent="secondary" size="sm" onClick={() => void loadLatest()}>
              최신 설정 불러오기
            </Button>
          </div>
        )}
        {validationError && <p className={formStyles.error} role="alert">{validationError}</p>}
      </div>

      <div className={formStyles.footer}>
        <span className={formStyles.footerCopy}>
          저장 후 성적표와 학생 상세에 같은 채점 방식이 적용됩니다.
        </span>
        <Button
          type="button"
          intent="primary"
          size="md"
          disabled={!dirty || Boolean(validationError) || conflictDetected || remoteChanged || updateMutation.isPending}
          loading={updateMutation.isPending}
          onClick={() => updateMutation.mutate(form)}
        >
          {updateMutation.isPending ? "저장 중…" : "운영 설정 저장"}
        </Button>
      </div>
    </section>
  );
}
