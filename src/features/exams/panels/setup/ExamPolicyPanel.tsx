/**
 * ExamPolicyPanel – FINAL / HUMAN / SAFE
 *
 * - 커트라인 / 진행 상태
 * - 답안키 등록 영역 (AnswerKeyEditor)
 * - 문항선택하기 영역 (문항 수 표시 + 문항 선택 CTA)
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminExam } from "../../hooks/useAdminExam";
import { saveExamAsTemplate, updateAdminExam } from "../../api/adminExam";
import { fetchQuestionsByExam } from "../../api/questionApi";
import { initExamQuestions } from "../../api/questionInitApi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { AnswerKeyEditor } from "../../components/AnswerKeyEditor";

export default function ExamPolicyPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { data: exam, isLoading } = useAdminExam(examId);

  const [passScore, setPassScore] = useState<number | "">("");
  const [savedScore, setSavedScore] = useState<number | "">("");

  useEffect(() => {
    if (!exam) return;
    const ps = Number(exam.pass_score);
    const value = Number.isFinite(ps) && ps > 0 ? ps : "";
    setPassScore(value);
    setSavedScore(value);
  }, [exam?.id]);

  const isDirty = useMemo(
    () => passScore !== savedScore,
    [passScore, savedScore]
  );

  const numericPassScore = typeof passScore === "number" ? passScore : 0;

  const patchMut = useMutation({
    mutationFn: (payload: { pass_score: number }) => updateAdminExam(examId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      feedback.success("저장되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "저장에 실패했습니다.");
    },
  });

  const saveAsTemplateMut = useMutation({
    mutationFn: () => saveExamAsTemplate(examId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      feedback.success("템플릿으로 저장했습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "템플릿 저장에 실패했습니다.");
    },
  });

  if (isLoading || !exam) {
    return (
      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4 text-sm text-[var(--text-muted)]">
        시험 정책을 불러오는 중입니다…
      </section>
    );
  }

  const savePassScore = async () => {
    try {
      await patchMut.mutateAsync({
        pass_score: numericPassScore,
      });
      setSavedScore(passScore);
    } catch {
      // onError에서 이미 feedback 처리
    }
  };

  // 구조 단일진실: template이 있으면 template, 없으면 자기 자신(regular)
  const structureOwnerId = exam.exam_type === "regular"
    ? (exam.template_exam_id ?? exam.id)
    : exam.id;

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-divider)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">시험 정책</div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
          커트라인을 설정합니다
        </div>
      </div>

      <div className="space-y-6 p-4">
        {exam.exam_type === "regular" && (
          <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--color-text-secondary)]">
                시험을 템플릿으로 저장하면 다른 강의에서 같은 시험을 불러올 수 있습니다.
              </div>
              <Button
                type="button"
                intent="secondary"
                size="sm"
                onClick={() => saveAsTemplateMut.mutate()}
                disabled={!!exam.template_exam_id || saveAsTemplateMut.isPending}
              >
                {saveAsTemplateMut.isPending ? "처리 중…" : exam.template_exam_id ? "이미 템플릿 있음" : "템플릿으로 저장"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-sm text-[var(--text-muted)]">커트라인</div>
            <input
              type="number"
              min={0}
              step={1}
              value={passScore === "" ? "" : passScore}
              onChange={(e) => {
                const v = e.target.value;
                setPassScore(v === "" ? "" : Number(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (isDirty && !patchMut.isPending)) {
                  e.preventDefault();
                  savePassScore();
                }
              }}
              placeholder="입력"
              className="w-[180px] rounded border border-[var(--border-divider)] px-3 py-2 text-4xl font-bold"
              disabled={patchMut.isPending}
            />
          </div>

          <Button
            type="button"
            intent="primary"
            size="md"
            onClick={savePassScore}
            disabled={!isDirty || patchMut.isPending}
          >
            저장
          </Button>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          • 합격/불합격 판정은 Results 도메인에서 자동 계산됩니다.<br />
          • 시험 시작/종료 시점은 세션 일정과 연동됩니다.
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">답안키 등록</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다.
            </div>
          </div>
          <AnswerKeyEditor
            examId={examId}
            createExamId={structureOwnerId}
            disabled={false}
          />
        </div>

        <QuestionSelectionBlock examId={examId} />
      </div>
    </section>
  );
}

function QuestionSelectionBlock({ examId }: { examId: number }) {
  const { data: questions = [] } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: Number.isFinite(examId),
  });

  const qc = useQueryClient();
  const [total, setTotal] = useState<number | "">("");
  const [score, setScore] = useState<number | "">(1);

  const initMut = useMutation({
    mutationFn: async () => {
      const t = typeof total === "number" ? total : Number(total);
      const s = typeof score === "number" ? score : Number(score);
      return initExamQuestions({
        examId,
        total_questions: Number.isFinite(t) ? t : 0,
        default_score: Number.isFinite(s) ? s : 1,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      feedback.success("문항이 반영되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "문항 반영 실패");
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-semibold">문항선택하기</div>
      </div>
      <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-[var(--color-text-secondary)]">
            현재 문항 <strong className="text-[var(--color-text-primary)]">{questions.length}</strong>개
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">문항 수</span>
            <input
              type="number"
              min={0}
              step={1}
              value={total}
              onChange={(e) => setTotal(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="예: 20"
              className="h-9 w-[140px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">기본 점수</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={score}
              onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))}
              className="h-9 w-[140px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </label>

          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => initMut.mutate()}
            disabled={initMut.isPending}
            loading={initMut.isPending}
          >
            문항 반영
          </Button>
        </div>
      </div>
    </div>
  );
}
