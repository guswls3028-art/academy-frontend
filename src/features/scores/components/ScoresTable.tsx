// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조 (SSOT·UX 설계 문서 준수)
 * - 기본 Read-only, Edit Mode 시에만 입력
 * - 3행 헤더: Row1 그룹 | Row2 시험명/과제명 | Row3 점수/합불
 * - 시험/과제 컬럼: exam.title, homework.title 기반 1:1, 서브컬럼 score / pass_fail
 * - 디자인 토큰만 사용, DomainTable 기반
 */

import { useMemo, useRef, useEffect, Fragment, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import { patchExamTotalScoreQuick } from "../api/patchExamTotalQuick";
import { patchExamObjectiveScoreQuick } from "../api/patchExamObjectiveQuick";
import { patchExamItemScore } from "../api/patchItemScore";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import ScoreInputCell from "./ScoreInputCell";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { DomainTable, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import AttendanceStatusBadge, {
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";

/** 컬럼 기본 너비 — 설계 문서 12️⃣ */
const COL_EDIT = 80;
const COL_NAME = 160;
const COL_ATTENDANCE = 80;
const COL_SCORE = 84;
const COL_PASS = 64;
const COL_CLINIC_TARGET = 80;
const COL_REASON = 180;

/** 시험 블록 배경 — flat 테이블과 동일 토큰(--color-primary), 5% */
const BG_EXAM = "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-surface))";
/** 과제 블록 배경 — flat 테이블과 동일 토큰, 4% */
const BG_HOMEWORK = "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))";

function parseScoreInput(input: string, maxScore?: number | null): number | null {
  const v = input.trim();
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  if (maxScore != null && Number(maxScore) > 0 && v.endsWith("%")) {
    const p = Number(v.slice(0, -1));
    if (Number.isFinite(p)) return Math.round((p / 100) * Number(maxScore));
  }
  return null;
}

/** 0 ~ (maxScore ?? 100) 범위 검증, 초과 시 알림 후 false */
function validateScore(value: number, maxScore?: number | null): boolean {
  const max = maxScore != null && Number(maxScore) > 0 ? Number(maxScore) : 100;
  if (value < 0 || value > max) {
    alert(`점수는 0 ~ ${max} 사이로 입력해 주세요.`);
    return false;
  }
  return true;
}

function firstLine(text: string): string {
  return String(text ?? "").split("\n")[0]?.trim() ?? "";
}

/** 합불 뱃지 — 시험/과제 컬럼용. 불(빨강)과 동일 디자인으로 합(초록) solid 배경 + 흰 글자 */
function PassFailBadge({ passed }: { passed: boolean | null | undefined }) {
  if (passed == null) return <span className="text-[var(--color-text-muted)]">-</span>;
  const tone = passed ? "success" : "danger";
  return (
    <span
      className="ds-status-badge ds-scores-pass-fail-badge inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-md text-xs font-semibold"
      data-tone={tone}
    >
      {passed ? "합" : "불"}
    </span>
  );
}

/** 클리닉 대상 여부 + 대상 사유 (시험 / 시험+과제 / 과제) */
function getClinicReason(row: SessionScoreRow): { target: boolean; reason: string } {
  const examFail = row.exams?.some((e) => e.block.passed === false) ?? false;
  const hwFail =
    row.homeworks?.some((h) => {
      const st = getHomeworkStatus({
        score: h.block.score,
        metaStatus: h.block.meta?.status ?? null,
      });
      return st === "NOT_SUBMITTED" || h.block.passed === false;
    }) ?? false;
  if (!examFail && !hwFail) return { target: false, reason: "" };
  if (examFail && hwFail) return { target: true, reason: "시험+과제" };
  if (examFail) return { target: true, reason: "시험" };
  return { target: true, reason: "과제" };
}

export type ScoreColumnDef =
  | { type: "name"; key: "name"; width: number; editable: false }
  | { type: "attendance"; key: "attendance"; width: number; editable: false }
  | {
      type: "exam";
      examId: number;
      questionId?: number;
      title: string;
      sub: "total" | "objective" | "subjective" | "item" | "pass";
      key: string;
      width: number;
      editable: boolean;
    }
  | {
      type: "homework";
      homeworkId: number;
      title: string;
      sub: "score" | "pass";
      key: string;
      width: number;
      editable: boolean;
    }
  | { type: "clinic_target"; key: "clinic_target"; width: number; editable: false }
  | { type: "clinic_reason"; key: "clinic_reason"; width: number; editable: false };

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;
  attendanceMap?: Record<number, string>;

  /** 편집 모드일 때만 점수 셀 입력 가능 */
  isEditMode?: boolean;
  examEditTotal?: boolean;
  examEditObjective?: boolean;
  examEditSubjective?: boolean;
  homeworkEdit?: boolean;
  /** 읽기 모드 시험 표시: 합산(한 칸) | 객관식+주관식(두 칸) */
  scoreDisplayMode?: "total" | "breakdown";

  selectedEnrollmentId: number | null;
  selectedCell?: ({ enrollmentId: number } & (
    | { type: "exam"; examId: number; sub: "total" | "objective" | "subjective"; questionId?: undefined }
    | { type: "exam"; examId: number; sub: "item"; questionId: number }
    | { type: "homework"; homeworkId: number }
  )) | null;
  onSelectCell: (row: SessionScoreRow, type: "exam" | "homework", id: number, questionIdOrSub?: number | "total" | "objective" | "subjective") => void;
  onSelectRow: (row: SessionScoreRow) => void;

  focusCell?: ({ enrollmentId: number } & (
    | { type: "exam"; examId: number; sub: "total" | "objective" | "subjective"; questionId?: undefined }
    | { type: "exam"; examId: number; sub: "item"; questionId: number }
    | { type: "homework"; homeworkId: number }
  )) | null;
  onFocusDone?: () => void;

  /** 키보드 셀 이동 — Tab/Enter/Arrow 시 패널에서 다음 셀로 이동 */
  onRequestMoveNext?: () => void;
  onRequestMovePrev?: () => void;
  onRequestMoveDown?: () => void;
  onRequestMoveUp?: () => void;

  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;
};

export default function ScoresTable({
  rows,
  meta,
  sessionId,
  attendanceMap = {},
  isEditMode = false,
  examEditTotal = false,
  examEditObjective = false,
  examEditSubjective = false,
  homeworkEdit = false,
  scoreDisplayMode = "total",
  selectedEnrollmentId,
  selectedCell = null,
  onSelectCell,
  onSelectRow,
  focusCell,
  onFocusDone,
  onRequestMoveNext,
  onRequestMovePrev,
  onRequestMoveDown,
  onRequestMoveUp,
  selectedEnrollmentIds = [],
  onSelectionChange,
}: Props) {
  const qc = useQueryClient();
  const homeworkInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examObjectiveInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examSubjectiveInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examItemInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  /** ESC 복원용 — 포커스 진입 시점의 값 */
  const scoreValueOnFocusRef = useRef<Record<string, string>>({});
  const examScoreValueOnFocusRef = useRef<Record<string, string>>({});

  const examOptions = meta?.exams ?? [];
  const homeworkOptions = meta?.homeworks ?? [];

  /** 편집 모드 시 점수 셀 동기화: 포커스 아닐 때만 서버 값으로 contenteditable 텍스트 갱신 */
  useEffect(() => {
    if (!rows.length) return;
    homeworkOptions.forEach((hw) => {
      rows.forEach((row) => {
        const key = `${row.enrollment_id}-${hw.homework_id}`;
        const el = homeworkInputRefs.current[key];
        if (!el || el === document.activeElement) return;
        const entry = row.homeworks?.find((h) => h.homework_id === hw.homework_id);
        const score = entry?.block?.score;
        el.innerText = score != null ? String(score) : "";
      });
    });
  }, [rows, homeworkOptions]);

  useEffect(() => {
    if (!rows.length) return;
    examOptions.forEach((ex) => {
      rows.forEach((row) => {
        const key = `${row.enrollment_id}-${ex.exam_id}`;
        const el = examInputRefs.current[key];
        if (!el || el === document.activeElement) return;
        const entry = row.exams?.find((e) => e.exam_id === ex.exam_id);
        const score = entry?.block?.score;
        el.innerText = score != null ? String(Math.round(score)) : "";
      });
    });
  }, [rows, examOptions]);

  useEffect(() => {
    if (!rows.length) return;
    examOptions.forEach((ex) => {
      rows.forEach((row) => {
        const key = `${row.enrollment_id}-${ex.exam_id}-subjective`;
        const el = examSubjectiveInputRefs.current[key];
        if (!el || el === document.activeElement) return;
        const entry = row.exams?.find((e) => e.exam_id === ex.exam_id);
        const subScore = entry?.block?.subjective_score;
        el.innerText = subScore != null ? String(Math.round(subScore)) : "";
      });
    });
  }, [rows, examOptions]);

  /** contenteditable 셀 포커스 시 전체 선택 — 엑셀처럼 입력하면 기존 값이 바로 대체되도록 */
  const selectAllScoreCell = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.addRange(range);
  }, []);

  useEffect(() => {
    if (!focusCell || !onFocusDone) return;
    if (focusCell.type === "homework") {
      const key = `${focusCell.enrollmentId}-${focusCell.homeworkId}`;
      const el = homeworkInputRefs.current[key];
      if (el) {
        el.focus();
        selectAllScoreCell(el);
      }
      onFocusDone();
      return;
    }
    if (focusCell.type === "exam") {
      if (focusCell.sub === "item" && "questionId" in focusCell) {
        const key = `${focusCell.enrollmentId}-${focusCell.examId}-${focusCell.questionId}`;
        const el = examItemInputRefs.current[key];
        if (el) el.focus();
        onFocusDone();
        return;
      }
      if (focusCell.sub === "objective") {
        const key = `${focusCell.enrollmentId}-${focusCell.examId}-objective`;
        const el = examObjectiveInputRefs.current[key];
        if (el) {
          el.focus();
          selectAllScoreCell(el);
        }
        onFocusDone();
        return;
      }
      if (focusCell.sub === "subjective") {
        const key = `${focusCell.enrollmentId}-${focusCell.examId}-subjective`;
        const el = examSubjectiveInputRefs.current[key];
        if (el) {
          el.focus();
          selectAllScoreCell(el);
        }
        onFocusDone();
        return;
      }
      const key = `${focusCell.enrollmentId}-${focusCell.examId}`;
      const el = examInputRefs.current[key];
      if (el) {
        el.focus();
        selectAllScoreCell(el);
      }
      onFocusDone();
    }
  }, [focusCell, onFocusDone, selectAllScoreCell]);

  const columns = useMemo((): ScoreColumnDef[] => {
    const list: ScoreColumnDef[] = [
      { type: "name", key: "name", width: COL_NAME, editable: false },
      { type: "attendance", key: "attendance", width: COL_ATTENDANCE, editable: false },
    ];
    examOptions.forEach((e) => {
      const questions = (e as { questions?: { question_id: number; number: number; max_score: number }[] }).questions ?? [];
      if (isEditMode) {
        if (examEditTotal) list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "total", key: `exam_${e.exam_id}_total`, width: COL_SCORE, editable: true });
        if (examEditObjective) list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "objective", key: `exam_${e.exam_id}_objective`, width: COL_SCORE, editable: true });
        if (examEditSubjective) {
          if (questions.length > 0) {
            questions.forEach((q) => list.push({ type: "exam", examId: e.exam_id, questionId: q.question_id, title: e.title, sub: "item", key: `exam_${e.exam_id}_q_${q.question_id}`, width: COL_SCORE, editable: true }));
          } else {
            list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "subjective", key: `exam_${e.exam_id}_subjective`, width: COL_SCORE, editable: isEditMode });
          }
        }
        list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "pass", key: `exam_${e.exam_id}_pass`, width: COL_PASS, editable: false });
      } else {
        if (scoreDisplayMode === "total") {
          list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "total", key: `exam_${e.exam_id}_score`, width: COL_SCORE, editable: false });
          list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "pass", key: `exam_${e.exam_id}_pass`, width: COL_PASS, editable: false });
        } else {
          list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "objective", key: `exam_${e.exam_id}_objective`, width: COL_SCORE, editable: false });
          list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "subjective", key: `exam_${e.exam_id}_subjective`, width: COL_SCORE, editable: false });
          list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "pass", key: `exam_${e.exam_id}_pass`, width: COL_PASS, editable: false });
        }
      }
    });
    homeworkOptions.forEach((h) => {
      list.push(
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "score", key: `hw_${h.homework_id}_score`, width: COL_SCORE, editable: isEditMode && homeworkEdit },
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "pass", key: `hw_${h.homework_id}_pass`, width: COL_PASS, editable: false }
      );
    });
    list.push(
      { type: "clinic_target", key: "clinic_target", width: COL_CLINIC_TARGET, editable: false },
      { type: "clinic_reason", key: "clinic_reason", width: COL_REASON, editable: false }
    );
    return list;
  }, [examOptions, homeworkOptions, isEditMode, scoreDisplayMode, examEditTotal, examEditObjective, examEditSubjective, homeworkEdit]);

  const columnDefs = useMemo((): TableColumnDef[] => {
    return [
      { key: "select", label: "선택", defaultWidth: COL_EDIT, minWidth: 40, maxWidth: 120 },
      ...columns.map((c) => ({
        key: c.key,
        label: c.key,
        defaultWidth: c.width,
        minWidth: c.key === "name" ? 100 : c.key === "clinic_reason" ? 140 : 48,
        maxWidth: 500,
      })),
    ];
  }, [columns]);

  const { columnWidths, setColumnWidth } = useTableColumnPrefs("session-scores", columnDefs);

  const tableCols = useMemo(() => {
    return [
      columnWidths.select ?? COL_EDIT,
      ...columns.map((c) => columnWidths[c.key] ?? c.width),
    ];
  }, [columns, columnWidths]);

  const tableWidth = useMemo(
    () => tableCols.reduce((s, w) => s + w, 0),
    [tableCols]
  );

  const selectedSet = useMemo(() => new Set(selectedEnrollmentIds), [selectedEnrollmentIds]);
  const allSelected =
    rows.length > 0 &&
    rows.every((r) => selectedSet.has(r.enrollment_id));

  return (
    <DomainTable
      tableClassName="ds-table--flat ds-table--center ds-scores-table"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        {tableCols.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>

      <thead>
        {/* Row1: 선택 | 이름 | 출석 | [시험 뱃지] 시험이름 (colSpan=2) 반복 | [과제 뱃지] 과제이름 (colSpan=2) 반복 | 클리닉 | 사유 — flat 스타일(students와 동일) */}
        <tr className="border-b border-[var(--color-border-divider)]">
          <ResizableTh
            columnKey="select"
            width={columnWidths.select ?? COL_EDIT}
            minWidth={40}
            maxWidth={120}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            noWrap
            className="ds-checkbox-cell align-top py-2.5 px-2 border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)]"
          >
            {onSelectionChange ? (
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectionChange(rows.map((r) => r.enrollment_id));
                    } else {
                      onSelectionChange([]);
                    }
                  }}
                  className="cursor-pointer w-4 h-4"
                  aria-label="전체 선택"
                />
              </label>
            ) : (
              <span className="w-4 inline-block" />
            )}
          </ResizableTh>
          <ResizableTh
            columnKey="name"
            width={columnWidths.name ?? COL_NAME}
            minWidth={100}
            maxWidth={400}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 border-l-2 border-[var(--color-border-divider)]"
          >
            이름
          </ResizableTh>
          <ResizableTh
            columnKey="attendance"
            width={columnWidths.attendance ?? COL_ATTENDANCE}
            minWidth={60}
            maxWidth={120}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3"
          >
            출석
          </ResizableTh>
          {examOptions.map((ex) => {
            const examColsList = columns.filter((c) => c.type === "exam" && c.examId === ex.exam_id);
            const colSpan = examColsList.length || 1;
            return (
              <th
                key={`head-exam-${ex.exam_id}`}
                scope="col"
                colSpan={colSpan}
                className="text-left font-medium text-[var(--color-text-primary)] py-2 px-3 truncate"
                style={{ backgroundColor: BG_EXAM }}
                title={ex.title}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="ds-status-badge ds-status-badge--1ch" data-tone="primary" aria-label="시험">
                    시
                  </span>
                  <span className="truncate">{ex.title}</span>
                </span>
              </th>
            );
          })}
          {homeworkOptions.map((hw) => (
            <th
              key={`head-hw-${hw.homework_id}`}
              scope="col"
              colSpan={2}
              className="text-left font-medium text-[var(--color-text-primary)] py-2 px-3 truncate"
              style={{ backgroundColor: BG_HOMEWORK }}
              title={hw.title}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="ds-status-badge ds-status-badge--1ch" data-tone="complement" aria-label="과제">
                  과
                </span>
                <span className="truncate">{hw.title}</span>
              </span>
            </th>
          ))}
          <ResizableTh
            columnKey="clinic_target"
            width={columnWidths.clinic_target ?? COL_CLINIC_TARGET}
            minWidth={60}
            maxWidth={140}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3"
          >
            판정
          </ResizableTh>
          <ResizableTh
            columnKey="clinic_reason"
            width={columnWidths.clinic_reason ?? COL_REASON}
            minWidth={140}
            maxWidth={400}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 min-w-0"
          >
            사유
          </ResizableTh>
        </tr>
        {/* Row2: 시험별 서브헤더(합산/객관식/주관식/N번/합불) | 과제 점수/합불 */}
        <tr className="border-b-2 border-[var(--color-border-divider)]">
          {examOptions.map((ex) => {
            const examColsList = columns.filter((c) => c.type === "exam" && c.examId === ex.exam_id) as Extract<ScoreColumnDef, { type: "exam" }>[];
            const questions = (ex as { questions?: { question_id: number; number: number }[] }).questions ?? [];
            return (
              <Fragment key={ex.exam_id}>
                {examColsList.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                    style={{ backgroundColor: BG_EXAM, width: c.sub === "pass" ? COL_PASS : COL_SCORE, minWidth: 48 }}
                  >
                    {c.sub === "total" ? "합산" : c.sub === "objective" ? "객관식" : c.sub === "subjective" ? "주관식" : c.sub === "item" && c.questionId != null
                      ? `${questions.find((q) => q.question_id === c.questionId)?.number ?? c.questionId}번`
                      : "합불"}
                  </th>
                ))}
              </Fragment>
            );
          })}
          {homeworkOptions.map((hw) => (
            <Fragment key={hw.homework_id}>
              <th
                scope="col"
                className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{
                  width: columnWidths[`hw_${hw.homework_id}_score`] ?? COL_SCORE,
                  minWidth: 48,
                  maxWidth: 200,
                  backgroundColor: BG_HOMEWORK,
                }}
              >
                점수
              </th>
              <th
                scope="col"
                className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{
                  width: columnWidths[`hw_${hw.homework_id}_pass`] ?? COL_PASS,
                  minWidth: 48,
                  maxWidth: 100,
                  backgroundColor: BG_HOMEWORK,
                }}
              >
                합불
              </th>
            </Fragment>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, rowIndex) => {
          const selected = selectedEnrollmentId === row.enrollment_id;
          const rowChecked = selectedSet.has(row.enrollment_id);
          const { target: clinicTarget, reason: clinicReason } = getClinicReason(row);
          const isEvenRow = rowIndex % 2 === 1;

          return (
            <Fragment key={row.enrollment_id}>
              <tr
                onClick={() => onSelectRow(row)}
                tabIndex={0}
                role="button"
                className={`cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-brand-primary)] ${selected ? "ds-row-selected" : ""} ${rowChecked ? "ds-scores-table-row--checked" : ""} hover:bg-[var(--color-bg-surface-hover)] ${isEvenRow ? "ds-scores-table-row--alt" : ""}`}
              >
                <td
                  className="ds-checkbox-cell align-middle py-2.5 px-3 border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onSelectionChange ? (
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row.enrollment_id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                          onSelectionChange([...selectedEnrollmentIds, row.enrollment_id]);
                        } else {
                          onSelectionChange(selectedEnrollmentIds.filter((id) => id !== row.enrollment_id));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${row.student_name} 선택`}
                      className="cursor-pointer"
                    />
                  ) : (
                    <span className="w-4 inline-block" />
                  )}
                </td>

                <td
                  className={`font-semibold min-w-0 text-[var(--color-text-primary)] py-2.5 px-3 align-middle border-l-2 border-[var(--color-border-divider)] ${row.name_highlight_clinic_no_reservation ? "ds-table-cell-name--clinic-no-reservation" : clinicTarget ? "ds-table-cell-name--clinic-target" : ""}`}
                  onClick={() => onSelectRow(row)}
                >
                  <StudentNameWithLectureChip
                    name={row.student_name ?? ""}
                    profilePhotoUrl={row.profile_photo_url ?? undefined}
                    avatarSize={24}
                    lectures={
                      row.lecture_title
                        ? [{ lectureName: row.lecture_title, color: row.lecture_color }]
                        : undefined
                    }
                    chipSize={14}
                  />
                </td>

                <td className="text-left py-2.5 px-3 align-middle" onClick={() => onSelectRow(row)}>
                  {(() => {
                    const status = attendanceMap[row.enrollment_id];
                    if (!status)
                      return <span className="text-[var(--color-text-muted)]">-</span>;
                    return (
                      <AttendanceStatusBadge
                        status={status as AttendanceStatus}
                        variant="2ch"
                      />
                    );
                  })()}
                </td>

                {/* 시험: 컬럼 정의에 따라 합산/객관식/주관식/문항별/합불 */}
                {examOptions.map((ex) => {
                  const entry = row.exams?.find((e) => e.exam_id === ex.exam_id) ?? null;
                  const block = entry?.block;
                  const questions = (ex as { questions?: { question_id: number; number: number; max_score: number }[] }).questions ?? [];
                  const examColsList = columns.filter((c) => c.type === "exam" && c.examId === ex.exam_id) as Extract<ScoreColumnDef, { type: "exam" }>[];
                  return (
                    <Fragment key={ex.exam_id}>
                      {examColsList.map((col) => {
                        const isSelected =
                          !!selectedCell &&
                          selectedCell.enrollmentId === row.enrollment_id &&
                          selectedCell.type === "exam" &&
                          selectedCell.examId === ex.exam_id &&
                          (col.sub === "total" ? selectedCell.sub === "total" : col.sub === "objective" ? selectedCell.sub === "objective" : col.sub === "subjective" ? selectedCell.sub === "subjective" : col.sub === "item" && col.questionId != null ? selectedCell.sub === "item" && selectedCell.questionId === col.questionId : false);
                        const bg = rowChecked ? undefined : { backgroundColor: isSelected ? "var(--color-bg-surface)" : BG_EXAM };

                        if (col.sub === "pass") {
                          return (
                            <td key={col.key} className="min-w-0 text-left align-middle py-2.5 px-3" style={bg} onClick={(e) => { e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id); }}>
                              <PassFailBadge passed={block?.passed} />
                            </td>
                          );
                        }

                        if (col.sub === "total") {
                          const scoreText = block?.score == null ? "-" : `${Math.round(block.score)}`;
                          const canEdit = isEditMode && examEditTotal && !block?.is_locked;
                          return (
                            <td
                              key={col.key}
                              className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              style={bg}
                              onClick={(e) => { e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "total"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}`;
                                    examInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement) el.innerText = block?.score != null ? String(Math.round(block.score)) : "";
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="ds-scores-cell-editable font-medium text-right tabular-nums text-sm outline-none inline-block w-full min-w-0"
                                  onFocus={(e) => {
                                    const el = e.currentTarget;
                                    examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}`] = block?.score != null ? String(Math.round(block.score)) : "";
                                    requestAnimationFrame(() => selectAllScoreCell(el));
                                  }}
                                  onBlur={async () => {
                                    const el = examInputRefs.current[`${row.enrollment_id}-${ex.exam_id}`];
                                    if (!el) return;
                                    const raw = firstLine(el.innerText);
                                    const parsed = parseScoreInput(raw, 100);
                                    if (parsed != null && validateScore(parsed, 100)) {
                                      await patchExamTotalScoreQuick({ examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed, maxScore: 100 });
                                      qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                    } else if (raw !== "") el.innerText = block?.score != null ? String(Math.round(block.score)) : "";
                                  }}
                                  onKeyDown={async (e) => {
                                    const el = examInputRefs.current[`${row.enrollment_id}-${ex.exam_id}`];
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const parsed = parseScoreInput(firstLine(el?.innerText ?? ""), 100);
                                      if (parsed != null && validateScore(parsed, 100)) {
                                        await patchExamTotalScoreQuick({ examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed, maxScore: 100 });
                                        qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                      }
                                      onRequestMoveDown?.();
                                    } else if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) onRequestMovePrev?.(); else onRequestMoveNext?.(); }
                                    else if (e.key === "ArrowLeft") { e.preventDefault(); onRequestMovePrev?.(); }
                                    else if (e.key === "ArrowRight") { e.preventDefault(); onRequestMoveNext?.(); }
                                  }}
                                />
                              ) : (
                                <span className="font-medium text-[var(--color-text-primary)]">{scoreText}</span>
                              )}
                            </td>
                          );
                        }

                        if (col.sub === "objective") {
                          const objScore = block?.objective_score ?? block?.score ?? null;
                          const scoreText = objScore == null ? "-" : `${Math.round(objScore)}`;
                          const canEdit = isEditMode && examEditObjective && !block?.is_locked;
                          return (
                            <td
                              key={col.key}
                              className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              style={bg}
                              onClick={(e) => { e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "objective"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}-objective`;
                                    examObjectiveInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement) el.innerText = objScore != null ? String(Math.round(objScore)) : "";
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="ds-scores-cell-editable font-medium text-right tabular-nums text-sm outline-none inline-block w-full min-w-0"
                                  onFocus={(e) => {
                                    const el = e.currentTarget;
                                    examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}-objective`] = objScore != null ? String(Math.round(objScore)) : "";
                                    requestAnimationFrame(() => selectAllScoreCell(el));
                                  }}
                                  onBlur={async () => {
                                    const el = examObjectiveInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-objective`];
                                    if (!el) return;
                                    const raw = firstLine(el.innerText);
                                    const parsed = parseScoreInput(raw, 100);
                                    if (parsed != null && validateScore(parsed, 100)) {
                                      await patchExamObjectiveScoreQuick({ examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed });
                                      qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                    } else if (raw !== "") el.innerText = objScore != null ? String(Math.round(objScore)) : "";
                                  }}
                                  onKeyDown={async (e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const el = examObjectiveInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-objective`];
                                      const parsed = parseScoreInput(firstLine(el?.innerText ?? ""), 100);
                                      if (parsed != null && validateScore(parsed, 100)) {
                                        await patchExamObjectiveScoreQuick({ examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed });
                                        qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                      }
                                      onRequestMoveDown?.();
                                    } else if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) onRequestMovePrev?.(); else onRequestMoveNext?.(); }
                                  }}
                                />
                              ) : (
                                <span className="font-medium text-[var(--color-text-primary)]">{scoreText}</span>
                              )}
                            </td>
                          );
                        }

                        if (col.sub === "subjective") {
                          const subScore = block?.subjective_score ?? null;
                          const scoreText = subScore != null ? String(Math.round(subScore)) : "-";
                          const canEdit = col.editable && !block?.is_locked;
                          const objScore = block?.objective_score ?? 0;
                          return (
                            <td
                              key={col.key}
                              className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              style={bg}
                              onClick={(e) => { e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "subjective"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}-subjective`;
                                    examSubjectiveInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement) el.innerText = subScore != null ? String(Math.round(subScore)) : "";
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="ds-scores-cell-editable font-medium text-right tabular-nums text-sm outline-none inline-block w-full min-w-0"
                                  onFocus={(e) => {
                                    const el = e.currentTarget;
                                    examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}-subjective`] = subScore != null ? String(Math.round(subScore)) : "";
                                    requestAnimationFrame(() => selectAllScoreCell(el));
                                  }}
                                  onBlur={async () => {
                                    const el = examSubjectiveInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-subjective`];
                                    if (!el) return;
                                    const raw = firstLine(el.innerText);
                                    const parsed = parseScoreInput(raw, 100);
                                    if (parsed != null && validateScore(parsed, 100)) {
                                      const newTotal = (typeof objScore === "number" ? objScore : 0) + parsed;
                                      await patchExamTotalScoreQuick({ examId: ex.exam_id, enrollmentId: row.enrollment_id, score: newTotal, maxScore: 100 });
                                      qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                    } else if (raw !== "") el.innerText = subScore != null ? String(Math.round(subScore)) : "";
                                  }}
                                  onKeyDown={async (e) => {
                                    const el = examSubjectiveInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-subjective`];
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const parsed = parseScoreInput(firstLine(el?.innerText ?? ""), 100);
                                      if (parsed != null && validateScore(parsed, 100)) {
                                        const newTotal = (typeof objScore === "number" ? objScore : 0) + parsed;
                                        await patchExamTotalScoreQuick({ examId: ex.exam_id, enrollmentId: row.enrollment_id, score: newTotal, maxScore: 100 });
                                        qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                      }
                                      onRequestMoveDown?.();
                                    } else if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) onRequestMovePrev?.(); else onRequestMoveNext?.(); }
                                    else if (e.key === "ArrowLeft") { e.preventDefault(); onRequestMovePrev?.(); }
                                    else if (e.key === "ArrowRight") { e.preventDefault(); onRequestMoveNext?.(); }
                                  }}
                                />
                              ) : (
                                <span className="font-medium text-[var(--color-text-primary)]">{scoreText}</span>
                              )}
                            </td>
                          );
                        }

                        if (col.sub === "item" && col.questionId != null) {
                          const q = questions.find((qu) => qu.question_id === col.questionId);
                          const item = entry?.items?.find((i) => i.question_id === col.questionId);
                          const value = item?.score ?? null;
                          const maxScore = item?.max_score ?? q?.max_score ?? 0;
                          const canEdit = isEditMode && examEditSubjective && !block?.is_locked;
                          return (
                            <td
                              key={col.key}
                              className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""}`}
                              style={bg}
                              onClick={(e) => { e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, col.questionId); }}
                            >
                              {canEdit ? (
                                <ScoreInputCell
                                  examId={ex.exam_id}
                                  enrollmentId={row.enrollment_id}
                                  questionId={col.questionId!}
                                  value={value}
                                  maxScore={maxScore}
                                  disabled={!!block?.is_locked}
                                  onSaved={() => qc.invalidateQueries({ queryKey: ["session-scores", sessionId] })}
                                  inputRef={(el) => { examItemInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-${col.questionId}`] = el; }}
                                  onMovePrev={onRequestMovePrev}
                                  onMoveNext={onRequestMoveNext}
                                />
                              ) : (
                                <span className="font-medium text-[var(--color-text-primary)]">{value != null ? String(value) : "-"}</span>
                              )}
                            </td>
                          );
                        }

                        return null;
                      })}
                    </Fragment>
                  );
                })}

                {/* 과제: 점수(점수만) | 합불 — canEditScore이면 block 없어도 입력 셀 표시 */}
                {homeworkOptions.map((hw) => {
                  const entry =
                    row.homeworks?.find(
                      (h) => h.homework_id === hw.homework_id
                    ) ?? null;
                  const block = entry?.block;
                  const isSelected =
                    !!selectedCell &&
                    selectedCell.enrollmentId === row.enrollment_id &&
                    selectedCell.type === "homework" &&
                    selectedCell.homeworkId === hw.homework_id;
                  const canEditScore = isEditMode && homeworkEdit;

                  return (
                    <Fragment key={hw.homework_id}>
                      <td
                        className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "ds-scores-cell-active" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                        style={rowChecked ? undefined : { backgroundColor: isSelected ? "var(--color-bg-surface)" : BG_HOMEWORK }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {canEditScore ? (
                            <span
                              ref={(el) => {
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                homeworkInputRefs.current[key] = el;
                                if (el && el !== document.activeElement) el.innerText = block?.score != null ? String(block.score) : "";
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              className="ds-scores-cell-editable font-medium text-right tabular-nums text-sm text-[var(--color-text-primary)] outline-none inline-block w-full min-w-0"
                              style={{ listStyle: "none" }}
                              onFocus={(e) => {
                                const el = e.currentTarget;
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                scoreValueOnFocusRef.current[key] = block?.score != null ? String(block.score) : "";
                                requestAnimationFrame(() => selectAllScoreCell(el));
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const el = e.currentTarget;
                                el.focus();
                                selectAllScoreCell(el);
                              }}
                              onBlur={async () => {
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                const el = homeworkInputRefs.current[key];
                                if (!el) return;
                                const raw = el.innerText.trim();
                                if (raw === "") {
                                  await patchHomeworkQuick({
                                    sessionId,
                                    enrollmentId: row.enrollment_id,
                                    homeworkId: hw.homework_id,
                                    score: null,
                                  });
                                  qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                  return;
                                }
                                const parsed = parseScoreInput(raw, block?.max_score ?? null);
                                if (parsed != null) {
                                  if (!validateScore(parsed, block?.max_score)) {
                                    el.innerText = block?.score != null ? String(block.score) : "";
                                    return;
                                  }
                                  await patchHomeworkQuick({
                                    sessionId,
                                    enrollmentId: row.enrollment_id,
                                    homeworkId: hw.homework_id,
                                    score: parsed,
                                  });
                                  qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                } else {
                                  el.innerText = block?.score != null ? String(block.score) : "";
                                }
                              }}
                              onKeyDown={async (e) => {
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                const el = homeworkInputRefs.current[key];
                                const raw = el?.innerText?.trim() ?? "";

                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  const prev = scoreValueOnFocusRef.current[key] ?? "";
                                  if (el) el.innerText = prev;
                                  el?.blur();
                                  return;
                                }
                                if (e.key === "Tab") {
                                  e.preventDefault();
                                  if (e.shiftKey) onRequestMovePrev?.();
                                  else onRequestMoveNext?.();
                                  return;
                                }
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (e.shiftKey) {
                                    onRequestMoveUp?.();
                                    return;
                                  }
                                  if (raw === "/") {
                                    await patchHomeworkQuick({
                                      sessionId,
                                      enrollmentId: row.enrollment_id,
                                      homeworkId: hw.homework_id,
                                      score: null,
                                      metaStatus: "NOT_SUBMITTED",
                                    });
                                    qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                    onRequestMoveDown?.();
                                    return;
                                  }
                                  const parsed = parseScoreInput(raw, block?.max_score ?? null);
                                  if (parsed != null) {
                                    if (!validateScore(parsed, block?.max_score)) {
                                      if (el) el.innerText = block?.score != null ? String(block.score) : "";
                                      return;
                                    }
                                    await patchHomeworkQuick({
                                      sessionId,
                                      enrollmentId: row.enrollment_id,
                                      homeworkId: hw.homework_id,
                                      score: parsed,
                                    });
                                    qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
                                  }
                                  onRequestMoveDown?.();
                                  return;
                                }
                                if (e.key === "Delete" || e.key === "Backspace") {
                                  e.preventDefault();
                                  if (el) el.innerText = "";
                                  return;
                                }
                                if (e.ctrlKey || e.metaKey) {
                                  if (e.key === "c") {
                                    e.preventDefault();
                                    const text = el?.innerText?.trim() ?? "";
                                    if (text) await navigator.clipboard.writeText(text);
                                    return;
                                  }
                                  if (e.key === "v") {
                                    e.preventDefault();
                                    try {
                                      const text = await navigator.clipboard.readText();
                                      const pasted = text.trim();
                                      if (el) {
                                        el.innerText = pasted;
                                        requestAnimationFrame(() => selectAllScoreCell(el));
                                      }
                                    } catch {
                                      // clipboard denied
                                    }
                                    return;
                                  }
                                }
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  onRequestMoveUp?.();
                                  return;
                                }
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  onRequestMoveDown?.();
                                  return;
                                }
                                if (e.key === "ArrowLeft") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onRequestMovePrev?.();
                                  return;
                                }
                                if (e.key === "ArrowRight") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onRequestMoveNext?.();
                                  return;
                                }
                              }}
                            />
                          ) : block ? (
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {block?.score != null ? String(block.score) : "-"}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">-</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle py-2.5 px-3"
                        style={rowChecked ? undefined : { backgroundColor: BG_HOMEWORK }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <PassFailBadge passed={block?.passed} />
                      </td>
                    </Fragment>
                  );
                })}

                <td
                  className="text-left align-middle py-2.5 px-3"
                  onClick={() => onSelectRow(row)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {clinicTarget ? (
                      <span
                        className="ds-status-badge px-2 py-0.5 rounded-md text-xs font-medium"
                        data-tone="danger"
                        title="클리닉 대상"
                      >
                        대상
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">해당없음</span>
                    )}
                  </span>
                </td>

                <td
                  className="text-left align-middle py-2.5 px-3 text-[var(--color-text-secondary)] text-sm min-w-0"
                  onClick={() => onSelectRow(row)}
                >
                  {clinicReason || "-"}
                </td>
              </tr>

            </Fragment>
          );
        })}
      </tbody>
    </DomainTable>
  );
}
