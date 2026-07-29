import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";
import {
  applyManualGrades,
  fetchManualGradeSheet,
  previewManualGrades,
  type ManualGradeCell,
  type ManualGradeRequestRow,
  type ManualGradeRow,
  type ManualGradeState,
} from "../api/manualExamGrading";
import { adminResultsQueryKeys } from "../queryKeys";
import styles from "./ManualExamGradingGrid.module.css";

type Props = {
  examId: number;
};

const STATE_ORDER: Array<ManualGradeState | null> = [
  null,
  "correct",
  "incorrect",
  "review",
];

const STATE_LABEL: Record<ManualGradeState, string> = {
  correct: "O",
  incorrect: "X",
  review: "0",
};

export default function ManualExamGradingGrid({ examId }: Props) {
  const queryClient = useQueryClient();
  const sheetQuery = useQuery({
    queryKey: adminResultsQueryKeys.manualGradeSheet(examId),
    queryFn: () => fetchManualGradeSheet(examId),
  });
  const [draftRows, setDraftRows] = useState<ManualGradeRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!sheetQuery.data) return;
    setDraftRows(cloneRows(sheetQuery.data.rows));
    setDirty(false);
  }, [sheetQuery.data]);

  const requestRows = useMemo(
    () => buildRequestRows(draftRows),
    [draftRows],
  );

  const previewMutation = useMutation({
    mutationFn: () => previewManualGrades(examId, requestRows),
    onError: (error) =>
      feedback.error(extractApiError(error, "입력한 채점 결과를 확인하지 못했습니다.")),
  });

  const applyMutation = useMutation({
    mutationFn: () => applyManualGrades(examId, requestRows),
    onSuccess: async (result) => {
      feedback.success(`${result.matched_count}명의 성적을 확정했습니다.`);
      previewMutation.reset();
      await Promise.all([
        sheetQuery.refetch(),
        queryClient.invalidateQueries({
          queryKey: adminExamsQueryKeys.adminExamResults(examId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminExamsQueryKeys.adminExamSummary(examId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminExamsQueryKeys.examQuestionStats(examId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminResultsQueryKeys.adminExamResults(examId),
        }),
      ]);
    },
    onError: (error) =>
      feedback.error(extractApiError(error, "성적을 확정하지 못했습니다.")),
  });

  const data = sheetQuery.data;
  if (sheetQuery.isLoading) {
    return (
      <section className={styles.card}>
        <EmptyState scope="panel" tone="loading" title="직접 채점표를 불러오는 중…" />
      </section>
    );
  }
  if (sheetQuery.isError) {
    return (
      <section className={styles.card}>
        <EmptyState
          scope="panel"
          tone="error"
          title="직접 채점표를 불러오지 못했습니다."
          actions={(
            <Button
              intent="secondary"
              size="sm"
              onClick={() => void sheetQuery.refetch()}
            >
              다시 불러오기
            </Button>
          )}
        />
      </section>
    );
  }
  if (!data?.has_manual_questions) return null;

  const manualQuestions = data.questions.filter((question) => question.editable);
  const preview = previewMutation.data;
  const hasErrors = Boolean(preview?.errors.length);
  const busy = previewMutation.isPending || applyMutation.isPending;

  const updateCell = (
    enrollmentId: number,
    questionId: number,
    updater: (cell: ManualGradeCell) => ManualGradeCell,
  ) => {
    setDraftRows((rows) =>
      rows.map((row) => {
        if (row.enrollment_id !== enrollmentId) return row;
        const key = String(questionId);
        const current = row.cells[key];
        return {
          ...row,
          cells: {
            ...row.cells,
            [key]: updater(current),
          },
        };
      }),
    );
    setDirty(true);
    previewMutation.reset();
  };

  const setAttendance = (enrollmentId: number, absent: boolean) => {
    setDraftRows((rows) =>
      rows.map((row) =>
        row.enrollment_id === enrollmentId
          ? { ...row, is_not_submitted: absent }
          : row,
      ),
    );
    setDirty(true);
    previewMutation.reset();
  };

  const reset = () => {
    setDraftRows(cloneRows(data.rows));
    setDirty(false);
    previewMutation.reset();
  };

  return (
    <section className={styles.card} aria-labelledby="manual-grading-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            <ClipboardCheck size={ICON.lg} />
          </span>
          <div>
            <h3 id="manual-grading-title">문항별 직접 채점</h3>
            <p>
              {data.manual_grading_method === "correctness"
                ? "조교가 정오를 입력한 뒤 한 번에 확인하고 성적을 확정합니다."
                : "조교가 문항별 점수를 입력한 뒤 한 번에 확인하고 성적을 확정합니다."}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {dirty && <span className={styles.unsaved}>확정 전 변경사항</span>}
          <Button
            type="button"
            intent="ghost"
            size="sm"
            leftIcon={<RefreshCw size={ICON_FOR_BUTTON.sm} />}
            disabled={!dirty || busy}
            onClick={reset}
          >
            되돌리기
          </Button>
        </div>
      </header>

      {data.manual_grading_method === "correctness" ? (
        <div className={styles.legend} aria-label="정오 입력표 범례">
          <span className={styles.legendCorrect}><b>O</b> 정답</span>
          <span className={styles.legendWrong}><b>X</b> 오답</span>
          <span className={styles.legendReview}>
            <b>0</b> 정답 · 오답노트에 포함
          </span>
          <span>셀을 누르거나 키보드 O/X/0으로 입력</span>
        </div>
      ) : (
        <div className={styles.legend}>
          <span>각 문항 배점 안에서 점수를 입력합니다.</span>
          <span className={styles.legendReview}>
            <b>복습</b> 만점을 받아도 오답노트에 포함
          </span>
        </div>
      )}

      {data.grading_mode === "mixed" && (
        <div className={styles.mixedNotice}>
          선택형은 OMR 결과를 그대로 보존합니다. OMR 채점이 끝난 학생만 답변형 점수를
          확정할 수 있습니다.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.studentColumn}>학생</th>
              <th className={styles.attendanceColumn}>응시</th>
              {manualQuestions.map((question) => (
                <th key={question.question_id}>
                  <strong>{question.number}</strong>
                  <span>{formatScore(question.max_score)}점</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draftRows.map((row) => (
              <tr key={row.enrollment_id}>
                <td className={styles.studentColumn}>
                  <StudentNameWithLectureChip
                    name={row.student_name}
                    enrollmentId={row.enrollment_id}
                    lectures={row.lectures.map((lecture) => ({
                      lectureName: lecture.lecture_name,
                      color: lecture.color,
                      chipLabel: lecture.chip_label,
                    }))}
                    density="compact"
                    maxLectureChips={1}
                    examNotSubmittedCount={row.exam_not_submitted_count}
                  />
                </td>
                <td className={styles.attendanceColumn}>
                  <button
                    type="button"
                    className={`${styles.attendanceButton} ${
                      row.is_not_submitted ? styles.absent : ""
                    }`}
                    aria-pressed={row.is_not_submitted}
                    onClick={() =>
                      setAttendance(row.enrollment_id, !row.is_not_submitted)
                    }
                  >
                    {row.is_not_submitted ? "결시" : "응시"}
                  </button>
                </td>
                {manualQuestions.map((question) => {
                  const key = String(question.question_id);
                  const cell = row.cells[key];
                  return (
                    <td key={question.question_id} className={styles.gradeCell}>
                      {data.manual_grading_method === "correctness" ? (
                        <CorrectnessCell
                          value={cell.state}
                          disabled={row.is_not_submitted || busy}
                          onChange={(state) =>
                            updateCell(
                              row.enrollment_id,
                              question.question_id,
                              (current) => ({ ...current, state }),
                            )
                          }
                        />
                      ) : (
                        <ScoreCell
                          value={cell.score}
                          maxScore={question.max_score}
                          review={cell.include_in_wrong_note}
                          disabled={row.is_not_submitted || busy}
                          onScoreChange={(score) =>
                            updateCell(
                              row.enrollment_id,
                              question.question_id,
                              (current) => ({ ...current, score }),
                            )
                          }
                          onReviewChange={(review) =>
                            updateCell(
                              row.enrollment_id,
                              question.question_id,
                              (current) => ({
                                ...current,
                                include_in_wrong_note: review,
                              }),
                            )
                          }
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <div
          className={`${styles.preview} ${hasErrors ? styles.previewError : ""}`}
          role={hasErrors ? "alert" : "status"}
        >
          {hasErrors ? (
            <AlertTriangle size={ICON.md} aria-hidden />
          ) : (
            <CheckCircle2 size={ICON.md} aria-hidden />
          )}
          <div>
            <strong>
              {hasErrors
                ? "확정 전에 수정할 항목이 있습니다."
                : `${preview.matched_count}명 · 결시 ${preview.not_submitted_count}명 · 성적 계산 완료`}
            </strong>
            {hasErrors ? (
              <ul>
                {preview.errors.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.row ?? "all"}-${issue.field}-${index}`}>
                    {issue.row ? `${issue.row}행 · ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <span>
                기존 성적 {preview.overwrite_count}명은 이 표의 값으로 갱신됩니다.
              </span>
            )}
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        <span>
          확인 단계에서는 통계가 바뀌지 않습니다. 성적 확정 시에만 한 번에 반영됩니다.
        </span>
        {!preview || hasErrors ? (
          <Button
            type="button"
            intent="primary"
            onClick={() => previewMutation.mutate()}
            loading={previewMutation.isPending}
            disabled={!dirty || busy}
          >
            입력 내용 확인
          </Button>
        ) : (
          <Button
            type="button"
            intent="primary"
            onClick={() => applyMutation.mutate()}
            loading={applyMutation.isPending}
            disabled={busy}
          >
            {preview.matched_count}명 성적 확정
          </Button>
        )}
      </footer>
    </section>
  );
}

function CorrectnessCell({
  value,
  disabled,
  onChange,
}: {
  value: ManualGradeState | null;
  disabled: boolean;
  onChange: (value: ManualGradeState | null) => void;
}) {
  const cycle = () => {
    const index = STATE_ORDER.indexOf(value);
    onChange(STATE_ORDER[(index + 1) % STATE_ORDER.length]);
  };
  const setFromKey = (key: string) => {
    if (key.toLowerCase() === "o") onChange("correct");
    else if (key.toLowerCase() === "x") onChange("incorrect");
    else if (key === "0") onChange("review");
    else return false;
    return true;
  };
  return (
    <button
      type="button"
      className={`${styles.correctnessCell} ${
        value ? styles[value] : styles.empty
      }`}
      disabled={disabled}
      aria-label={value ? STATE_LABEL[value] : "미입력"}
      onClick={cycle}
      onKeyDown={(event) => {
        if (setFromKey(event.key)) event.preventDefault();
      }}
    >
      {value ? STATE_LABEL[value] : "·"}
    </button>
  );
}

function ScoreCell({
  value,
  maxScore,
  review,
  disabled,
  onScoreChange,
  onReviewChange,
}: {
  value: number | null;
  maxScore: number;
  review: boolean;
  disabled: boolean;
  onScoreChange: (value: number | null) => void;
  onReviewChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.scoreCell}>
      <input
        type="number"
        min={0}
        max={maxScore}
        step="0.1"
        value={value ?? ""}
        disabled={disabled}
        aria-label={`${formatScore(maxScore)}점 만점 점수`}
        onChange={(event) => {
          const raw = event.target.value;
          onScoreChange(raw === "" ? null : Number(raw));
        }}
      />
      <button
        type="button"
        className={review ? styles.reviewOn : ""}
        disabled={disabled}
        aria-pressed={review}
        onClick={() => onReviewChange(!review)}
      >
        복습
      </button>
    </div>
  );
}

function buildRequestRows(rows: ManualGradeRow[]): ManualGradeRequestRow[] {
  return rows.map((row) => ({
    enrollment_id: row.enrollment_id,
    expected_version: row.expected_version,
    attendance: row.is_not_submitted ? "absent" : "present",
    cells: Object.fromEntries(
      Object.entries(row.cells)
        .filter(([, cell]) => cell.editable)
        .map(([questionId, cell]) => [
          questionId,
          cell.entry_method === "correctness"
            ? { state: cell.state ?? undefined }
            : {
                score: cell.score ?? undefined,
                include_in_wrong_note: cell.include_in_wrong_note,
              },
        ]),
    ),
  }));
}

function cloneRows(rows: ManualGradeRow[]): ManualGradeRow[] {
  return rows.map((row) => ({
    ...row,
    lectures: row.lectures.map((lecture) => ({ ...lecture })),
    cells: Object.fromEntries(
      Object.entries(row.cells).map(([key, cell]) => [key, { ...cell }]),
    ),
  }));
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
