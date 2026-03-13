// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조 (SSOT·UX 설계 문서 준수)
 * - 기본 Read-only, Edit Mode 시에만 입력
 * - 3행 헤더: Row1 그룹 | Row2 시험명/과제명 | Row3 점수/합불
 * - 시험/과제 컬럼: exam.title, homework.title 기반 1:1, 서브컬럼 score / pass_fail
 * - 디자인 토큰만 사용, DomainTable 기반
 */

import { useMemo, useRef, useEffect, useState, Fragment, useCallback, forwardRef, useImperativeHandle } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import type { PendingChange } from "../api/scoreDraft";
import { scoresQueryKeys } from "../api/queryKeys";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import { patchExamTotalScoreQuick } from "../api/patchExamTotalQuick";
import { patchExamObjectiveScoreQuick } from "../api/patchExamObjectiveQuick";
import { patchExamSubjectiveScoreQuick } from "../api/patchExamSubjectiveQuick";
import { patchExamItemScore } from "../api/patchItemScore";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import ScoreInputCell from "./ScoreInputCell";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { DomainTable, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import AttendanceStatusBadge, {
  type AttendanceStatus,
  ORDERED_ATTENDANCE_STATUS,
} from "@/shared/ui/badges/AttendanceStatusBadge";
import { feedback } from "@/shared/ui/feedback/feedback";

/** 컬럼 기본 너비 — 설계 문서 12️⃣ */
const COL_EDIT = 44;
const COL_NAME = 120;
const COL_ATTENDANCE = 80;
const COL_SCORE = 84;
const COL_PASS = 64;
const COL_CLINIC_TARGET = 80;
const COL_REASON = 180;


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
    feedback.error(`점수는 0 ~ ${max} 사이로 입력해 주세요.`);
    return false;
  }
  return true;
}

function firstLine(text: string): string {
  return String(text ?? "").split("\n")[0]?.trim() ?? "";
}

/** 시험 헤더용 OMR 아이콘 — 클릭 시 OMR 업로드 모달 */
function OmrIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

/** 셀 키 생성 — pending/dirty 맵 키와 ref 키 일치 */
function pendingKeyForChange(p: PendingChange): string {
  if (p.type === "examTotal") return `examTotal:${p.enrollmentId}:${p.examId}`;
  if (p.type === "examObjective") return `examObjective:${p.enrollmentId}:${p.examId}`;
  if (p.type === "examSubjective") return `examSubjective:${p.enrollmentId}:${p.examId}`;
  return `homework:${p.enrollmentId}:${p.homeworkId}`;
}

