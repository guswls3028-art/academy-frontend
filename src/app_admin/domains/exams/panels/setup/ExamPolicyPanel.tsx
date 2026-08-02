import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { fetchLectures, fetchSessions } from "@/shared/api/contracts/sessions";

import { useAdminExam } from "../../hooks/useAdminExam";
import { updateAdminExam } from "../../api/adminExam";
import { fetchQuestionsByExam } from "../../api/question.api";
import { adminExamsQueryKeys } from "../../queryKeys";
import type {
  AnswerVisibility,
  Exam,
  ExamGradingMode,
  ManualGradingMethod,
} from "../../types";
import AnswerKeyRegisterModal from "../../components/AnswerKeyRegisterModal";

type ExamPolicyForm = {
  maxScore: string;
  passScore: string;
  gradingMode: ExamGradingMode;
  manualGradingMethod: ManualGradingMethod;
  choiceQuestionCount: string;
  allowRetake: boolean;
  maxAttempts: string;
  openAt: string;
  closeAt: string;
  answerVisibility: AnswerVisibility;
};

type GradingChoice = "choice" | "written_correctness" | "written_score" | "mixed";

const GRADING_OPTIONS: Array<{
  value: GradingChoice;
  title: string;
  description: string;
}> = [
  {
    value: "choice",
    title: "OMR 자동 채점",
    description: "답안지를 스캔하고 인식 오류만 검토합니다.",
  },
  {
    value: "written_correctness",
    title: "직접 정오 입력",
    description: "학생별 문항을 O·X·오답노트로 입력합니다.",
  },
  {
    value: "written_score",
    title: "직접 점수 입력",
    description: "서술형과 부분점수를 문항별로 입력합니다.",
  },
  {
    value: "mixed",
    title: "OMR + 직접 채점",
    description: "선택형은 OMR, 나머지는 직접 채점합니다.",
  },
];

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formFromExam(exam: Exam): ExamPolicyForm {
  return {
    maxScore: String(exam.max_score),
    passScore: String(exam.pass_score),
    gradingMode: exam.grading_mode,
    manualGradingMethod: exam.manual_grading_method,
    choiceQuestionCount: String(exam.choice_question_count ?? 0),
    allowRetake: exam.allow_retake,
    maxAttempts: String(Math.max(1, exam.max_attempts || 1)),
    openAt: toLocalDateTime(exam.open_at),
    closeAt: toLocalDateTime(exam.close_at),
    answerVisibility: exam.answer_visibility,
  };
}

function gradingChoice(form: ExamPolicyForm): GradingChoice {
  if (form.gradingMode === "choice") return "choice";
  if (form.gradingMode === "mixed") return "mixed";
  return form.manualGradingMethod === "correctness"
    ? "written_correctness"
    : "written_score";
}

function formError(form: ExamPolicyForm): string | null {
  const maxScore = Number(form.maxScore);
  const passScore = Number(form.passScore);
  const maxAttempts = Number(form.maxAttempts);
  const choiceQuestionCount = Number(form.choiceQuestionCount);

  if (!Number.isFinite(maxScore) || maxScore <= 0) return "만점은 1점 이상이어야 합니다.";
  if (!Number.isFinite(passScore) || passScore < 0) return "합격 기준은 0점 이상이어야 합니다.";
  if (passScore > maxScore) return "합격 기준은 만점을 넘을 수 없습니다.";
  if (form.allowRetake && (!Number.isInteger(maxAttempts) || maxAttempts < 2)) {
    return "재응시를 허용하려면 최대 응시 횟수를 2회 이상으로 설정해 주세요.";
  }
  if (
    form.gradingMode === "mixed" &&
    (!Number.isInteger(choiceQuestionCount) || choiceQuestionCount < 1)
  ) {
    return "혼합 채점은 앞쪽 선택형 문항 수를 1개 이상 입력해야 합니다.";
  }
  if (form.openAt && form.closeAt && new Date(form.openAt) >= new Date(form.closeAt)) {
    return "마감 시각은 공개 시각보다 뒤여야 합니다.";
  }
  if (form.answerVisibility === "after_closed" && !form.closeAt) {
    return "마감 후 정답 공개를 사용하려면 마감 시각을 입력해 주세요.";
  }
  return null;
}

