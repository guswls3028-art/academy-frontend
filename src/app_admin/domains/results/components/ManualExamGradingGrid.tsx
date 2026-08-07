import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Minus,
  Plus,
  Redo2,
  RefreshCw,
  ScanLine,
  Settings2,
  TableProperties,
  Undo2,
  UserX,
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
  type ManualGradeQuestion,
  type ManualGradeQuestionScoreChanges,
} from "../api/manualExamGrading";
import { adminResultsQueryKeys } from "../queryKeys";
import {
  DEFAULT_MANUAL_GRADING_SHORTCUTS,
  getManualGradeStateFromKeyboardShortcut,
  getManualGradeStateFromShortcut,
  loadManualGradingShortcuts,
  normalizeManualGradingShortcutKey,
  saveManualGradingShortcuts,
  validateManualGradingShortcuts,
  type ManualGradingShortcutSettings,
} from "../utils/manualGradingShortcuts";
import styles from "./ManualExamGradingGrid.module.css";
import overviewStyles from "./ManualExamGradingOverview.module.css";

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
  review: "오답노트",
};

const STATE_CELL_LABEL: Record<ManualGradeState, string> = {
  correct: "O",
  incorrect: "X",
  review: "노트",
};

const TABLE_SCALE_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120] as const;
const TABLE_SCALE_STORAGE_KEY = "academy.manual-grading-table-scale.v1";
const TABLE_OVERVIEW_MAX_SCALE = 40;

function getPrimaryShortcutModifierLabel(): "Ctrl" | "⌘" {
  if (typeof navigator === "undefined") return "Ctrl";
  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘" : "Ctrl";
}

function getClosestTableScale(value: number): (typeof TABLE_SCALE_STEPS)[number] {
  return TABLE_SCALE_STEPS.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest,
  );
}

function loadManualGradingTableScale(): (typeof TABLE_SCALE_STEPS)[number] | null {
  try {
    const value = Number(window.localStorage.getItem(TABLE_SCALE_STORAGE_KEY));
    return TABLE_SCALE_STEPS.includes(value as (typeof TABLE_SCALE_STEPS)[number])
      ? (value as (typeof TABLE_SCALE_STEPS)[number])
      : null;
  } catch {
    return null;
  }
}

type ManualGradeCellChange = {
  enrollmentId: number;
  questionId: number;
  before: ManualGradeCell;
  after: ManualGradeCell;
};

type ManualGradeHistoryEntry =
  | {
      kind: "cells";
      changes: ManualGradeCellChange[];
    }
  | {
      kind: "attendance";
      changes: Array<{
        enrollmentId: number;
        before: boolean;
        after: boolean;
      }>;
    }
  | {
      kind: "question-score";
      questionId: number;
      before: string;
      after: string;
    };

