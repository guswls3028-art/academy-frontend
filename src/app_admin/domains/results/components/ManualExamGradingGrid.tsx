import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  RefreshCw,
  ScanLine,
  Settings2,
} from "lucide-react";

import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import AnswerKeyRegisterModal from "@admin/domains/exams/components/AnswerKeyRegisterModal";
import { initExamQuestions } from "@admin/domains/exams/api/questionInit.api";
import { useAdminExam } from "@admin/domains/exams/hooks/useAdminExam";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";
import {
  applyManualGrades,
  fetchManualGradeSheet,
  previewManualGrades,
  type ManualGradeCell,
  type ManualGradeSheet,
  type ManualGradeRequestRow,
  type ManualGradeRow,
  type ManualGradeState,
  type ManualGradeQuestionScoreChanges,
} from "../api/manualExamGrading";
import { adminResultsQueryKeys } from "../queryKeys";
import {
  DEFAULT_MANUAL_GRADING_SHORTCUTS,
  getManualGradeStateFromShortcut,
  loadManualGradingShortcuts,
  normalizeManualGradingShortcutKey,
  saveManualGradingShortcuts,
  validateManualGradingShortcuts,
  type ManualGradingShortcutSettings,
} from "../utils/manualGradingShortcuts";
import styles from "./ManualExamGradingGrid.module.css";