export default function ExamPolicyPanel({
  examId,
  lectureId = 0,
  sessionId = 0,
}: {
  examId: number;
  lectureId?: number;
  sessionId?: number;
}) {
  const qc = useQueryClient();
  const { data: exam, isLoading, isError } = useAdminExam(examId);
  const [form, setForm] = useState<ExamPolicyForm | null>(null);
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const initializedExamId = useRef<number | null>(null);

  useEffect(() => {
    if (!exam || initializedExamId.current === exam.id) return;
    initializedExamId.current = exam.id;
    setForm(formFromExam(exam));
  }, [exam]);

  const questionsQuery = useQuery({
    queryKey: adminExamsQueryKeys.examQuestions(examId),
    queryFn: () => fetchQuestionsByExam(examId).then((response) => response.data),
    enabled: examId > 0,
  });
  const questions = questionsQuery.data ?? [];

  const { data: lectureData } = useQuery({
    queryKey: adminExamsQueryKeys.lecturesForOmr,
    queryFn: () => fetchLectures(),
    enabled: lectureId > 0,
  });
  const { data: sessionData } = useQuery({
    queryKey: adminExamsQueryKeys.sessionsForOmr(lectureId),
    queryFn: () => fetchSessions(lectureId),
    enabled: lectureId > 0,
  });
  const resolvedLectureName = lectureData?.find((lecture) => lecture.id === lectureId)?.title ?? "";
  const resolvedSessionName = sessionData?.find((session) => session.id === sessionId)?.title ?? "";

  const dirty = useMemo(() => {
    if (!exam || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(formFromExam(exam));
  }, [exam, form]);
  const validationError = form ? formError(form) : null;

  const patchMutation = useMutation({
    mutationFn: async (nextForm: ExamPolicyForm) => {
      return updateAdminExam(examId, {
        max_score: Number(nextForm.maxScore),
        pass_score: Number(nextForm.passScore),
        grading_mode: nextForm.gradingMode,
        manual_grading_method: nextForm.manualGradingMethod,
        choice_question_count: Number(nextForm.choiceQuestionCount || 0),
        allow_retake: nextForm.allowRetake,
        max_attempts: nextForm.allowRetake ? Number(nextForm.maxAttempts) : 1,
        open_at: toIsoDateTime(nextForm.openAt),
        close_at: toIsoDateTime(nextForm.closeAt),
        answer_visibility: nextForm.answerVisibility,
      });
    },
    onSuccess: (updated) => {
      qc.setQueryData(adminExamsQueryKeys.adminExam(examId), updated);
      setForm(formFromExam(updated));
      feedback.success("시험 운영 설정을 저장했습니다.");
    },
    onError: (error: unknown) => {
      feedback.error((error as Error)?.message ?? "시험 운영 설정을 저장하지 못했습니다.");
    },
  });

  if (isError) {
    return <EmptyState mode="embedded" scope="panel" tone="error" title="시험 설정을 불러오지 못했습니다." />;
  }
  if (isLoading || !exam || !form) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="시험 설정 불러오는 중…" />;
  }

  const currentChoice = gradingChoice(form);
  const choiceBoundaryLocked = questions.length > 0;
  const structureOwnerId = exam.structure_owner_id ?? exam.id;

  const chooseGrading = (choice: GradingChoice) => {
    setForm((current) => {
      if (!current) return current;
      if (choice === "choice") return { ...current, gradingMode: "choice" };
      if (choice === "written_correctness") {
        return { ...current, gradingMode: "written", manualGradingMethod: "correctness" };
      }
      if (choice === "written_score") {
        return { ...current, gradingMode: "written", manualGradingMethod: "score" };
      }
      return { ...current, gradingMode: "mixed" };
    });
  };

  return (
    <>
      <section id="assessment-policy" tabIndex={-1} className={formStyles.section}>
        <div className={formStyles.header}>
          <div>
            <h2 className={formStyles.title}>시험 운영 설정</h2>
            <p className={formStyles.description}>
              점수, 채점 방식, 응시 기간과 정답 공개를 한곳에서 관리합니다.
            </p>
          </div>
        </div>

        <div className={formStyles.body}>
          <div className={formStyles.group}>
            <h3 className={formStyles.groupTitle}>채점 방식</h3>
            <p className={formStyles.groupDescription}>실제 채점 작업에 맞는 흐름을 선택하세요.</p>
            <div className={formStyles.choiceGrid} role="group" aria-label="시험 채점 방식">
              {GRADING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={formStyles.choiceButton}
                  aria-pressed={currentChoice === option.value}
                  onClick={() => chooseGrading(option.value)}
                >
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>

            {form.gradingMode === "mixed" && (
              <div className={formStyles.fieldGrid}>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>앞쪽 선택형 문항 수</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={formStyles.input}
                    value={form.choiceQuestionCount}
                    disabled={choiceBoundaryLocked}
                    onChange={(event) => setForm({ ...form, choiceQuestionCount: event.target.value })}
                  />
                  <span className={formStyles.helper}>
                    {choiceBoundaryLocked
                      ? "문항이 생성되어 선택형 경계가 잠겼습니다."
                      : "이 번호까지 OMR로 채점하고 다음 문항부터 직접 입력합니다."}
                  </span>
                </label>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>나머지 문항 입력 방식</span>
                  <select
                    className={formStyles.select}
                    value={form.manualGradingMethod}
                    onChange={(event) => setForm({
                      ...form,
                      manualGradingMethod: event.target.value as ManualGradingMethod,
                    })}
                  >
                    <option value="correctness">O·X·오답노트 입력</option>
                    <option value="score">문항별 점수 입력</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className={formStyles.group}>
            <h3 className={formStyles.groupTitle}>점수와 합격 기준</h3>
            <div className={formStyles.fieldGrid}>
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
                <span className={formStyles.label}>합격 기준</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={formStyles.input}
                  value={form.passScore}
                  onChange={(event) => setForm({ ...form, passScore: event.target.value })}
                />
                <span className={formStyles.helper}>기준 미만은 클리닉 보강 대상으로 표시됩니다.</span>
              </label>
            </div>
          </div>

          <div className={formStyles.group}>
            <h3 className={formStyles.groupTitle}>응시와 공개</h3>
            <div className={formStyles.fieldGrid}>
              <label className={formStyles.field}>
                <span className={formStyles.label}>응시 시작</span>
                <input
                  type="datetime-local"
                  className={formStyles.input}
                  value={form.openAt}
                  onChange={(event) => setForm({ ...form, openAt: event.target.value })}
                />
                <span className={formStyles.helper}>비워 두면 바로 응시할 수 있습니다.</span>
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>마감</span>
                <input
                  type="datetime-local"
                  className={formStyles.input}
                  value={form.closeAt}
                  onChange={(event) => setForm({ ...form, closeAt: event.target.value })}
                />
                <span className={formStyles.helper}>비워 두면 별도 마감 없이 운영합니다.</span>
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>정답 공개</span>
                <select
                  className={formStyles.select}
                  value={form.answerVisibility}
                  onChange={(event) => setForm({
                    ...form,
                    answerVisibility: event.target.value as AnswerVisibility,
                  })}
                >
                  <option value="hidden">공개하지 않음</option>
                  <option value="after_closed">마감 후 공개</option>
                  <option value="always">항상 공개</option>
                </select>
              </label>
              <div className={formStyles.field}>
                <span className={formStyles.label}>재응시</span>
                <div className={formStyles.switchRow}>
                  <span className={formStyles.switchCopy}>
                    <strong>{form.allowRetake ? "재응시 허용" : "1회만 응시"}</strong>
                    <small>허용하면 학생이 정해진 횟수까지 다시 응시할 수 있습니다.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.allowRetake}
                    onChange={(event) => setForm({
                      ...form,
                      allowRetake: event.target.checked,
                      maxAttempts: event.target.checked
                        ? String(Math.max(2, Number(form.maxAttempts) || 2))
                        : "1",
                    })}
                    aria-label="재응시 허용"
                  />
                </div>
                {form.allowRetake && (
                  <label className={formStyles.field}>
                    <span className={formStyles.label}>최대 응시 횟수</span>
                    <input
                      type="number"
                      min={2}
                      step={1}
                      className={formStyles.input}
                      value={form.maxAttempts}
                      onChange={(event) => setForm({ ...form, maxAttempts: event.target.value })}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {validationError && <p className={formStyles.error} role="alert">{validationError}</p>}
        </div>

        <div className={formStyles.footer}>
          <span className={formStyles.footerCopy}>
            채점 방식 변경은 기존 문항·답안·성적을 삭제하지 않습니다.
          </span>
          <Button
            type="button"
            intent="primary"
            size="md"
            disabled={!dirty || Boolean(validationError) || patchMutation.isPending}
            loading={patchMutation.isPending}
            onClick={() => patchMutation.mutate(form)}
          >
            {patchMutation.isPending ? "저장 중…" : "운영 설정 저장"}
          </Button>
        </div>
      </section>

      <section id="assessment-answer-key" tabIndex={-1} className={formStyles.section}>
        <div className={formStyles.header}>
          <div>
            <h2 className={formStyles.title}>문항·답안 준비</h2>
            <p className={formStyles.description}>
              자동 채점과 문항별 결과에 사용할 문항 수, 배점과 정답을 확인합니다.
            </p>
          </div>
        </div>
        <div className={formStyles.body}>
          <div className={formStyles.inlineStatus}>
            <div>
              <strong>
                {questionsQuery.isError
                  ? "문항 정보를 불러오지 못했습니다"
                  : questions.length > 0
                    ? `${questions.length}개 문항 등록됨`
                    : "등록된 문항이 없습니다"}
              </strong>
              <p>
                {questionsQuery.isError
                  ? "네트워크 상태를 확인하고 다시 불러와 주세요."
                  : questions.length > 0
                  ? "답안과 배점을 다시 확인하거나 OMR 답안지를 내려받을 수 있습니다."
                  : "직접 채점 또는 OMR을 시작하기 전에 문항과 답안을 등록하세요."}
              </p>
            </div>
            {questionsQuery.isError ? (
              <Button type="button" intent="secondary" size="sm" onClick={() => questionsQuery.refetch()}>
                다시 불러오기
              </Button>
            ) : (
              <Button type="button" intent="secondary" size="sm" onClick={() => setAnswerModalOpen(true)}>
                {questions.length > 0 ? "문항·답안 확인" : "문항·답안 등록"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <AnswerKeyRegisterModal
        open={answerModalOpen}
        onClose={() => setAnswerModalOpen(false)}
        examId={examId}
        structureOwnerId={structureOwnerId}
        canEditQuestions={exam.can_edit_structure}
        lectureName={resolvedLectureName}
        sessionName={resolvedSessionName}
      />
    </>
  );
}