export default function ManualExamGradingGrid({
  examId,
  onApplied,
  onDirtyChange,
  showUnavailableState = false,
}: Props) {
  const queryClient = useQueryClient();
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const naturalTableSizeRef = useRef<{ width: number; height: number } | null>(null);
  const autoFocusedExamRef = useRef<number | null>(null);
  const autoFittedExamRef = useRef<number | null>(null);
  const hasSavedTableScaleRef = useRef(false);
  const [tableScale, setTableScale] = useState(() => {
    const savedScale = loadManualGradingTableScale();
    hasSavedTableScaleRef.current = savedScale != null;
    return savedScale ?? 100;
  });
  const sheetQuery = useQuery({
    queryKey: adminResultsQueryKeys.manualGradeSheet(examId),
    queryFn: () => fetchManualGradeSheet(examId),
  });
  const { data: exam } = useAdminExam(examId);
  const data = sheetQuery.data;
  const [draftRows, setDraftRows] = useState<ManualGradeRow[]>([]);
  const [questionScoreDraft, setQuestionScoreDraft] = useState<Record<string, string>>({});
  const draftRowsRef = useRef<ManualGradeRow[]>([]);
  const questionScoreDraftRef = useRef<Record<string, string>>({});
  const undoStackRef = useRef<ManualGradeHistoryEntry[]>([]);
  const redoStackRef = useRef<ManualGradeHistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [dirty, setDirty] = useState(false);
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartCount, setQuickStartCount] = useState<number | "">("");
  const [shortcuts, setShortcuts] = useState(loadManualGradingShortcuts);
  const [shortcutDraft, setShortcutDraft] = useState(shortcuts);
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const primaryShortcutModifier = getPrimaryShortcutModifierLabel();
  const isOverviewMode = tableScale <= TABLE_OVERVIEW_MAX_SCALE;

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }, []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryState();
  }, [syncHistoryState]);

  const pushHistory = useCallback((
    entry: ManualGradeHistoryEntry,
  ) => {
    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    redoStackRef.current = [];
    syncHistoryState();
  }, [syncHistoryState]);

  useEffect(() => {
    if (!sheetQuery.data) return;
    const nextRows = cloneRows(sheetQuery.data.rows);
    const nextScores = Object.fromEntries(
      sheetQuery.data.questions.map((question) => [
        String(question.question_id),
        formatScoreInput(question.max_score),
      ]),
    );
    draftRowsRef.current = nextRows;
    questionScoreDraftRef.current = nextScores;
    setDraftRows(nextRows);
    setQuestionScoreDraft(nextScores);
    clearHistory();
    setDirty(false);
  }, [clearHistory, sheetQuery.data]);

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
  const questionTypeCounts = useMemo(
    () =>
      visibleQuestions.reduce(
        (counts, question) => {
          const answerType = getQuestionAnswerType(question);
          counts[answerType] += 1;
          return counts;
        },
        {
          choice: 0,
          numeric_short_answer: 0,
          written: 0,
        },
      ),
    [visibleQuestions],
  );
  const hasEditableQuestions = visibleQuestions.some(
    (question) => question.editable,
  );
  const emptyCorrectnessCount = useMemo(() => {
    if (data?.manual_grading_method !== "correctness") return 0;
    return draftRows.reduce((total, row) => {
      if (row.is_not_submitted) return total;
      return total + visibleQuestions.reduce((rowTotal, question) => {
        const cell = row.cells[String(question.question_id)];
        return rowTotal + (
          cell?.editable &&
          cell.entry_method === "correctness" &&
          cell.state == null
            ? 1
            : 0
        );
      }, 0);
    }, 0);
  }, [data?.manual_grading_method, draftRows, visibleQuestions]);
  const quickStartMaxScore = Number(data?.exam_max_score ?? exam?.max_score ?? 100);
  const quickStartDefaultScore =
    quickStartCount !== "" && Number(quickStartCount) > 0
      ? quickStartMaxScore / Number(quickStartCount)
      : null;
  const preview = previewMutation.data;
  const hasErrors = Boolean(preview?.errors.length);
  const busy =
    previewMutation.isPending ||
    applyMutation.isPending ||
    quickStartMutation.isPending;

  const applyTableScale = useCallback((nextScale: number, persist = true) => {
    const scale = getClosestTableScale(nextScale);
    setTableScale(scale);
    if (!persist) return;
    hasSavedTableScaleRef.current = true;
    try {
      window.localStorage.setItem(TABLE_SCALE_STORAGE_KEY, String(scale));
    } catch {
      // Private browsing or a storage policy can block persistence.
    }
  }, []);

  const changeTableScale = useCallback((direction: -1 | 1) => {
    const currentIndex = TABLE_SCALE_STEPS.indexOf(
      tableScale as (typeof TABLE_SCALE_STEPS)[number],
    );
    const nextIndex = Math.min(
      TABLE_SCALE_STEPS.length - 1,
      Math.max(0, currentIndex + direction),
    );
    applyTableScale(TABLE_SCALE_STEPS[nextIndex]);
  }, [applyTableScale, tableScale]);

  const measureNaturalTable = useCallback(() => {
    const table = tableRef.current;
    if (!table) return null;

    const hadOverviewClass = table.classList.contains(overviewStyles.overviewTable);
    const previousMinWidth = table.style.minWidth;
    const previousZoom = table.style.getPropertyValue("zoom");
    if (hadOverviewClass) table.classList.remove(overviewStyles.overviewTable);
    table.style.minWidth = "0";
    table.style.setProperty("zoom", "1");

    try {
      const measured = {
        width: table.scrollWidth,
        height: table.scrollHeight,
      };
      naturalTableSizeRef.current = measured;
      return measured;
    } finally {
      table.style.minWidth = previousMinWidth;
      table.style.setProperty("zoom", previousZoom);
      if (hadOverviewClass) table.classList.add(overviewStyles.overviewTable);
    }
  }, []);

  const fitTableToViewport = useCallback((persist = false) => {
    const tableWrap = tableWrapRef.current;
    const table = tableRef.current;
    const naturalTable = measureNaturalTable();
    if (!tableWrap || !table || !naturalTable) return;

    const naturalWidth = naturalTable.width;
    const viewportWidth = tableWrap.clientWidth;
    if (naturalWidth <= 0) return;
    if (naturalWidth <= viewportWidth + 1) {
      applyTableScale(100, persist);
      return;
    }
    const availableWidth = Math.max(1, viewportWidth - 4);

    const idealScale = Math.min(
      100,
      Math.floor((availableWidth * 100) / naturalWidth),
    );
    const nextScale = [...TABLE_SCALE_STEPS]
      .reverse()
      .find((scale) => scale <= idealScale) ?? TABLE_SCALE_STEPS[0];
    applyTableScale(nextScale, persist);
  }, [applyTableScale, measureNaturalTable]);

  const fitEntireTableToViewport = useCallback(() => {
    const tableWrap = tableWrapRef.current;
    const naturalTable = measureNaturalTable();
    if (!tableWrap || !naturalTable) return;

    const availableWidth = Math.max(1, tableWrap.clientWidth - 4);
    const availableHeight = Math.max(1, tableWrap.clientHeight - 4);
    const idealScale = Math.min(
      100,
      Math.floor(Math.min(
        availableWidth / naturalTable.width,
        availableHeight / naturalTable.height,
      ) * 100),
    );
    const nextScale = [...TABLE_SCALE_STEPS]
      .reverse()
      .find((scale) => scale <= idealScale) ?? TABLE_SCALE_STEPS[0];
    applyTableScale(nextScale);
    tableWrap.scrollTo({ left: 0, top: 0 });
  }, [applyTableScale, measureNaturalTable]);

  const closeAnswerKeyModal = () => {
    setAnswerKeyOpen(false);
    void Promise.all([
      sheetQuery.refetch(),
      queryClient.invalidateQueries({
        queryKey: adminExamsQueryKeys.examQuestions(examId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminExamsQueryKeys.adminExam(examId),
      }),
    ]);
  };

  const applyHistoryEntry = useCallback((
    entry: ManualGradeHistoryEntry,
    direction: "undo" | "redo",
  ) => {
    if (entry.kind === "question-score") {
      const key = String(entry.questionId);
      const nextValue = direction === "undo" ? entry.before : entry.after;
      const nextScores = {
        ...questionScoreDraftRef.current,
        [key]: nextValue,
      };
      questionScoreDraftRef.current = nextScores;
      setQuestionScoreDraft(nextScores);
    } else if (entry.kind === "attendance") {
      const changes = new Map(
        entry.changes.map((change) => [
          change.enrollmentId,
          direction === "undo" ? change.before : change.after,
        ]),
      );
      const nextRows = draftRowsRef.current.map((row) =>
        changes.has(row.enrollment_id)
          ? { ...row, is_not_submitted: changes.get(row.enrollment_id) ?? false }
          : row
      );
      draftRowsRef.current = nextRows;
      setDraftRows(nextRows);
    } else {
      const changes = new Map(
        entry.changes.map((change) => [
          `${change.enrollmentId}:${change.questionId}`,
          direction === "undo" ? change.before : change.after,
        ]),
      );
      const nextRows = draftRowsRef.current.map((row) => {
        let nextCells = row.cells;
        for (const questionId of Object.keys(row.cells)) {
          const nextCell = changes.get(`${row.enrollment_id}:${questionId}`);
          if (!nextCell) continue;
          if (nextCells === row.cells) nextCells = { ...row.cells };
          nextCells[questionId] = { ...nextCell };
        }
        return nextCells === row.cells ? row : { ...row, cells: nextCells };
      });
      draftRowsRef.current = nextRows;
      setDraftRows(nextRows);
    }
    previewMutation.reset();
  }, [previewMutation]);

  const undoLastChange = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return false;
    applyHistoryEntry(entry, "undo");
    redoStackRef.current.push(entry);
    syncHistoryState();
    setDirty(undoStackRef.current.length > 0);
    return true;
  }, [applyHistoryEntry, syncHistoryState]);

  const redoLastChange = useCallback(() => {
    const entry = redoStackRef.current.pop();
    if (!entry) return false;
    applyHistoryEntry(entry, "redo");
    undoStackRef.current.push(entry);
    syncHistoryState();
    setDirty(true);
    return true;
  }, [applyHistoryEntry, syncHistoryState]);

  const focusCell = useCallback((
    current: HTMLElement,
    direction: "next" | "previous" | "up" | "down",
  ) => {
    const rowIndex = Number(current.dataset.rowIndex);
    const columnIndex = Number(current.dataset.columnIndex);
    const columnCount = visibleQuestions.length;
    if (
      !Number.isInteger(rowIndex) ||
      !Number.isInteger(columnIndex) ||
      columnCount === 0
    ) {
      return;
    }

    const findFocusableCell = (candidateRow: number, candidateColumn: number) =>
      tableWrapRef.current?.querySelector<HTMLElement>(
        `[data-manual-grade-cell][data-row-index="${candidateRow}"][data-column-index="${candidateColumn}"]:not(:disabled)`,
      ) ?? null;

    if (direction === "next" || direction === "previous") {
      const delta = direction === "next" ? 1 : -1;
      const lastIndex = draftRows.length * columnCount - 1;
      let candidateIndex = rowIndex * columnCount + columnIndex + delta;
      while (candidateIndex >= 0 && candidateIndex <= lastIndex) {
        const candidate = findFocusableCell(
          Math.floor(candidateIndex / columnCount),
          candidateIndex % columnCount,
        );
        if (candidate) {
          candidate.focus();
          return;
        }
        candidateIndex += delta;
      }
      return;
    }

    const delta = direction === "down" ? 1 : -1;
    let candidateRow = rowIndex + delta;
    while (candidateRow >= 0 && candidateRow < draftRows.length) {
      const candidate = findFocusableCell(candidateRow, columnIndex);
      if (candidate) {
        candidate.focus();
        return;
      }
      candidateRow += delta;
    }
  }, [draftRows.length, visibleQuestions.length]);

  useEffect(() => {
    autoFocusedExamRef.current = null;
    autoFittedExamRef.current = null;
    naturalTableSizeRef.current = null;
  }, [examId]);

  useEffect(() => {
    if (
      hasSavedTableScaleRef.current ||
      autoFittedExamRef.current === examId ||
      visibleQuestions.length === 0 ||
      draftRows.length === 0
    ) {
      return;
    }
    autoFittedExamRef.current = examId;
    const frame = window.requestAnimationFrame(() => fitTableToViewport(false));
    return () => window.cancelAnimationFrame(frame);
  }, [draftRows.length, examId, fitTableToViewport, visibleQuestions.length]);

  useEffect(() => {
    if (draftRows.length === 0 || isOverviewMode) return;
    const frame = window.requestAnimationFrame(() => {
      measureNaturalTable();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftRows.length, isOverviewMode, measureNaturalTable, visibleQuestions.length]);

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
      const firstCell = tableWrapRef.current?.querySelector<HTMLElement>(
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
          description={extractApiError(
            sheetQuery.error,
            "시험 문항과 접근 권한을 확인한 뒤 다시 불러오세요.",
          )}
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
              <div className={styles.quickStartPreview} aria-live="polite">
                {quickStartDefaultScore == null ? (
                  <p>문항 수를 입력하면 균등 배점을 바로 계산합니다.</p>
                ) : (
                  <>
                    <strong>
                      {quickStartCount}문항 · 문항당 약{" "}
                      {formatScore(quickStartDefaultScore)}점
                    </strong>
                    <p>
                      합계 {formatScore(quickStartMaxScore)}점 · 만든 뒤 문항별
                      배점을 표에서 조정할 수 있습니다.
                    </p>
                  </>
                )}
              </div>
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
          onClose={closeAnswerKeyModal}
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
    const row = draftRowsRef.current.find(
      (candidate) => candidate.enrollment_id === enrollmentId,
    );
    const key = String(questionId);
    const current = row?.cells[key];
    if (!row || !current) return;
    const nextCell = updater({ ...current });
    if (sameManualGradeCell(current, nextCell)) return;
    pushHistory({
      kind: "cells",
      changes: [{
        enrollmentId,
        questionId,
        before: { ...current },
        after: { ...nextCell },
      }],
    });
    const nextRows = draftRowsRef.current.map((candidate) =>
      candidate.enrollment_id === enrollmentId
        ? {
            ...candidate,
            cells: {
              ...candidate.cells,
              [key]: nextCell,
            },
          }
        : candidate,
    );
    draftRowsRef.current = nextRows;
    setDraftRows(nextRows);
    setDirty(true);
    previewMutation.reset();
  };

  const setAttendance = (enrollmentId: number, absent: boolean) => {
    const row = draftRowsRef.current.find(
      (candidate) => candidate.enrollment_id === enrollmentId,
    );
    if (!row || row.is_not_submitted === absent) return;
    pushHistory({
      kind: "attendance",
      changes: [{
        enrollmentId,
        before: row.is_not_submitted,
        after: absent,
      }],
    });
    const nextRows = draftRowsRef.current.map((candidate) =>
      candidate.enrollment_id === enrollmentId
        ? { ...candidate, is_not_submitted: absent }
        : candidate,
    );
    draftRowsRef.current = nextRows;
    setDraftRows(nextRows);
    setDirty(true);
    previewMutation.reset();
  };

  const setAllAbsent = () => {
    const changes = draftRowsRef.current
      .filter((row) => !row.is_not_submitted)
      .map((row) => ({
        enrollmentId: row.enrollment_id,
        before: false,
        after: true,
      }));
    if (changes.length === 0) return;
    pushHistory({ kind: "attendance", changes });
    const nextRows = draftRowsRef.current.map((row) =>
      row.is_not_submitted ? row : { ...row, is_not_submitted: true }
    );
    draftRowsRef.current = nextRows;
    setDraftRows(nextRows);
    setDirty(true);
    previewMutation.reset();
  };

  const setQuestionScore = (questionId: number, score: string) => {
    const key = String(questionId);
    const current = questionScoreDraftRef.current[key] ?? "";
    if (current === score) return;
    pushHistory({
      kind: "question-score",
      questionId,
      before: current,
      after: score,
    });
    const nextScores = {
      ...questionScoreDraftRef.current,
      [key]: score,
    };
    questionScoreDraftRef.current = nextScores;
    setQuestionScoreDraft(nextScores);
    setDirty(true);
    previewMutation.reset();
  };

  const fillEmptyCorrectnessWithCorrect = () => {
    const changes: ManualGradeCellChange[] = [];
    for (const row of draftRowsRef.current) {
      if (row.is_not_submitted) continue;
      for (const question of visibleQuestions) {
        const cell = row.cells[String(question.question_id)];
        if (
          !cell?.editable ||
          cell.entry_method !== "correctness" ||
          cell.state != null
        ) {
          continue;
        }
        changes.push({
          enrollmentId: row.enrollment_id,
          questionId: question.question_id,
          before: { ...cell },
          after: { ...cell, state: "correct" },
        });
      }
    }

    if (changes.length === 0) {
      feedback.info("정답으로 채울 미입력 칸이 없습니다.");
      return;
    }

    pushHistory({ kind: "cells", changes });
    const changeKeys = new Set(
      changes.map((change) => `${change.enrollmentId}:${change.questionId}`),
    );
    const nextRows = draftRowsRef.current.map((row) => {
      if (row.is_not_submitted) return row;
      let nextCells = row.cells;
      for (const question of visibleQuestions) {
        const key = String(question.question_id);
        if (!changeKeys.has(`${row.enrollment_id}:${question.question_id}`)) {
          continue;
        }
        if (nextCells === row.cells) nextCells = { ...row.cells };
        nextCells[key] = { ...row.cells[key], state: "correct" };
      }
      return nextCells === row.cells ? row : { ...row, cells: nextCells };
    });
    draftRowsRef.current = nextRows;
    setDraftRows(nextRows);
    setDirty(true);
    previewMutation.reset();
    feedback.success(
      `${changes.length}개 미입력 칸을 정답으로 채웠습니다. 기존 O/X/오답노트는 유지됩니다.`,
    );

    const firstChange = changes[0];
    const focusRowIndex = draftRowsRef.current.findIndex(
      (row) => row.enrollment_id === firstChange?.enrollmentId,
    );
    const focusColumnIndex = visibleQuestions.findIndex(
      (question) => question.question_id === firstChange?.questionId,
    );
    if (focusRowIndex >= 0 && focusColumnIndex >= 0) {
      window.requestAnimationFrame(() => {
        const target = tableWrapRef.current?.querySelector<HTMLElement>(
          `[data-manual-grade-cell][data-row-index="${focusRowIndex}"][data-column-index="${focusColumnIndex}"]`,
        );
        target?.focus();
      });
    }
  };

  const pasteCorrectnessMatrix = (
    text: string,
    startRowIndex: number,
    startColumnIndex: number,
  ) => {
    const parsed = parseCorrectnessClipboard(text, shortcuts);
    if (parsed.error) {
      feedback.error(parsed.error);
      return;
    }

    const changes: ManualGradeCellChange[] = [];
    parsed.matrix.forEach((values, rowOffset) => {
      const rowIndex = startRowIndex + rowOffset;
      const row = draftRowsRef.current[rowIndex];
      if (!row || row.is_not_submitted) return;
      values.forEach((state, columnOffset) => {
        const columnIndex = startColumnIndex + columnOffset;
        const question = visibleQuestions[columnIndex];
        if (!question) return;
        const cell = row.cells[String(question.question_id)];
        if (!cell?.editable || cell.entry_method !== "correctness") return;
        const nextCell = { ...cell, state };
        if (!sameManualGradeCell(cell, nextCell)) {
          changes.push({
            enrollmentId: row.enrollment_id,
            questionId: question.question_id,
            before: { ...cell },
            after: nextCell,
          });
        }
      });
    });

    if (changes.length === 0) {
      feedback.error("붙여넣을 수 있는 정오 입력칸이 없습니다.");
      return;
    }

    pushHistory({ kind: "cells", changes });
    const changeMap = new Map(
      changes.map((change) => [
        `${change.enrollmentId}:${change.questionId}`,
        change.after,
      ]),
    );
    const nextRows = draftRowsRef.current.map((row) => {
      let nextCells = row.cells;
      for (const [questionId] of Object.entries(row.cells)) {
        const nextCell = changeMap.get(`${row.enrollment_id}:${questionId}`);
        if (!nextCell) continue;
        if (nextCells === row.cells) nextCells = { ...row.cells };
        nextCells[questionId] = { ...nextCell };
      }
      return nextCells === row.cells ? row : { ...row, cells: nextCells };
    });
    draftRowsRef.current = nextRows;
    setDraftRows(nextRows);
    setDirty(true);
    previewMutation.reset();
    feedback.success(`${changes.length}칸을 붙여넣었습니다.`);

    const lastChange = changes[changes.length - 1];
    const focusRowIndex = draftRowsRef.current.findIndex(
      (row) => row.enrollment_id === lastChange?.enrollmentId,
    );
    const focusColumnIndex = visibleQuestions.findIndex(
      (question) => question.question_id === lastChange?.questionId,
    );
    if (focusRowIndex >= 0 && focusColumnIndex >= 0) {
      window.requestAnimationFrame(() => {
        const target = tableWrapRef.current?.querySelector<HTMLElement>(
          `[data-manual-grade-cell][data-row-index="${focusRowIndex}"][data-column-index="${focusColumnIndex}"]`,
        );
        target?.focus();
      });
    }
  };

  const reset = () => {
    const nextRows = cloneRows(data.rows);
    const nextScores = Object.fromEntries(
      data.questions.map((question) => [
        String(question.question_id),
        formatScoreInput(question.max_score),
      ]),
    );
    draftRowsRef.current = nextRows;
    questionScoreDraftRef.current = nextScores;
    setDraftRows(nextRows);
    setQuestionScoreDraft(nextScores);
    clearHistory();
    setDirty(false);
    previewMutation.reset();
  };

  const handleWorkspaceKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    const commandKey = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (commandKey && !event.altKey && (key === "z" || key === "y")) {
      event.preventDefault();
      const redo = key === "y" || (key === "z" && event.shiftKey);
      if (redo) redoLastChange();
      else undoLastChange();
      return;
    }
    if (commandKey && !event.altKey && key === "s") {
      event.preventDefault();
      if (!dirty || busy) return;
      if (questionScoreState.error) {
        feedback.error(questionScoreState.error);
        return;
      }
      event.currentTarget.focus({ preventScroll: true });
      if (!preview || hasErrors) previewMutation.mutate();
      else applyMutation.mutate();
      return;
    }
    if (
      hasEditableQuestions &&
      data.manual_grading_method === "correctness" &&
      event.shiftKey &&
      event.key === "?"
    ) {
      event.preventDefault();
      openShortcutSettings();
    }
  };

  return (
    <section
      className={styles.card}
      aria-labelledby="manual-grading-title"
      aria-keyshortcuts="Control+V Meta+V Control+Z Meta+Z Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y Control+S Meta+S"
      tabIndex={-1}
      data-manual-grading-workspace
      onKeyDownCapture={handleWorkspaceKeyDown}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            <ClipboardCheck size={ICON.lg} />
          </span>
          <div>
            <h3 id="manual-grading-title">
              {data.grading_mode === "choice"
                ? "OMR 자동채점 결과"
                : data.grading_mode === "mixed"
                  ? "혼합 채점 워크스페이스"
                  : data.manual_grading_method === "correctness"
                    ? "정오 직접입력"
                    : "문항별 점수 입력"}
            </h3>
            <p>
              {data.grading_mode === "choice"
                ? "자동채점 결과입니다. 인식 오류는 OMR 검토에서 학생 답안을 보정하세요."
                : data.grading_mode === "mixed"
                  ? "OMR 문항은 잠그고 직접 채점 문항만 입력해 함께 확정합니다."
                  : data.manual_grading_method === "correctness"
                    ? "정오를 입력한 뒤 한 번에 확인하고 성적을 확정합니다."
                    : "문항별 점수를 입력한 뒤 한 번에 확인하고 성적을 확정합니다."}
            </p>
            <div className={styles.workspaceStats} aria-label="채점표 구성">
              <span>학생 {draftRows.length}명</span>
              <span>문항 {visibleQuestions.length}개</span>
              {questionTypeCounts.choice > 0 && (
                <span>객관식 {questionTypeCounts.choice}</span>
              )}
              {questionTypeCounts.numeric_short_answer > 0 && (
                <span>단답형 {questionTypeCounts.numeric_short_answer}</span>
              )}
              {questionTypeCounts.written > 0 && (
                <span>서술형 {questionTypeCounts.written}</span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          {dirty && <span className={styles.unsaved}>확정 전 변경사항</span>}
          {hasEditableQuestions && (
            <Button
              type="button"
              intent="secondary"
              size="sm"
              leftIcon={<UserX size={ICON_FOR_BUTTON.sm} />}
              disabled={
                busy ||
                draftRows.length === 0
              }
              onClick={setAllAbsent}
              title="전원을 결시로 표시한 뒤 제출한 학생만 응시로 바꿔 입력할 수 있습니다. 확정 전에는 서버에 저장되지 않습니다."
            >
              전원 결시로 설정
            </Button>
          )}
          <Button
            type="button"
            intent="ghost"
            size="sm"
            leftIcon={<Undo2 size={ICON_FOR_BUTTON.sm} />}
            disabled={historyState.undo === 0 || busy}
            onClick={undoLastChange}
            aria-label="마지막 변경 실행 취소"
          >
            실행 취소
          </Button>
          <Button
            type="button"
            intent="ghost"
            size="sm"
            leftIcon={<Redo2 size={ICON_FOR_BUTTON.sm} />}
            disabled={historyState.redo === 0 || busy}
            onClick={redoLastChange}
            aria-label="마지막 변경 다시 실행"
          >
            다시 실행
          </Button>
          <Button
            type="button"
            intent="ghost"
            size="sm"
            leftIcon={<RefreshCw size={ICON_FOR_BUTTON.sm} />}
            disabled={!dirty || busy}
            onClick={reset}
          >
            전체 초기화
          </Button>
          <Button
            type="button"
            intent="secondary"
            size="sm"
            leftIcon={<TableProperties size={ICON_FOR_BUTTON.sm} />}
            disabled={dirty || busy || exam?.can_edit_structure === false}
            onClick={() => setAnswerKeyOpen(true)}
            title={
              dirty
                ? "성적을 확정하거나 전체 초기화한 뒤 문항 구성을 바꿀 수 있습니다."
                : undefined
            }
          >
            문항 구성·정답
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
          이 표에서는 자동채점 결과를 변경하지 않습니다. OMR 검토에서 인식
          답안을 보정하면 정오·점수·통계가 다시 계산됩니다.
        </div>
      ) : data.manual_grading_method === "correctness" ? (
        <div className={styles.commandBar} aria-label="정오표 입력 도움말">
          <div className={styles.legend}>
            <span className={styles.legendCorrect}>
              <b>O</b> 정답 <small>{shortcuts.correct} 키</small>
            </span>
            <span className={styles.legendWrong}>
              <b>X</b> 오답 <small>{shortcuts.incorrect} 키</small>
            </span>
            <span className={styles.legendReview}>
              <b>오답노트</b> 정답 포함 <small>{shortcuts.review} 키</small>
            </span>
          </div>
          <div className={styles.commandBarActions}>
            <Button
              type="button"
              intent="secondary"
              size="sm"
              leftIcon={<CheckCircle2 size={ICON_FOR_BUTTON.sm} />}
              disabled={emptyCorrectnessCount === 0 || busy}
              onClick={fillEmptyCorrectnessWithCorrect}
              title="응시 학생의 미입력 칸만 정답으로 채웁니다. 기존 O/X/오답노트는 바꾸지 않습니다."
            >
              빈칸 {emptyCorrectnessCount}칸 O로
            </Button>
            <div className={styles.keyboardHints}>
              <span><kbd>Tab</kbd> 다음 칸</span>
              <span><kbd>Enter</kbd> 아래 칸</span>
              <span><kbd>{primaryShortcutModifier}+V</kbd> 엑셀 붙여넣기</span>
              <span><kbd>{primaryShortcutModifier}+Z</kbd> 실행 취소</span>
              <span><kbd>{primaryShortcutModifier}+S</kbd> 확인·확정</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.commandBar} aria-label="점수표 입력 도움말">
          <div className={styles.legend}>
            <span>각 문항 배점 안에서 점수를 입력합니다.</span>
            <span className={styles.legendReview}>
              <b>오답노트</b> 만점을 받아도 포함
            </span>
          </div>
          <div className={styles.keyboardHints}>
            <span><kbd>Tab</kbd> 다음 칸</span>
            <span><kbd>Enter</kbd> 아래 칸</span>
            <span><kbd>방향키</kbd> 셀 이동</span>
            <span><kbd>{primaryShortcutModifier}+Z</kbd> 실행 취소</span>
            <span><kbd>{primaryShortcutModifier}+S</kbd> 확인·확정</span>
          </div>
        </div>
      )}

      {data.grading_mode === "mixed" && (
        <div className={styles.mixedNotice}>
          문항 순서와 관계없이 객관식 자동채점과 단답·서술형 입력을 같은 표에
          표시합니다. 자동채점 문항은 잠겨 있으며, 인식 오류는 OMR 검토에서
          답안을 보정합니다.
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
              label="오답노트"
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

      <div className={styles.tableToolbar}>
        <span className={isOverviewMode ? overviewStyles.overviewHint : undefined} role="status">
          {isOverviewMode
            ? "전체 조망 중 · 색상 흐름을 살펴보고, 입력은 50% 이상에서 이어가세요."
            : "학생 이름과 응시는 고정되며, 표만 가로·세로로 이동합니다."}
        </span>
        <div className={overviewStyles.scaleControl} role="group" aria-label="채점표 배율">
          <button
            type="button"
            disabled={tableScale === TABLE_SCALE_STEPS[0]}
            onClick={() => changeTableScale(-1)}
            aria-label="채점표 축소"
            title="채점표 축소"
          >
            <Minus size={14} aria-hidden />
          </button>
          <select
            value={tableScale}
            aria-label="채점표 배율 선택"
            title="채점표 배율 선택"
            onChange={(event) => applyTableScale(Number(event.target.value))}
          >
            {TABLE_SCALE_STEPS.map((scale) => (
              <option key={scale} value={scale}>{scale}%</option>
            ))}
          </select>
          <button
            type="button"
            disabled={tableScale === TABLE_SCALE_STEPS[TABLE_SCALE_STEPS.length - 1]}
            onClick={() => changeTableScale(1)}
            aria-label="채점표 확대"
            title="채점표 확대"
          >
            <Plus size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={overviewStyles.fitButton}
            onClick={() => {
              hasSavedTableScaleRef.current = false;
              try {
                window.localStorage.removeItem(TABLE_SCALE_STORAGE_KEY);
              } catch {
                // Keep the fit action available even when storage is blocked.
              }
              fitTableToViewport(false);
            }}
          >
            화면 맞춤
          </button>
          <button
            type="button"
            className={overviewStyles.overviewButton}
            onClick={fitEntireTableToViewport}
            aria-pressed={isOverviewMode}
            title="학생과 문항 전체를 한 화면에 맞춤"
          >
            전체 조망
          </button>
        </div>
      </div>

      <div className={styles.tableWrap} ref={tableWrapRef} data-manual-grading-table-wrap>
        <table
          className={`${styles.table} ${isOverviewMode ? overviewStyles.overviewTable : ""}`}
          ref={tableRef}
          style={{
            "--manual-grading-table-scale": tableScale / 100,
            "--manual-grading-overview-row-height": `${1000 / tableScale}px`,
            "--manual-grading-overview-question-width": `${1200 / tableScale}px`,
            "--manual-grading-overview-student-width": `${7600 / tableScale}px`,
            "--manual-grading-overview-attendance-width": `${3200 / tableScale}px`,
            "--manual-grading-overview-font-size": `${900 / tableScale}px`,
          } as CSSProperties}
        >
          <thead>
            <tr>
              <th className={styles.studentColumn}>학생</th>
              <th className={styles.attendanceColumn}>응시</th>
              {visibleQuestions.map((question) => {
                const key = String(question.question_id);
                const answerType = getQuestionAnswerType(question);
                const answerTypeClass =
                  answerType === "choice"
                    ? styles.choiceType
                    : answerType === "numeric_short_answer"
                      ? styles.numericShortAnswerType
                      : styles.writtenType;
                return (
                  <th key={question.question_id} className={styles.questionColumn}>
                    <div className={styles.questionRail}>
                      <span className={`${styles.questionType} ${answerTypeClass}`}>
                        {getQuestionAnswerTypeLabel(answerType)}
                      </span>
                      <strong className={styles.questionNumber}>
                        {question.number}
                      </strong>
                    </div>
                    {question.editable ? (
                      <label className={styles.questionScoreInput}>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={questionScoreDraft[key] ?? ""}
                          disabled={busy || isOverviewMode}
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
              <ManualGradingTableRow
                key={row.enrollment_id}
                row={row}
                rowIndex={rowIndex}
                questions={visibleQuestions}
                questionScoreDraft={questionScoreDraft}
                manualGradingMethod={data.manual_grading_method}
                hasEditableQuestions={hasEditableQuestions}
                busy={busy || isOverviewMode}
                shortcuts={shortcuts}
                onSetAttendance={setAttendance}
                onUpdateCell={updateCell}
                onMoveFocus={focusCell}
                onShowShortcuts={openShortcutSettings}
                onPasteCorrectnessMatrix={pasteCorrectnessMatrix}
              />
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
      <AnswerKeyRegisterModal
        open={answerKeyOpen}
        onClose={closeAnswerKeyModal}
        examId={examId}
        structureOwnerId={exam?.structure_owner_id ?? examId}
        canEditQuestions={exam?.can_edit_structure ?? true}
      />
    </section>
  );
}

type ManualGradingTableRowProps = {
  row: ManualGradeRow;
  rowIndex: number;
  questions: ManualGradeQuestion[];
  questionScoreDraft: Record<string, string>;
  manualGradingMethod: ManualGradeSheet["manual_grading_method"];
  hasEditableQuestions: boolean;
  busy: boolean;
  shortcuts: ManualGradingShortcutSettings;
  onSetAttendance: (enrollmentId: number, absent: boolean) => void;
  onUpdateCell: (
    enrollmentId: number,
    questionId: number,
    updater: (cell: ManualGradeCell) => ManualGradeCell,
  ) => void;
  onMoveFocus: (
    element: HTMLElement,
    direction: "next" | "previous" | "up" | "down",
  ) => void;
  onShowShortcuts: () => void;
  onPasteCorrectnessMatrix: (
    text: string,
    rowIndex: number,
    columnIndex: number,
  ) => void;
};

const ManualGradingTableRow = memo(function ManualGradingTableRow({
  row,
  rowIndex,
  questions,
  questionScoreDraft,
  manualGradingMethod,
  hasEditableQuestions,
  busy,
  shortcuts,
  onSetAttendance,
  onUpdateCell,
  onMoveFocus,
  onShowShortcuts,
  onPasteCorrectnessMatrix,
}: ManualGradingTableRowProps) {
  return (
    <tr>
      <td className={styles.studentColumn}>
        <div className={overviewStyles.studentDetail}>
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
        </div>
        <span className={overviewStyles.overviewStudentName}>{row.student_name}</span>
      </td>
      <td className={styles.attendanceColumn}>
        <button
          type="button"
          className={`${styles.attendanceButton} ${overviewStyles.attendanceButton} ${
            row.is_not_submitted ? styles.absent : ""
          }`}
          aria-pressed={row.is_not_submitted}
          aria-label={`${row.student_name} ${row.is_not_submitted ? "결시" : "응시"}`}
          disabled={!hasEditableQuestions || busy}
          onClick={() =>
            onSetAttendance(row.enrollment_id, !row.is_not_submitted)
          }
        >
          <span className={overviewStyles.attendanceFullLabel}>
            {row.is_not_submitted ? "결시" : "응시"}
          </span>
          <span className={overviewStyles.attendanceOverviewLabel} aria-hidden>
            {row.is_not_submitted ? "결" : "응"}
          </span>
        </button>
      </td>
      {questions.map((question, columnIndex) => {
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
            ) : manualGradingMethod === "correctness" ? (
              <CorrectnessCell
                value={cell.state}
                disabled={row.is_not_submitted || busy}
                studentName={row.student_name}
                questionNumber={question.number}
                rowIndex={rowIndex}
                columnIndex={columnIndex}
                shortcuts={shortcuts}
                onMoveFocus={onMoveFocus}
                onShowShortcuts={onShowShortcuts}
                onPaste={(text) =>
                  onPasteCorrectnessMatrix(text, rowIndex, columnIndex)
                }
                onChange={(state) =>
                  onUpdateCell(
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
                studentName={row.student_name}
                questionNumber={question.number}
                rowIndex={rowIndex}
                columnIndex={columnIndex}
                onMoveFocus={onMoveFocus}
                onScoreChange={(score) =>
                  onUpdateCell(
                    row.enrollment_id,
                    question.question_id,
                    (current) => ({ ...current, score }),
                  )
                }
                onReviewChange={(review) =>
                  onUpdateCell(
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
  );
}, (previous, next) =>
  previous.row === next.row &&
  previous.rowIndex === next.rowIndex &&
  previous.questions === next.questions &&
  previous.questionScoreDraft === next.questionScoreDraft &&
  previous.manualGradingMethod === next.manualGradingMethod &&
  previous.hasEditableQuestions === next.hasEditableQuestions &&
  previous.busy === next.busy &&
  previous.shortcuts === next.shortcuts);

function ReadOnlyGradeCell({
  cell,
  studentName,
  questionNumber,
}: {
  cell: ManualGradeCell;
  studentName: string;
  questionNumber: number;
}) {
  const label = cell.state ? STATE_CELL_LABEL[cell.state] : "·";
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
  onPaste,
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
    element: HTMLElement,
    direction: "next" | "previous" | "up" | "down",
  ) => void;
  onShowShortcuts: () => void;
  onPaste: (text: string) => void;
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
      onCopy={(event) => {
        event.preventDefault();
        event.clipboardData.setData(
          "text/plain",
          value ? STATE_LABEL[value] : "",
        );
      }}
      onPaste={(event) => {
        event.preventDefault();
        onPaste(event.clipboardData.getData("text"));
      }}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.shiftKey && event.key === "?") {
          event.preventDefault();
          onShowShortcuts();
          return;
        }
        const state = getManualGradeStateFromKeyboardShortcut(
          event.key,
          event.code,
          shortcuts,
        );
        if (state) {
          event.preventDefault();
          const cell = event.currentTarget;
          onChange(state);
          onMoveFocus(cell, "next");
          return;
        }
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") {
          event.preventDefault();
          onMoveFocus(event.currentTarget, event.shiftKey ? "up" : "down");
        } else if (event.key === "ArrowRight" || (event.key === "Tab" && !event.shiftKey)) {
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
      {value ? STATE_CELL_LABEL[value] : "·"}
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
  studentName,
  questionNumber,
  rowIndex,
  columnIndex,
  onMoveFocus,
  onScoreChange,
  onReviewChange,
}: {
  value: number | null;
  maxScore: number;
  review: boolean;
  disabled: boolean;
  studentName: string;
  questionNumber: number;
  rowIndex: number;
  columnIndex: number;
  onMoveFocus: (
    element: HTMLElement,
    direction: "next" | "previous" | "up" | "down",
  ) => void;
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
        aria-label={`${studentName} ${questionNumber}번 ${formatScore(maxScore)}점 만점 점수`}
        data-manual-grade-cell
        data-row-index={rowIndex}
        data-column-index={columnIndex}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const raw = event.target.value;
          onScoreChange(raw === "" ? null : Number(raw));
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
          if (event.key === "Enter") {
            event.preventDefault();
            onMoveFocus(event.currentTarget, event.shiftKey ? "up" : "down");
          } else if (event.key === "ArrowRight" || (event.key === "Tab" && !event.shiftKey)) {
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
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        className={review ? styles.reviewOn : ""}
        disabled={disabled}
        aria-pressed={review}
        onClick={() => onReviewChange(!review)}
      >
        오답노트
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

function sameManualGradeCell(
  left: ManualGradeCell,
  right: ManualGradeCell,
): boolean {
  return (
    left.state === right.state &&
    left.score === right.score &&
    left.include_in_wrong_note === right.include_in_wrong_note
  );
}

function getQuestionAnswerType(
  question: ManualGradeQuestion,
): "choice" | "numeric_short_answer" | "written" {
  return question.answer_type ?? (question.kind === "choice" ? "choice" : "written");
}

function getQuestionAnswerTypeLabel(
  answerType: "choice" | "numeric_short_answer" | "written",
): string {
  if (answerType === "choice") return "객관식";
  if (answerType === "numeric_short_answer") return "단답형";
  return "서술형";
}

function parseCorrectnessClipboard(
  text: string,
  shortcuts: ManualGradingShortcutSettings,
): {
  matrix: Array<Array<ManualGradeState | null>>;
  error: string | null;
} {
  const normalizedText = text.replace(/\r\n?/g, "\n");
  const rows = normalizedText.split("\n");
  while (rows.length > 1 && rows[rows.length - 1]?.trim() === "") rows.pop();

  const matrix: Array<Array<ManualGradeState | null>> = [];
  for (const [rowIndex, row] of rows.entries()) {
    const tokens = row.includes("\t") ? row.split("\t") : [row];
    const values: Array<ManualGradeState | null> = [];
    for (const [columnIndex, rawToken] of tokens.entries()) {
      const token = rawToken.trim();
      const normalized = token.toLocaleUpperCase("ko-KR");
      let state: ManualGradeState | null | undefined;
      const configuredState = getManualGradeStateFromShortcut(token, shortcuts);
      if (token === "") {
        state = "correct";
      } else if (token === "-") {
        state = null;
      } else if (configuredState) {
        state = configuredState;
      } else if (
        normalized === "O" ||
        token === "○" ||
        token === "정답" ||
        token === "맞음"
      ) {
        state = "correct";
      } else if (
        normalized === "X" ||
        token === "×" ||
        token === "." ||
        token === "오답" ||
        token === "틀림"
      ) {
        state = "incorrect";
      } else if (
        token === "0" ||
        token === "복습" ||
        token === "오답노트" ||
        token === "노트"
      ) {
        state = "review";
      } else {
        state = undefined;
      }

      if (state === undefined) {
        return {
          matrix: [],
          error: `${rowIndex + 1}행 ${columnIndex + 1}열의 “${token}”은 정오 값으로 붙여넣을 수 없습니다.`,
        };
      }
      values.push(state);
    }
    matrix.push(values);
  }

  return { matrix, error: null };
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
