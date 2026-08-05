import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

import {
  fetchHomeworkQuestionGrading,
  updateHomeworkQuestionGrading,
  type HomeworkQuestionGrading,
  type HomeworkQuestionMark,
} from "../api/adminHomework";

const gradingKey = (homeworkId: number) => ["homework-question-grading", homeworkId] as const;

type CellValue = "unset" | "correct" | "wrong" | "review";

function markToValue(mark?: HomeworkQuestionMark): CellValue {
  if (!mark || mark.is_correct == null) return "unset";
  if (mark.is_correct === false) return "wrong";
  return mark.include_in_wrong_note ? "review" : "correct";
}

function valueToMark(value: CellValue): HomeworkQuestionMark {
  if (value === "correct") return { is_correct: true, include_in_wrong_note: false };
  if (value === "wrong") return { is_correct: false, include_in_wrong_note: true };
  if (value === "review") return { is_correct: true, include_in_wrong_note: true };
  return { is_correct: null, include_in_wrong_note: false };
}

export default function HomeworkQuestionLedger({ homeworkId }: { homeworkId: number }) {
  const queryClient = useQueryClient();
  const grading = useQuery({
    queryKey: gradingKey(homeworkId),
    queryFn: () => fetchHomeworkQuestionGrading(homeworkId),
  });
  const update = useMutation({
    mutationFn: (payload: { enrollmentId: number; questionNumber: number; value: CellValue }) => {
      const mark = valueToMark(payload.value);
      return updateHomeworkQuestionGrading(homeworkId, [{
        enrollment_id: payload.enrollmentId,
        question_number: payload.questionNumber,
        ...mark,
      }]);
    },
    onSuccess: (data: HomeworkQuestionGrading) => {
      queryClient.setQueryData(gradingKey(homeworkId), data);
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "문항 표시를 저장하지 못했습니다."));
      void grading.refetch();
    },
  });

  if (grading.isLoading) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="워크북 채점표 불러오는 중…" />;
  }
  if (grading.isError || !grading.data) {
    return (
      <EmptyState
        mode="embedded"
        scope="panel"
        tone="error"
        title="워크북 채점표를 불러오지 못했습니다."
        description={extractApiError(grading.error, "워크북 문항 준비 상태를 확인해 주세요.")}
      />
    );
  }

  const { questions, rows } = grading.data;
  const markedCount = rows.reduce(
    (total, row) => total + Object.values(row.marks).filter((mark) => mark.is_correct != null).length,
    0,
  );
  const noteCount = rows.reduce(
    (total, row) => total + Object.values(row.marks).filter(
      (mark) => mark.is_correct === false || mark.include_in_wrong_note,
    ).length,
    0,
  );

  return (
    <section className="space-y-4 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">워크북 문항 채점표</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            X는 오답노트에 자동 수록됩니다. 다시 맞힌 뒤에도 남길 문항은 O·복습으로 바꿔 주세요.
          </div>
        </div>
        <div className="flex gap-2" aria-label="워크북 채점 현황">
          <Badge tone="neutral" shape="square">입력 {markedCount}</Badge>
          <Badge tone="warning" shape="square">오답노트 {noteCount}</Badge>
        </div>
      </div>

      {questions.length === 0 || rows.length === 0 ? (
        <EmptyState
          mode="embedded"
          scope="panel"
          tone="empty"
          title={questions.length === 0 ? "확정된 워크북 문항이 없습니다." : "과제 대상 학생이 없습니다."}
        />
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--color-border-divider)]">
          <table className="min-w-max border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-surface-soft)]">
                <th className="sticky left-0 z-20 min-w-36 border-b border-r border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-2 text-left">
                  학생
                </th>
                {questions.map((question) => (
                  <th
                    key={question.id}
                    className="min-w-24 border-b border-r border-[var(--color-border-divider)] px-2 py-2 text-center font-semibold"
                  >
                    {question.number}번
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.enrollment_id} className="hover:bg-[var(--color-bg-surface-soft)]/50">
                  <th className="sticky left-0 z-10 border-b border-r border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-3 py-2 text-left font-medium">
                    {row.student_name}
                  </th>
                  {questions.map((question) => {
                    const value = markToValue(row.marks[String(question.number)]);
                    return (
                      <td key={question.id} className="border-b border-r border-[var(--color-border-divider)] p-1.5">
                        <select
                          className="h-8 w-full rounded border border-[var(--color-border-input)] bg-[var(--color-bg-surface)] px-1 text-center text-xs font-semibold focus:border-[var(--color-primary)] focus:outline-none"
                          aria-label={`${row.student_name} ${question.number}번 채점`}
                          value={value}
                          disabled={update.isPending}
                          onChange={(event) => update.mutate({
                            enrollmentId: row.enrollment_id,
                            questionNumber: question.number,
                            value: event.target.value as CellValue,
                          })}
                        >
                          <option value="unset">—</option>
                          <option value="correct">O</option>
                          <option value="wrong">X · 수록</option>
                          <option value="review">O · 복습</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