type Props = {
  examId: number;
  onApplied?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  showUnavailableState?: boolean;
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

export default function ManualExamGradingGrid({
  examId,
  onApplied,
  onDirtyChange,
  showUnavailableState = false,
}: Props) {
  const queryClient = useQueryClient();
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const autoFocusedExamRef = useRef<number | null>(null);
  const sheetQuery = useQuery({
    queryKey: adminResultsQueryKeys.manualGradeSheet(examId),
    queryFn: () => fetchManualGradeSheet(examId),
  });
  const { data: exam } = useAdminExam(examId);
  const data = sheetQuery.data;
  const [draftRows, setDraftRows] = useState<ManualGradeRow[]>([]);
  const [questionScoreDraft, setQuestionScoreDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartCount, setQuickStartCount] = useState<number | "">("");
  const [shortcuts, setShortcuts] = useState(loadManualGradingShortcuts);
  const [shortcutDraft, setShortcutDraft] = useState(shortcuts);
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  useEffect(() => {
    if (!sheetQuery.data) return;
    setDraftRows(cloneRows(sheetQuery.data.rows));
    setQuestionScoreDraft(
      Object.fromEntries(
        sheetQuery.data.questions.map((question) => [
          String(question.question_id),
          formatScoreInput(question.max_score),
        ]),
      ),
    );
    setDirty(false);
  }, [sheetQuery.data]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const requestRows = useMemo(
    () => buildRequestRows(draftRows),
    [draftRows],
  );
  const questionScoreState = useMemo(
    () => buildQuestionScoreState(data, questionScoreDraft),
    [data, questionScoreDraft],
  );

  const previewMutation = useMutation({
    mutationFn: () =>
      previewManualGrades(
        examId,
        requestRows,
        questionScoreState.changes,
      ),
    onError: (error) =>
      feedback.error(extractApiError(error, "입력한 채점 결과를 확인하지 못했습니다.")),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      applyManualGrades(
        examId,
        requestRows,
        questionScoreState.changes,
      ),
    onSuccess: async (result) => {
      feedback.success(`${result.matched_count}명의 성적을 확정했습니다.`);
      previewMutation.reset();
      setDirty(false);
      onApplied?.();
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

  const quickStartMutation = useMutation({
    mutationFn: async () => {
      const count = Number(quickStartCount);
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        throw new Error("문항 수는 1개부터 500개까지 입력해 주세요.");
      }
      const maxScore = Number(data?.exam_max_score ?? exam?.max_score ?? 100);
      return initExamQuestions({
        examId,
        total_questions: count,
        default_score: maxScore > 0 ? maxScore / count : 1,
      });
    },
    onSuccess: async () => {
      feedback.success(`${quickStartCount}문항 채점표를 만들었습니다.`);
      setQuickStartOpen(false);
      setQuickStartCount("");
      await Promise.all([
        sheetQuery.refetch(),
        queryClient.invalidateQueries({
          queryKey: adminExamsQueryKeys.examQuestions(examId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminExamsQueryKeys.adminExam(examId),
        }),
      ]);
    },
    onError: (error) =>
      feedback.error(extractApiError(error, "문항별 채점표를 만들지 못했습니다.")),
  });

  const visibleQuestions = useMemo(
    () => data?.questions ?? [],
    [data?.questions],
  );
  const hasEditableQuestions = visibleQuestions.some(
    (question) => question.editable,
  );
  const preview = previewMutation.data;
  const hasErrors = Boolean(preview?.errors.length);
  const busy =
    previewMutation.isPending ||
    applyMutation.isPending ||
    quickStartMutation.isPending;

  const focusCell = useCallback((
    current: HTMLButtonElement,
    direction: "next" | "previous" | "up" | "down",
  ) => {
    const cells = Array.from(
      tableWrapRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-manual-grade-cell]:not(:disabled)",
      ) ?? [],
    );
    if (cells.length === 0) return;
    const currentIndex = cells.indexOf(current);
    if (currentIndex < 0) return;

    if (direction === "next" || direction === "previous") {
      const delta = direction === "next" ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(cells.length - 1, currentIndex + delta));
      cells[nextIndex]?.focus();
      return;
    }

    const rowIndex = Number(current.dataset.rowIndex);
    const columnIndex = Number(current.dataset.columnIndex);
    const delta = direction === "down" ? 1 : -1;
    let candidateRow = rowIndex + delta;
    while (candidateRow >= 0 && candidateRow < draftRows.length) {
      const candidate = cells.find(
        (cell) =>
          Number(cell.dataset.rowIndex) === candidateRow &&
          Number(cell.dataset.columnIndex) === columnIndex,
      );
      if (candidate) {
        candidate.focus();
        return;
      }
      candidateRow += delta;
    }
  }, [draftRows.length]);

  useEffect(() => {
    autoFocusedExamRef.current = null;
  }, [examId]);

  useEffect(() => {
    if (
      autoFocusedExamRef.current === examId ||
      !data?.has_manual_questions ||
      busy ||
      shortcutSettingsOpen ||
      draftRows.length === 0
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const firstCell = tableWrapRef.current?.querySelector<HTMLButtonElement>(
        "[data-manual-grade-cell]:not(:disabled)",
      );
      if (!firstCell) return;
      firstCell.focus();
      autoFocusedExamRef.current = examId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy, data?.has_manual_questions, draftRows.length, examId, shortcutSettingsOpen]);

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
  if (!data) return null;
  if (visibleQuestions.length === 0) {
    if (!showUnavailableState) return null;
    return (
      <>
        <section className={`${styles.card} ${styles.emptyStart}`}>
          <div className={styles.emptyStartHeading}>
            <span className={styles.icon} aria-hidden>
              <ClipboardCheck size={ICON.lg} />
            </span>
            <div>
              <h3>문항을 어떤 방식으로 준비할까요?</h3>
              <p>
                객관식 자동채점은 정답을 등록하고, 정오만 빠르게 기록할 시험은
                문항 수로 바로 시작하세요.
              </p>
            </div>
          </div>
          <div className={styles.emptyActionGrid}>
            <button
              type="button"
              className={styles.emptyAction}
              onClick={() => setAnswerKeyOpen(true)}
            >
              <span className={styles.emptyActionIcon} aria-hidden>
                <ScanLine size={ICON.md} />
              </span>
              <span>
                <strong>객관식 답안 등록</strong>
                <small>정답·문항 유형·배점을 등록해 OMR 자동채점을 준비합니다.</small>
              </span>
            </button>
            <button
              type="button"
              className={styles.emptyAction}
              onClick={() => setQuickStartOpen((open) => !open)}
              aria-expanded={quickStartOpen}
            >
              <span className={styles.emptyActionIcon} aria-hidden>
                <ListChecks size={ICON.md} />
              </span>
              <span>
                <strong>문항 수로 바로 시작</strong>
                <small>정답표 없이 O/X와 문항별 배점을 이 표에서 입력합니다.</small>
              </span>
            </button>
          </div>
          {quickStartOpen && (
            <div className={styles.quickStartForm}>
              <label htmlFor={`manual-question-count-${examId}`}>
                <span>전체 문항 수</span>
                <input
                  id={`manual-question-count-${examId}`}
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={quickStartCount}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setQuickStartCount(raw === "" ? "" : Number(raw));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && quickStartCount !== "") {
                      quickStartMutation.mutate();
                    }
                  }}
                  autoFocus
                />
              </label>
              <p>
                시험 만점 {formatScore(data.exam_max_score ?? exam?.max_score ?? 100)}점을
                문항 수로 나눠 기본 배점을 만들며, 다음 화면에서 각 문항 배점을
                바꿀 수 있습니다.
              </p>
              <Button
                type="button"
                intent="primary"
                size="sm"
                loading={quickStartMutation.isPending}
                disabled={
                  quickStartCount === "" ||
                  quickStartCount < 1 ||
                  quickStartCount > 500
                }
                onClick={() => quickStartMutation.mutate()}
              >
                채점표 만들기
              </Button>
            </div>
          )}
        </section>
        <AnswerKeyRegisterModal
          open={answerKeyOpen}
          onClose={() => {
            setAnswerKeyOpen(false);
            void sheetQuery.refetch();
          }}
          examId={examId}
          structureOwnerId={exam?.structure_owner_id ?? examId}
          canEditQuestions={exam?.can_edit_structure ?? true}
        />
      </>
    );
  }

  const openShortcutSettings = () => {
    setShortcutDraft(shortcuts);
    setShortcutError(null);
    setShortcutSettingsOpen(true);
  };

  const closeShortcutSettings = () => {
    setShortcutDraft(shortcuts);
    setShortcutError(null);
    setShortcutSettingsOpen(false);
  };

  const persistShortcutSettings = () => {
    const error = validateManualGradingShortcuts(shortcutDraft);
    if (error) {
      setShortcutError(error);
      return;
    }
    try {
      const saved = saveManualGradingShortcuts(shortcutDraft);
      setShortcuts(saved);
      setShortcutDraft(saved);
      setShortcutSettingsOpen(false);
      setShortcutError(null);
      feedback.success("정오 입력 단축키를 이 기기에 저장했습니다.");
    } catch (error: unknown) {
      setShortcutError(
        error instanceof Error ? error.message : "단축키를 저장하지 못했습니다.",
      );
    }
  };

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

  const setQuestionScore = (questionId: number, score: string) => {
    setQuestionScoreDraft((current) => ({
      ...current,
      [String(questionId)]: score,
    }));
    setDirty(true);
    previewMutation.reset();
  };

  const reset = () => {
    setDraftRows(cloneRows(data.rows));
    setQuestionScoreDraft(
      Object.fromEntries(
        data.questions.map((question) => [
          String(question.question_id),
          formatScoreInput(question.max_score),
        ]),
      ),
    );
    setDirty(false);
    previewMutation.reset();
  };

  return (
    <section
      className={styles.card}
      aria-labelledby="manual-grading-title"
      onKeyDownCapture={(event) => {
        if (
          hasEditableQuestions &&
          data.manual_grading_method === "correctness" &&
          event.shiftKey &&
          event.key === "?"
        ) {
          event.preventDefault();
          openShortcutSettings();
        }
      }}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            <ClipboardCheck size={ICON.lg} />
          </span>
          <div>
            <h3 id="manual-grading-title">문항별 직접 채점</h3>
            <p>
              {data.grading_mode === "choice"
                ? "자동채점 정오와 점수를 확인하고 필요한 문항만 보정합니다."
                : data.grading_mode === "mixed"
                  ? "선택형 자동채점 결과를 확인하고 답변형 점수를 함께 확정합니다."
                  : data.manual_grading_method === "correctness"
                    ? "정오를 입력한 뒤 한 번에 확인하고 성적을 확정합니다."
                    : "문항별 점수를 입력한 뒤 한 번에 확인하고 성적을 확정합니다."}
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
          {hasEditableQuestions && data.manual_grading_method === "correctness" && (
            <Button
              type="button"
              intent="secondary"
              size="sm"
              leftIcon={<Settings2 size={ICON_FOR_BUTTON.sm} />}
              onClick={openShortcutSettings}
            >
              단축키 설정
            </Button>
          )}
        </div>
      </header>

      {!hasEditableQuestions ? (
        <div className={styles.readOnlyNotice}>
          자동채점 결과를 표시하고 있습니다. 문항별 보정 기능이 열리기 전까지는
          정오 목록을 조회할 수 있습니다.
        </div>
      ) : data.manual_grading_method === "correctness" ? (
        <div className={styles.legend} aria-label="정오 입력표 범례">
          <span className={styles.legendCorrect}><b>{shortcuts.correct}</b> 정답</span>
          <span className={styles.legendWrong}><b>{shortcuts.incorrect}</b> 오답</span>
          <span className={styles.legendReview}>
            <b>{shortcuts.review}</b> 정답 · 오답노트에 포함
          </span>
          <span>입력 후 다음 칸 이동 · 방향키 이동 · Shift+? 단축키 보기</span>
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
          선택형은 자동채점 정오를 함께 표시하되 원래 답안은 보존합니다. OMR 채점이
          끝난 학생만 답변형 점수를 확정할 수 있습니다.
        </div>
      )}

      {hasEditableQuestions && (
        <div
          className={`${styles.scoreSummary} ${
            questionScoreState.error ? styles.scoreSummaryError : ""
          }`}
          role={questionScoreState.error ? "alert" : "status"}
        >
          <span>
            배점 합계{" "}
            <strong>{formatScore(questionScoreState.configuredTotal)}점</strong>
            {" / "}시험 만점 {formatScore(questionScoreState.examMaxScore)}점
          </span>
          {questionScoreState.error ? (
            <span>{questionScoreState.error}</span>
          ) : (
            <span>문항 제목 아래 배점을 직접 수정할 수 있습니다.</span>
          )}
        </div>
      )}

      {hasEditableQuestions && shortcutSettingsOpen && (
        <div className={styles.shortcutPanel} role="group" aria-labelledby="manual-shortcut-title">
          <div className={styles.shortcutPanelHeading}>
            <div>
              <strong id="manual-shortcut-title">정오 입력 단축키</strong>
              <span>입력칸을 누르고 원하는 한 글자 키를 누르세요.</span>
            </div>
            <span>이 기기에 저장</span>
          </div>
          <div className={styles.shortcutFields}>
            <ShortcutKeyInput
              label="정답"
              value={shortcutDraft.correct}
              tone="correct"
              onChange={(correct) => {
                setShortcutDraft((current) => ({ ...current, correct }));
                setShortcutError(null);
              }}
            />
            <ShortcutKeyInput
              label="오답"
              value={shortcutDraft.incorrect}
              tone="incorrect"
              onChange={(incorrect) => {
                setShortcutDraft((current) => ({ ...current, incorrect }));
                setShortcutError(null);
              }}
            />
            <ShortcutKeyInput
              label="정답 + 오답노트"
              value={shortcutDraft.review}
              tone="review"
              onChange={(review) => {
                setShortcutDraft((current) => ({ ...current, review }));
                setShortcutError(null);
              }}
            />
          </div>
          {shortcutError && <p className={styles.shortcutError} role="alert">{shortcutError}</p>}
          <div className={styles.shortcutPanelActions}>
            <Button
              type="button"
              intent="ghost"
              size="sm"
              onClick={() => {
                setShortcutDraft(DEFAULT_MANUAL_GRADING_SHORTCUTS);
                setShortcutError(null);
              }}
            >
              기본값으로
            </Button>
            <Button type="button" intent="secondary" size="sm" onClick={closeShortcutSettings}>
              취소
            </Button>
            <Button type="button" intent="primary" size="sm" onClick={persistShortcutSettings}>
              저장
            </Button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap} ref={tableWrapRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.studentColumn}>학생</th>
              <th className={styles.attendanceColumn}>응시</th>
              {visibleQuestions.map((question) => {
                const key = String(question.question_id);
                return (
                  <th key={question.question_id}>
                    <strong>{question.number}</strong>
                    {question.editable ? (
                      <label className={styles.questionScoreInput}>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={questionScoreDraft[key] ?? ""}
                          disabled={busy}
                          aria-label={`${question.number}번 배점`}
                          onChange={(event) =>
                            setQuestionScore(
                              question.question_id,
                              event.target.value,
                            )
                          }
                        />
                        <i>점</i>
                      </label>
                    ) : (
                      <span>{formatScore(question.max_score)}점</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {draftRows.map((row, rowIndex) => (
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
                    disabled={!hasEditableQuestions || busy}
                    onClick={() =>
                      setAttendance(row.enrollment_id, !row.is_not_submitted)
                    }
                  >
                    {row.is_not_submitted ? "결시" : "응시"}
                  </button>
                </td>
                {visibleQuestions.map((question, columnIndex) => {
                  const key = String(question.question_id);
                  const cell = row.cells[key];
                  const draftMaxScore = Number(questionScoreDraft[key]);
                  const maxScore = Number.isFinite(draftMaxScore)
                    ? draftMaxScore
                    : question.max_score;
                  return (
                    <td key={question.question_id} className={styles.gradeCell}>
                      {!cell.editable ? (
                        <ReadOnlyGradeCell
                          cell={cell}
                          studentName={row.student_name}
                          questionNumber={question.number}
                        />
                      ) : data.manual_grading_method === "correctness" ? (
                        <CorrectnessCell
                          value={cell.state}
                          disabled={row.is_not_submitted || busy}
                          studentName={row.student_name}
                          questionNumber={question.number}
                          rowIndex={rowIndex}
                          columnIndex={columnIndex}
                          shortcuts={shortcuts}
                          onMoveFocus={(element, direction) =>
                            focusCell(element, direction)
                          }
                          onShowShortcuts={openShortcutSettings}
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
                          maxScore={maxScore}
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

      {hasEditableQuestions && (
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
              disabled={!dirty || busy || Boolean(questionScoreState.error)}
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
      )}
    </section>
  );
}

function ReadOnlyGradeCell({
  cell,
  studentName,
  questionNumber,
}: {
  cell: ManualGradeCell;
  studentName: string;
  questionNumber: number;
}) {
  const label = cell.state ? STATE_LABEL[cell.state] : "·";
  return (
    <div
      className={`${styles.correctnessCell} ${styles.readOnlyCell} ${
        cell.state ? styles[cell.state] : styles.empty
      }`}
      aria-label={`${studentName} ${questionNumber}번 자동채점 ${cell.state ? STATE_LABEL[cell.state] : "결과 없음"}`}
      title={cell.score == null ? "자동채점 결과 없음" : `${formatScore(cell.score)}점`}
    >
      {label}
    </div>
  );
}

function CorrectnessCell({
  value,
  disabled,
  studentName,
  questionNumber,
  rowIndex,
  columnIndex,
  shortcuts,
  onMoveFocus,
  onShowShortcuts,
  onChange,
}: {
  value: ManualGradeState | null;
  disabled: boolean;
  studentName: string;
  questionNumber: number;
  rowIndex: number;
  columnIndex: number;
  shortcuts: ManualGradingShortcutSettings;
  onMoveFocus: (
    element: HTMLButtonElement,
    direction: "next" | "previous" | "up" | "down",
  ) => void;
  onShowShortcuts: () => void;
  onChange: (value: ManualGradeState | null) => void;
}) {
  const cycle = () => {
    const index = STATE_ORDER.indexOf(value);
    onChange(STATE_ORDER[(index + 1) % STATE_ORDER.length]);
  };
  return (
    <button
      type="button"
      className={`${styles.correctnessCell} ${
        value ? styles[value] : styles.empty
      }`}
      disabled={disabled}
      aria-label={`${studentName} ${questionNumber}번 ${value ? STATE_LABEL[value] : "미입력"}`}
      aria-keyshortcuts={`${shortcuts.correct} ${shortcuts.incorrect} ${shortcuts.review}`}
      data-manual-grade-cell
      data-row-index={rowIndex}
      data-column-index={columnIndex}
      onClick={cycle}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.shiftKey && event.key === "?") {
          event.preventDefault();
          onShowShortcuts();
          return;
        }
        const state = getManualGradeStateFromShortcut(event.key, shortcuts);
        if (state) {
          event.preventDefault();
          const cell = event.currentTarget;
          onChange(state);
          window.requestAnimationFrame(() => onMoveFocus(cell, "next"));
          return;
        }
        if (event.key === "ArrowRight" || event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
          event.preventDefault();
          onMoveFocus(event.currentTarget, "next");
        } else if (event.key === "ArrowLeft" || (event.key === "Tab" && event.shiftKey)) {
          event.preventDefault();
          onMoveFocus(event.currentTarget, "previous");
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onMoveFocus(event.currentTarget, "down");
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          onMoveFocus(event.currentTarget, "up");
        } else if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          onChange(null);
        } else if (event.key === " ") {
          event.preventDefault();
          cycle();
        }
      }}
    >
      {value ? STATE_LABEL[value] : "·"}
    </button>
  );
}

function ShortcutKeyInput({
  label,
  value,
  tone,
  onChange,
}: {
  label: string;
  value: string;
  tone: "correct" | "incorrect" | "review";
  onChange: (value: string) => void;
}) {
  return (
    <label className={`${styles.shortcutField} ${styles[tone]}`}>
      <span>{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        aria-label={`${label} 단축키`}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
          event.preventDefault();
          const key = normalizeManualGradingShortcutKey(event.key);
          if (key) onChange(key);
        }}
      />
    </label>
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

function buildQuestionScoreState(
  data: ManualGradeSheet | undefined,
  draft: Record<string, string>,
): {
  configuredTotal: number;
  examMaxScore: number;
  changes?: ManualGradeQuestionScoreChanges;
  error: string | null;
} {
  if (!data) {
    return {
      configuredTotal: 0,
      examMaxScore: 0,
      error: null,
    };
  }

  const questionScores: Record<string, number> = {};
  const expectedQuestionScores: Record<string, number> = {};
  let questionTotal = 0;
  let hasChanges = false;

  for (const question of data.questions) {
    const key = String(question.question_id);
    const raw = draft[key] ?? formatScoreInput(question.max_score);
    const score = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(score) || score < 0) {
      return {
        configuredTotal: questionTotal,
        examMaxScore: Number(data.exam_max_score ?? 0),
        error: `${question.number}번 배점을 0점 이상으로 입력해 주세요.`,
      };
    }
    questionTotal += score;
    if (question.editable && Math.abs(score - question.max_score) > 0.001) {
      hasChanges = true;
      questionScores[key] = score;
      expectedQuestionScores[key] = question.max_score;
    }
  }

  const configuredTotal =
    questionTotal + Number(data.score_adjustment_total ?? 0);
  const examMaxScore = Number(
    data.exam_max_score ??
      configuredTotal,
  );
  const totalError =
    hasChanges && Math.abs(configuredTotal - examMaxScore) > 0.01
      ? `배점 합계를 시험 만점 ${formatScore(examMaxScore)}점에 맞춰 주세요.`
      : null;

  return {
    configuredTotal,
    examMaxScore,
    changes: hasChanges
      ? {
          question_scores: questionScores,
          expected_question_scores: expectedQuestionScores,
        }
      : undefined,
    error: totalError,
  };
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatScoreInput(value: number): string {
  return Number(value.toFixed(4)).toString();
}