/** 합불 표시 — 시험/과제 셀: 합=초록 배지, 불=빨강 배지. 긍정은 초록색 */
function PassFailText({ passed }: { passed: boolean | null | undefined }) {
  if (passed == null) return null;
  return (
    <span
      className="ds-scores-pass-fail-badge"
      data-tone={passed ? "success" : "danger"}
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

/** 출결 셀 팝오버 — 클릭 시 상태 선택 드롭다운 */
function AttendanceCellPopover({
  currentStatus,
  enrollmentId,
  hasAttendanceRecord,
  onSelect,
}: {
  currentStatus: string | undefined;
  enrollmentId: number;
  hasAttendanceRecord: boolean;
  onSelect: (enrollmentId: number, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!hasAttendanceRecord) {
    return <span className="text-[var(--color-text-muted)]">-</span>;
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        title="출결 변경"
      >
        {currentStatus ? (
          <AttendanceStatusBadge status={currentStatus as AttendanceStatus} variant="2ch" />
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        )}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] rounded-md shadow-lg py-1 min-w-[88px]"
          style={{ maxHeight: 240, overflowY: "auto" }}
        >
          {ORDERED_ATTENDANCE_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-bg-surface-hover)] transition-colors ${s === currentStatus ? "bg-[var(--color-bg-surface-hover)]" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(enrollmentId, s);
                setOpen(false);
              }}
            >
              <AttendanceStatusBadge status={s} variant="2ch" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

/** Imperative handle — focus a cell directly without a React state cycle; 편집 종료 시 한 번에 저장 */
export type ScoresTableHandle = {
  imperativeFocusCell: (cell: {
    enrollmentId: number;
    type: "exam";
    examId: number;
    sub: "total" | "objective" | "subjective";
    questionId?: undefined;
  } | {
    enrollmentId: number;
    type: "exam";
    examId: number;
    sub: "item";
    questionId: number;
  } | {
    enrollmentId: number;
    type: "homework";
    homeworkId: number;
  }) => void;
  /** 편집 모드 종료 시 호출 — 대기 중인 변경을 한 번에 저장 */
  flushPendingChanges: () => Promise<void>;
  /** 자동 저장/복원용: 현재 pending 스냅샷 */
  getPendingSnapshot: () => PendingChange[];
  /** 드래프트 복원 시 호출 — pending+dirty 반영 후 셀 DOM 갱신 */
  applyDraftPatch: (changes: PendingChange[]) => void;
};

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;
  attendanceMap?: Record<number, string>;
  /** enrollment_id → attendance record id (for PATCH) */
  attendanceIdMap?: Record<number, number>;
  /** 출결 상태 변경 콜백 (always editable) */
  onAttendanceChange?: (enrollmentId: number, newStatus: string) => void;

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

  /** 키보드 셀 이동 — Tab/Enter/Arrow 시 패널에서 다음 셀로 이동 */
  onRequestMoveNext?: () => void;
  onRequestMovePrev?: () => void;
  onRequestMoveDown?: () => void;
  onRequestMoveUp?: () => void;

  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;

  /** 시험 컬럼 헤더에서 OMR 업로드 모달 열기 */
  onOpenOmrModal?: (examId: number, title: string) => void;

  /** 시험/과제 표시 순서 변경 */
  onReorder?: (type: "exam" | "homework", id: number, direction: "up" | "down") => void;
};

const ScoresTable = forwardRef<ScoresTableHandle, Props>(function ScoresTable({
  rows,
  meta,
  sessionId,
  attendanceMap = {},
  attendanceIdMap = {},
  onAttendanceChange,
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
  onRequestMoveNext,
  onRequestMovePrev,
  onRequestMoveDown,
  onRequestMoveUp,
  selectedEnrollmentIds = [],
  onSelectionChange,
  onOpenOmrModal,
  onReorder,
}: Props, ref) {
  const qc = useQueryClient();
  const homeworkInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examObjectiveInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examSubjectiveInputRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const examItemInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  /** ESC 복원용 — 포커스 진입 시점의 값 */
  const scoreValueOnFocusRef = useRef<Record<string, string>>({});
  const examScoreValueOnFocusRef = useRef<Record<string, string>>({});
  /** 편집 종료 시 한 번에 저장: 셀별 최종 변경만 유지 */
  const pendingRef = useRef<Map<string, PendingChange>>(new Map());
  /** pending에 있는 셀은 sync effect에서 innerText 덮어쓰지 않음 */
  const dirtyKeysRef = useRef<Set<string>>(new Set());

  /** 편집 종료 시 한 번에 저장 — pending 항목 전부 API 호출 후 한 번만 invalidate */
  const flushPendingChanges = useCallback(async () => {
    const list = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    dirtyKeysRef.current.clear();
    if (list.length === 0) return;
    let hasError = false;
    for (const p of list) {
      try {
        if (p.type === "examTotal") {
          await patchExamTotalScoreQuick({ examId: p.examId, enrollmentId: p.enrollmentId, score: p.score, maxScore: 100 });
        } else if (p.type === "examObjective") {
          await patchExamObjectiveScoreQuick({ examId: p.examId, enrollmentId: p.enrollmentId, score: p.score });
        } else if (p.type === "examSubjective") {
          await patchExamSubjectiveScoreQuick({ examId: p.examId, enrollmentId: p.enrollmentId, score: p.score });
        } else {
          await patchHomeworkQuick({
            sessionId,
            enrollmentId: p.enrollmentId,
            homeworkId: p.homeworkId,
            score: p.score,
            metaStatus: p.metaStatus ?? undefined,
          });
        }
      } catch {
        hasError = true;
      }
    }
    qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
    if (hasError) feedback.error("일부 점수 저장에 실패했습니다.");
  }, [qc, sessionId]);

  /** 현재 pending 변경 목록 스냅샷 — 자동 저장/복원용 */
  const getPendingSnapshot = useCallback((): PendingChange[] => {
    return Array.from(pendingRef.current.values());
  }, []);

  /** 드래프트 복원: pending+dirty 설정 후 해당 셀 DOM 텍스트 갱신 */
  const applyDraftPatch = useCallback((changes: PendingChange[]) => {
    pendingRef.current.clear();
    dirtyKeysRef.current.clear();
    for (const p of changes) {
      const key = pendingKeyForChange(p);
      pendingRef.current.set(key, p);
      dirtyKeysRef.current.add(key);
    }
    for (const p of changes) {
      if (p.type === "examTotal") {
        const el = examInputRefs.current[`${p.enrollmentId}-${p.examId}`];
        if (el) el.innerText = String(Math.round(p.score));
      } else if (p.type === "examObjective") {
        const el = examObjectiveInputRefs.current[`${p.enrollmentId}-${p.examId}-objective`];
        if (el) el.innerText = String(Math.round(p.score));
      } else if (p.type === "examSubjective") {
        const el = examSubjectiveInputRefs.current[`${p.enrollmentId}-${p.examId}-subjective`];
        if (el) el.innerText = String(Math.round(p.score));
      } else if (p.type === "homework") {
        const el = homeworkInputRefs.current[`${p.enrollmentId}-${p.homeworkId}`];
        if (el) el.innerText = p.metaStatus === "NOT_SUBMITTED" ? "미제출" : (p.score != null ? String(p.score) : "");
      }
    }
  }, []);

  const examOptions = meta?.exams ?? [];
  const homeworkOptions = meta?.homeworks ?? [];

  /** 편집 모드 시 점수 셀 동기화: 포커스 아닐 때만 서버 값으로 contenteditable 텍스트 갱신 (pending 셀은 건드리지 않음) */
  useEffect(() => {
    if (!rows.length) return;
    homeworkOptions.forEach((hw) => {
      rows.forEach((row) => {
        const key = `${row.enrollment_id}-${hw.homework_id}`;
        if (dirtyKeysRef.current.has(`homework:${row.enrollment_id}:${hw.homework_id}`)) return;
        const el = homeworkInputRefs.current[key];
        if (!el || el === document.activeElement) return;
        const entry = row.homeworks?.find((h) => h.homework_id === hw.homework_id);
        const block = entry?.block;
        const metaStatus = block?.meta?.status;
        const score = block?.score;
        if (metaStatus === "NOT_SUBMITTED") {
          el.innerText = "미제출";
        } else {
          el.innerText = score != null ? String(score) : "";
        }
      });
    });
  }, [rows, homeworkOptions]);

  useEffect(() => {
    if (!rows.length) return;
    examOptions.forEach((ex) => {
      rows.forEach((row) => {
        const key = `${row.enrollment_id}-${ex.exam_id}`;
        if (dirtyKeysRef.current.has(`examTotal:${row.enrollment_id}:${ex.exam_id}`)) return;
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
        const key = `${row.enrollment_id}-${ex.exam_id}-objective`;
        if (dirtyKeysRef.current.has(`examObjective:${row.enrollment_id}:${ex.exam_id}`)) return;
        const el = examObjectiveInputRefs.current[key];
        if (!el || el === document.activeElement) return;
        const entry = row.exams?.find((e) => e.exam_id === ex.exam_id);
        const score = entry?.block?.objective_score ?? entry?.block?.score;
        el.innerText = score != null ? String(Math.round(score)) : "";
      });
    });
  }, [rows, examOptions]);

  useEffect(() => {
    if (!rows.length) return;
    examOptions.forEach((ex) => {
      rows.forEach((row) => {
        const key = `${row.enrollment_id}-${ex.exam_id}-subjective`;
        if (dirtyKeysRef.current.has(`examSubjective:${row.enrollment_id}:${ex.exam_id}`)) return;
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

  /** Imperative focus — called directly by SessionScoresPanel; no React state cycle */
  useImperativeHandle(ref, () => ({
    imperativeFocusCell(cell) {
      if (cell.type === "homework") {
        const el = homeworkInputRefs.current[`${cell.enrollmentId}-${cell.homeworkId}`];
        if (el) { el.focus(); selectAllScoreCell(el); }
        return;
      }
      if (cell.type === "exam") {
        if (cell.sub === "item" && cell.questionId != null) {
          const el = examItemInputRefs.current[`${cell.enrollmentId}-${cell.examId}-${cell.questionId}`];
          if (el) el.focus();
          return;
        }
        if (cell.sub === "objective") {
          const el = examObjectiveInputRefs.current[`${cell.enrollmentId}-${cell.examId}-objective`];
          if (el) { el.focus(); selectAllScoreCell(el); }
          return;
        }
        if (cell.sub === "subjective") {
          const el = examSubjectiveInputRefs.current[`${cell.enrollmentId}-${cell.examId}-subjective`];
          if (el) { el.focus(); selectAllScoreCell(el); }
          return;
        }
        const el = examInputRefs.current[`${cell.enrollmentId}-${cell.examId}`];
        if (el) { el.focus(); selectAllScoreCell(el); }
      }
    },
    flushPendingChanges,
    getPendingSnapshot,
    applyDraftPatch,
  }), [selectAllScoreCell, flushPendingChanges, getPendingSnapshot, applyDraftPatch]);

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
          list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "subjective", key: `exam_${e.exam_id}_subjective`, width: COL_SCORE, editable: true });
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

  /** Pre-computed O(1) lookup — replaces columns.filter() in the per-row render hot path */
  const examColsMap = useMemo((): Record<number, Extract<ScoreColumnDef, { type: "exam" }>[]> => {
    const map: Record<number, Extract<ScoreColumnDef, { type: "exam" }>[]> = {};
    for (const c of columns) {
      if (c.type === "exam") {
        if (!map[c.examId]) map[c.examId] = [];
        map[c.examId].push(c);
      }
    }
    return map;
  }, [columns]);

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
        {/* Row0: OMR 업로드 아이콘 — 시험 컬럼 위에만 배치 */}
        {onOpenOmrModal && examOptions.length > 0 && (
          <tr className="border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)]">
            <td colSpan={3} className="py-1 px-2 align-middle border-r-2 border-[var(--color-border-divider)]" />
            {examOptions.map((ex) => {
              const examColsList = examColsMap[ex.exam_id] ?? [];
              const colSpan = examColsList.length || 1;
              return (
                <td
                  key={`omr-exam-${ex.exam_id}`}
                  colSpan={colSpan}
                  className="py-1 px-2 align-middle text-center"
                >
                  <button
                    type="button"
                    onClick={() => onOpenOmrModal(ex.exam_id, ex.title ?? "")}
                    className="inline-flex items-center justify-center gap-1.5 w-auto min-w-[7rem] h-7 rounded border-0 text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-bg-surface)]"
                    title={`OMR 스캔 업로드 — ${ex.title ?? ""}`}
                    aria-label={`${ex.title ?? "시험"} OMR 업로드`}
                  >
                    <OmrIcon size={16} />
                    <span>omr업로드</span>
                  </button>
                </td>
              );
            })}
            <td colSpan={homeworkOptions.length * 2} className="py-1 px-2" />
            <td colSpan={2} className="py-1 px-2" />
          </tr>
        )}
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
            className="text-center font-semibold text-[var(--color-text-primary)] py-2.5 px-3 border-l-2 border-[var(--color-border-divider)]"
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
            className="text-center font-semibold text-[var(--color-text-primary)] py-2.5 px-3"
          >
            출석
          </ResizableTh>
          {examOptions.map((ex, idx) => {
            const examColsList = examColsMap[ex.exam_id] ?? [];
            const colSpan = examColsList.length || 1;
            return (
              <th
                key={`head-exam-${ex.exam_id}`}
                scope="col"
                colSpan={colSpan}
                className="group text-center font-medium text-[var(--color-text-primary)] py-2 px-3 truncate"
                title={ex.title}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="ds-status-badge ds-status-badge--1ch" data-tone="primary" aria-label="시험">
                    시
                  </span>
                  <span className="truncate">{ex.title}</span>
                  {onReorder && examOptions.length > 1 && (
                    <span className="inline-flex items-center gap-0 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: undefined }}>
                      <button type="button" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onReorder("exam", ex.exam_id, "up"); }} className="p-0.5 rounded hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-20 disabled:pointer-events-none" aria-label="왼쪽으로" title="왼쪽으로">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                      <button type="button" disabled={idx === examOptions.length - 1} onClick={(e) => { e.stopPropagation(); onReorder("exam", ex.exam_id, "down"); }} className="p-0.5 rounded hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-20 disabled:pointer-events-none" aria-label="오른쪽으로" title="오른쪽으로">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    </span>
                  )}
                </span>
              </th>
            );
          })}
          {homeworkOptions.map((hw, idx) => (
            <th
              key={`head-hw-${hw.homework_id}`}
              scope="col"
              colSpan={2}
              className="group text-center font-medium text-[var(--color-text-primary)] py-2 px-3 truncate"
              title={hw.title}
            >
              <span className="inline-flex items-center gap-1">
                <span className="ds-status-badge ds-status-badge--1ch" data-tone="complement" aria-label="과제">
                  과
                </span>
                <span className="truncate">{hw.title}</span>
                {onReorder && homeworkOptions.length > 1 && (
                  <span className="inline-flex items-center gap-0 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: undefined }}>
                    <button type="button" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onReorder("homework", hw.homework_id, "up"); }} className="p-0.5 rounded hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-20 disabled:pointer-events-none" aria-label="왼쪽으로" title="왼쪽으로">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <button type="button" disabled={idx === homeworkOptions.length - 1} onClick={(e) => { e.stopPropagation(); onReorder("homework", hw.homework_id, "down"); }} className="p-0.5 rounded hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-20 disabled:pointer-events-none" aria-label="오른쪽으로" title="오른쪽으로">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </span>
                )}
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
            className="text-center font-semibold text-[var(--color-text-primary)] py-2.5 px-3"
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
            className="text-center font-semibold text-[var(--color-text-primary)] py-2.5 px-3 min-w-0"
          >
            사유
          </ResizableTh>
        </tr>
        {/* Row2: 시험별 서브헤더(합산/객관식/주관식/N번/합불) | 과제 점수/합불 */}
        <tr className="border-b-2 border-[var(--color-border-divider)]">
          {examOptions.map((ex) => {
            const examColsList = (examColsMap[ex.exam_id] ?? []) as Extract<ScoreColumnDef, { type: "exam" }>[];
            const questions = (ex as { questions?: { question_id: number; number: number }[] }).questions ?? [];
            return (
              <Fragment key={ex.exam_id}>
                {examColsList.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="text-center text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                    style={{ width: c.sub === "pass" ? COL_PASS : COL_SCORE, minWidth: 48 }}
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
                className="text-center text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{
                  width: columnWidths[`hw_${hw.homework_id}_score`] ?? COL_SCORE,
                  minWidth: 48,
                  maxWidth: 200,
                }}
              >
                점수
              </th>
              <th
                scope="col"
                className="text-center text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{
                  width: columnWidths[`hw_${hw.homework_id}_pass`] ?? COL_PASS,
                  minWidth: 48,
                  maxWidth: 100,
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
                  className="font-semibold min-w-0 text-[var(--color-text-primary)] py-2.5 px-3 align-middle border-l-2 border-[var(--color-border-divider)]"
                  onClick={() => onSelectRow(row)}
                >
                  <StudentNameWithLectureChip
                    name={row.student_name ?? ""}
                    profilePhotoUrl={row.profile_photo_url ?? undefined}
                    avatarSize={24}
                    clinicHighlight={row.name_highlight_clinic_target === true}
                    lectures={
                      row.lecture_title
                        ? [{ lectureName: row.lecture_title, color: row.lecture_color }]
                        : undefined
                    }
                    chipSize={14}
                  />
                </td>

                <td className="ds-scores-cell-attendance text-center py-2.5 px-3 align-middle">
                  {onAttendanceChange ? (
                    <AttendanceCellPopover
                      currentStatus={attendanceMap[row.enrollment_id]}
                      enrollmentId={row.enrollment_id}
                      hasAttendanceRecord={attendanceIdMap[row.enrollment_id] != null}
                      onSelect={onAttendanceChange}
                    />
                  ) : (
                    (() => {
                      const status = attendanceMap[row.enrollment_id];
                      if (!status)
                        return <span className="text-[var(--color-text-muted)]">-</span>;
                      return (
                        <AttendanceStatusBadge
                          status={status as AttendanceStatus}
                          variant="2ch"
                        />
                      );
                    })()
                  )}
                </td>

                {/* 시험: 컬럼 정의에 따라 합산/객관식/주관식/문항별/합불 */}
                {examOptions.map((ex) => {
                  const entry = row.exams?.find((e) => e.exam_id === ex.exam_id) ?? null;
                  const block = entry?.block;
                  const questions = (ex as { questions?: { question_id: number; number: number; max_score: number }[] }).questions ?? [];
                  const examColsList = (examColsMap[ex.exam_id] ?? []) as Extract<ScoreColumnDef, { type: "exam" }>[];
                  const notEnrolledForExam = !entry;
                  return (
                    <Fragment key={ex.exam_id}>
                      {examColsList.map((col) => {
                        /* 시험 대상 미등록 → 회색 비활성 셀 */
                        if (notEnrolledForExam) {
                          return (
                            <td
                              key={col.key}
                              className="min-w-0 align-middle py-2.5 px-3 bg-[var(--color-bg-surface-hover)]"
                            >
                              <span className="text-[var(--color-text-muted)] select-none">-</span>
                            </td>
                          );
                        }
                        const isSelected =
                          !!selectedCell &&
                          selectedCell.enrollmentId === row.enrollment_id &&
                          selectedCell.type === "exam" &&
                          selectedCell.examId === ex.exam_id &&
                          (col.sub === "total" ? selectedCell.sub === "total" : col.sub === "objective" ? selectedCell.sub === "objective" : col.sub === "subjective" ? selectedCell.sub === "subjective" : col.sub === "item" && col.questionId != null ? selectedCell.sub === "item" && selectedCell.questionId === col.questionId : false);

                        if (col.sub === "pass") {
                          return (
                            <td key={col.key} className="min-w-0 text-center align-middle py-2.5 px-3" onClick={(e) => { if (isEditMode) e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id); }}>
                              <PassFailText passed={block?.passed} />
                            </td>
                          );
                        }

                        if (col.sub === "total") {
                          const scoreText = block?.score == null ? "-" : `${Math.round(block.score)}`;
                          const canEdit = isEditMode && examEditTotal && !block?.is_locked;
                          return (
                            <td
                              key={col.key}
                              className={`min-w-0 text-center align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              onClick={(e) => { if (isEditMode) e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "total"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}`;
                                    examInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement && !dirtyKeysRef.current.has(`examTotal:${row.enrollment_id}:${ex.exam_id}`)) el.innerText = block?.score != null ? String(Math.round(block.score)) : "";
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="ds-scores-cell-editable font-medium text-center tabular-nums text-sm outline-none inline-block w-full min-w-0"
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
                                      const key = `examTotal:${row.enrollment_id}:${ex.exam_id}`;
                                      pendingRef.current.set(key, { type: "examTotal", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed });
                                      dirtyKeysRef.current.add(key);
                                    } else if (raw !== "") el.innerText = block?.score != null ? String(Math.round(block.score)) : "";
                                  }}
                                  onKeyDown={(e) => {
                                    const el = examInputRefs.current[`${row.enrollment_id}-${ex.exam_id}`];
                                    if (e.key === "Escape") {
                                      e.preventDefault(); e.stopPropagation();
                                      const prev = examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}`] ?? "";
                                      if (el) el.innerText = prev;
                                      el?.blur();
                                    } else if (e.key === "Enter") {
                                      e.preventDefault(); e.stopPropagation();
                                      onRequestMoveDown?.();
                                    } else if (e.key === "Tab") {
                                      e.preventDefault(); e.stopPropagation();
                                      if (e.shiftKey) onRequestMovePrev?.();
                                      else onRequestMoveNext?.();
                                    } else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); onRequestMoveUp?.(); }
                                    else if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); onRequestMoveDown?.(); }
                                    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); onRequestMovePrev?.(); }
                                    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); onRequestMoveNext?.(); }
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
                              className={`min-w-0 text-center align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              onClick={(e) => { if (isEditMode) e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "objective"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}-objective`;
                                    examObjectiveInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement && !dirtyKeysRef.current.has(`examObjective:${row.enrollment_id}:${ex.exam_id}`)) el.innerText = objScore != null ? String(Math.round(objScore)) : "";
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="ds-scores-cell-editable font-medium text-center tabular-nums text-sm outline-none inline-block w-full min-w-0"
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
                                      const key = `examObjective:${row.enrollment_id}:${ex.exam_id}`;
                                      pendingRef.current.set(key, { type: "examObjective", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed });
                                      dirtyKeysRef.current.add(key);
                                    } else if (raw !== "") el.innerText = objScore != null ? String(Math.round(objScore)) : "";
                                  }}
                                  onKeyDown={(e) => {
                                    const el = examObjectiveInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-objective`];
                                    if (e.key === "Escape") {
                                      e.preventDefault(); e.stopPropagation();
                                      const prev = examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}-objective`] ?? "";
                                      if (el) el.innerText = prev;
                                      el?.blur();
                                    } else if (e.key === "Enter") {
                                      e.preventDefault(); e.stopPropagation();
                                      onRequestMoveDown?.();
                                    } else if (e.key === "Tab") {
                                      e.preventDefault(); e.stopPropagation();
                                      if (e.shiftKey) onRequestMovePrev?.();
                                      else onRequestMoveNext?.();
                                    } else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); onRequestMoveUp?.(); }
                                    else if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); onRequestMoveDown?.(); }
                                    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); onRequestMovePrev?.(); }
                                    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); onRequestMoveNext?.(); }
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
                          return (
                            <td
                              key={col.key}
                              className={`min-w-0 text-center align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              onClick={(e) => { if (isEditMode) e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "subjective"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}-subjective`;
                                    examSubjectiveInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement && !dirtyKeysRef.current.has(`examSubjective:${row.enrollment_id}:${ex.exam_id}`)) el.innerText = subScore != null ? String(Math.round(subScore)) : "";
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="ds-scores-cell-editable font-medium text-center tabular-nums text-sm outline-none inline-block w-full min-w-0"
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
                                      const key = `examSubjective:${row.enrollment_id}:${ex.exam_id}`;
                                      pendingRef.current.set(key, { type: "examSubjective", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed });
                                      dirtyKeysRef.current.add(key);
                                    } else if (raw !== "") el.innerText = subScore != null ? String(Math.round(subScore)) : "";
                                  }}
                                  onKeyDown={(e) => {
                                    const el = examSubjectiveInputRefs.current[`${row.enrollment_id}-${ex.exam_id}-subjective`];
                                    if (e.key === "Escape") {
                                      e.preventDefault(); e.stopPropagation();
                                      const prev = examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}-subjective`] ?? "";
                                      if (el) el.innerText = prev;
                                      el?.blur();
                                    } else if (e.key === "Enter") {
                                      e.preventDefault(); e.stopPropagation();
                                      onRequestMoveDown?.();
                                    } else if (e.key === "Tab") {
                                      e.preventDefault(); e.stopPropagation();
                                      if (e.shiftKey) onRequestMovePrev?.();
                                      else onRequestMoveNext?.();
                                    } else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); onRequestMoveUp?.(); }
                                    else if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); onRequestMoveDown?.(); }
                                    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); onRequestMovePrev?.(); }
                                    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); onRequestMoveNext?.(); }
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
                              className={`min-w-0 text-center align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""}`}
                              onClick={(e) => { if (isEditMode) e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, col.questionId); }}
                            >
                              {canEdit ? (
                                <ScoreInputCell
                                  examId={ex.exam_id}
                                  enrollmentId={row.enrollment_id}
                                  questionId={col.questionId!}
                                  value={value}
                                  maxScore={maxScore}
                                  disabled={!!block?.is_locked}
                                  onSaved={() => qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) })}
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
                  const notEnrolledForHw = !entry;
                  const isSelected =
                    !!selectedCell &&
                    selectedCell.enrollmentId === row.enrollment_id &&
                    selectedCell.type === "homework" &&
                    selectedCell.homeworkId === hw.homework_id;
                  const canEditScore = isEditMode && homeworkEdit && !notEnrolledForHw;
                  const isNotSubmitted = block?.meta?.status === "NOT_SUBMITTED";

                  return (
                    <Fragment key={hw.homework_id}>
                      {notEnrolledForHw ? (
                        <>
                          <td className="min-w-0 align-middle py-2.5 px-3 bg-[var(--color-bg-surface-hover)]">
                            <span className="text-[var(--color-text-muted)] select-none">-</span>
                          </td>
                          <td className="min-w-0 align-middle py-2.5 px-3 bg-[var(--color-bg-surface-hover)]">
                            <span className="text-[var(--color-text-muted)] select-none">-</span>
                          </td>
                        </>
                      ) : (
                      <>
                      <td
                        className={`min-w-0 text-center align-middle py-2.5 px-3 ${isSelected ? "ds-scores-cell-active" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                        onClick={(e) => {
                          if (isEditMode) e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {canEditScore ? (
                            <span
                              ref={(el) => {
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                homeworkInputRefs.current[key] = el;
                                if (el && el !== document.activeElement && !dirtyKeysRef.current.has(`homework:${row.enrollment_id}:${hw.homework_id}`)) {
                                  if (isNotSubmitted) el.innerText = "미제출";
                                  else el.innerText = block?.score != null ? String(block.score) : "";
                                }
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              className={`ds-scores-cell-editable font-medium text-right tabular-nums text-sm outline-none inline-block w-full min-w-0 ${isNotSubmitted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}
                              style={{ listStyle: "none" }}
                              onFocus={(e) => {
                                const el = e.currentTarget;
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                scoreValueOnFocusRef.current[key] = isNotSubmitted ? "미제출" : (block?.score != null ? String(block.score) : "");
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
                                const cellKey = `homework:${row.enrollment_id}:${hw.homework_id}`;
                                const el = homeworkInputRefs.current[key];
                                if (!el) return;
                                const raw = el.innerText.trim();
                                if (raw === "미제출") {
                                  pendingRef.current.set(cellKey, { type: "homework", enrollmentId: row.enrollment_id, homeworkId: hw.homework_id, score: null, metaStatus: "NOT_SUBMITTED" });
                                  dirtyKeysRef.current.add(cellKey);
                                  return;
                                }
                                if (raw === "") {
                                  pendingRef.current.set(cellKey, { type: "homework", enrollmentId: row.enrollment_id, homeworkId: hw.homework_id, score: null });
                                  dirtyKeysRef.current.add(cellKey);
                                  return;
                                }
                                const parsed = parseScoreInput(raw, block?.max_score ?? null);
                                if (parsed != null) {
                                  if (!validateScore(parsed, block?.max_score)) {
                                    el.innerText = isNotSubmitted ? "미제출" : (block?.score != null ? String(block.score) : "");
                                    return;
                                  }
                                  pendingRef.current.set(cellKey, { type: "homework", enrollmentId: row.enrollment_id, homeworkId: hw.homework_id, score: parsed });
                                  dirtyKeysRef.current.add(cellKey);
                                } else {
                                  el.innerText = isNotSubmitted ? "미제출" : (block?.score != null ? String(block.score) : "");
                                }
                              }}
                              onKeyDown={async (e) => {
                                const key = `${row.enrollment_id}-${hw.homework_id}`;
                                const el = homeworkInputRefs.current[key] ?? (e.target instanceof HTMLElement ? e.target : null);
                                const raw = (e.target instanceof HTMLElement ? e.target.innerText?.trim() : el?.innerText?.trim()) ?? "";

                                if (e.key === "Escape") {
                                  e.preventDefault(); e.stopPropagation();
                                  const prev = scoreValueOnFocusRef.current[key] ?? "";
                                  if (el) el.innerText = prev;
                                  el?.blur();
                                  return;
                                }
                                if (e.key === "Tab") {
                                  e.preventDefault(); e.stopPropagation();
                                  if (e.shiftKey) onRequestMovePrev?.();
                                  else onRequestMoveNext?.();
                                  return;
                                }
                                if (e.key === "Enter") {
                                  e.preventDefault(); e.stopPropagation();
                                  if (e.shiftKey) {
                                    onRequestMoveUp?.();
                                    return;
                                  }
                                  if (raw === "/") {
                                    if (el) el.innerText = "미제출";
                                    const cellKey = `homework:${row.enrollment_id}:${hw.homework_id}`;
                                    pendingRef.current.set(cellKey, { type: "homework", enrollmentId: row.enrollment_id, homeworkId: hw.homework_id, score: null, metaStatus: "NOT_SUBMITTED" });
                                    dirtyKeysRef.current.add(cellKey);
                                    onRequestMoveDown?.();
                                    return;
                                  }
                                  if (raw === "미제출") {
                                    const cellKey = `homework:${row.enrollment_id}:${hw.homework_id}`;
                                    pendingRef.current.set(cellKey, { type: "homework", enrollmentId: row.enrollment_id, homeworkId: hw.homework_id, score: null, metaStatus: "NOT_SUBMITTED" });
                                    dirtyKeysRef.current.add(cellKey);
                                    onRequestMoveDown?.();
                                    return;
                                  }
                                  const parsed = parseScoreInput(raw, block?.max_score ?? null);
                                  if (parsed != null) {
                                    if (!validateScore(parsed, block?.max_score)) {
                                      if (el) el.innerText = isNotSubmitted ? "미제출" : (block?.score != null ? String(block.score) : "");
                                      return;
                                    }
                                    const cellKey = `homework:${row.enrollment_id}:${hw.homework_id}`;
                                    pendingRef.current.set(cellKey, { type: "homework", enrollmentId: row.enrollment_id, homeworkId: hw.homework_id, score: parsed });
                                    dirtyKeysRef.current.add(cellKey);
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
                                    if (text) {
                                      try {
                                        await navigator.clipboard.writeText(text);
                                      } catch {
                                        // clipboard writeText denied (Edge security context, iframe, etc.)
                                      }
                                    }
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
                                  e.preventDefault(); e.stopPropagation();
                                  onRequestMoveUp?.();
                                  return;
                                }
                                if (e.key === "ArrowDown") {
                                  e.preventDefault(); e.stopPropagation();
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
                            <span className={`font-medium ${isNotSubmitted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}>
                              {isNotSubmitted ? "미제출" : (block?.score != null ? String(block.score) : "-")}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">-</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-center align-middle py-2.5 px-3"
                        onClick={(e) => {
                          if (isEditMode) e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <PassFailText passed={block?.passed} />
                      </td>
                      </>
                      )}
                    </Fragment>
                  );
                })}

                <td
                  className="text-center align-middle py-2.5 px-3"
                >
                  {clinicTarget ? (
                    <span className="ds-scores-pass-fail-badge" data-tone="danger">
                      불합
                    </span>
                  ) : (
                    <span className="ds-scores-pass-fail-badge" data-tone="success">
                      합격
                    </span>
                  )}
                </td>

                <td
                  className="text-center align-middle py-2.5 px-3 min-w-0"
                >
                  {clinicReason ? (
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {clinicReason}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">-</span>
                  )}
                </td>
              </tr>

            </Fragment>
          );
        })}
      </tbody>
    </DomainTable>
  );
});

export default ScoresTable;
