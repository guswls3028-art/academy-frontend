// PATH: src/app_admin/domains/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조 (SSOT·UX 설계 문서 준수)
 * - 기본 Read-only, Edit Mode 시에만 입력
 * - 2행 헤더: Row1 그룹 헤더(rowSpan=2 고정 컬럼 + colSpan 시험/과제 그룹) | Row2 서브헤더(점수/합불)
 * - 시험/과제 컬럼: exam.title, homework.title 기반 1:1, 서브컬럼 score / pass_fail
 * - 셀 패딩은 table.css의 .ds-scores-table 규칙으로 제어, 인라인 패딩 없음
 * - data-col-type / data-group-start / data-section-start 속성으로 CSS 타겟팅
 * - 디자인 토큰만 사용, DomainTable 기반
 */

import { useMemo, useRef, useEffect, Fragment, useCallback, forwardRef, useImperativeHandle } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import type { PendingChange } from "../api/scoreDraft";
import { scoresQueryKeys } from "../api/queryKeys";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import { patchExamTotalScoreQuick } from "../api/patchExamTotalQuick";
import { patchExamObjectiveScoreQuick } from "../api/patchExamObjectiveQuick";
import { patchExamSubjectiveScoreQuick } from "../api/patchExamSubjectiveQuick";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import { getSessionScoresTableVerdict } from "../utils/sessionScoreRowVerdict";
import ScoreInputCell from "./ScoreInputCell";
import ExamHeaderQuickEdit from "./ExamHeaderQuickEdit";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Badge } from "@/shared/ui/ds";
import { DomainTable, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import { feedback } from "@/shared/ui/feedback/feedback";

/** 컬럼 기본 너비 */
const COL_EDIT = 36;
// 2026-05-13 4차 Visual Polish:
// 1100 narrow viewport (학원장 PC 기본 폭 일부) wrap 836 안에 들어가도록 default 재조정.
// 직전 합산 1284px → 836 < 1284 → 가로 스크롤 강요. 신규 합산 813px ≤ 836 → viewport 내 안착.
// 합산 계산: 36 + 196 + 56 + 125*3 + 96 + 72 = 831 + alpha
// 학원장이 폭 부족 시 ResizableTh 드래그로 직접 조정 가능 (5/13 1차 fix).
const COL_NAME = 196;
const COL_ATTENDANCE = 56;
const COL_SCORE = 125;
const COL_CLINIC_TARGET = 72;


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

/** 2026-05-13 학원장 결정 시행: 시험 단위 status 폐기 → 학생별 진행 상태가 SSOT.
 *  점수 셀 tooltip 으로 노출 (클리닉 1차/2차/3차 정합). */
function achievementLabel(block: { passed?: boolean | null; achievement?: string | null; meta?: { status?: string | null } | null } | null | undefined): string {
  if (!block) return "진행중";
  if (block.meta?.status === "NOT_SUBMITTED") return "진행중 (미응시)";
  if (block.achievement === "REMEDIATED") return "이수 (보강)";
  if (block.achievement === "PASS" || block.passed === true) return "이수";
  if (block.achievement === "FAIL" || block.passed === false) return "판정 대기 (클리닉 대상)";
  return "진행중";
}

/** 셀 키 생성 — pending/dirty 맵 키와 ref 키 일치 */
function pendingKeyForChange(p: PendingChange): string {
  if (p.type === "examTotal") return `examTotal:${p.enrollmentId}:${p.examId}`;
  if (p.type === "examObjective") return `examObjective:${p.enrollmentId}:${p.examId}`;
  if (p.type === "examSubjective") return `examSubjective:${p.enrollmentId}:${p.examId}`;
  return `homework:${p.enrollmentId}:${p.homeworkId}`;
}

// PassFailText 컴포넌트 제거(2026-05-12): 합불 컬럼 자체 제거 — 점수 셀 data-pass-status 색상/border로 대체.
// OmrUploadButton 컴포넌트 제거(2026-05-13 P0-2): 헤더 위 absolute 미니버튼 제거.
// OMR 업로드는 SessionScoresEntryPage 툴바의 OMR 버튼(시험 1개 직진 / 2+개 드롭다운) 단일 경로.

/** 클리닉 대상 여부 + 대상 사유 (시험 / 시험+과제 / 과제)
 *  row.clinic_required (서버 판정)이 SSOT. 사유만 로컬에서 표시용으로 추론. */
function getClinicReason(row: SessionScoreRow): { target: boolean; reason: string } {
  if (!row.clinic_required) return { target: false, reason: "" };
  const examFail = row.exams?.some((e) => e.block.passed === false) ?? false;
  const hwFail =
    row.homeworks?.some((h) => {
      const st = getHomeworkStatus({
        score: h.block.score,
        metaStatus: (h.block.meta?.status ?? null) as import("../utils/homeworkStatus").HomeworkMetaStatus,
      });
      return st === "NOT_SUBMITTED" || h.block.passed === false;
    }) ?? false;
  if (examFail && hwFail) return { target: true, reason: "시험+과제" };
  if (examFail) return { target: true, reason: "시험" };
  if (hwFail) return { target: true, reason: "과제" };
  return { target: true, reason: "대상" };
}

export type ScoreColumnDef =
  | { type: "name"; key: "name"; width: number; editable: false }
  | { type: "attendance"; key: "attendance"; width: number; editable: false }
  | {
      type: "exam";
      examId: number;
      questionId?: number;
      title: string;
      sub: "total" | "objective" | "subjective" | "item";
      key: string;
      width: number;
      editable: boolean;
    }
  | {
      type: "homework";
      homeworkId: number;
      title: string;
      sub: "score";
      key: string;
      width: number;
      editable: boolean;
    }
  | { type: "exam_summary"; sub: "score"; key: string; width: number; editable: false }
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
  /** 점수 표시 형식: raw(원점수) | fraction(50/100) */
  scoreFormat?: "raw" | "fraction";
  /** 뷰 필터: 시험만/과제만/전체 */
  viewFilter?: "all" | "exam" | "homework";

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

  /** 컬럼 순서 변경 — 시험/과제 헤더 드래그앤드롭 (display_order patch).
   *  2026-05-13 학원장 결정: ◀▶ 버튼 폐기, drag-drop SSOT. fromId 를 toId 위치로 삽입. */
  onReorderColumnSwap?: (type: "exam" | "homework", fromId: number, toId: number) => void;

};

const ScoresTable = forwardRef<ScoresTableHandle, Props>(function ScoresTable({
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
  scoreFormat = "raw",
  viewFilter = "all",
  selectedEnrollmentId,
  selectedCell = null,
  onSelectCell,
  onSelectRow,
  onReorderColumnSwap,
  onRequestMoveNext,
  onRequestMovePrev,
  onRequestMoveDown,
  onRequestMoveUp,
  selectedEnrollmentIds = [],
  onSelectionChange,
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
    const failed: PendingChange[] = [];
    for (const p of list) {
      try {
        if (p.type === "examTotal") {
          await patchExamTotalScoreQuick({ examId: p.examId, enrollmentId: p.enrollmentId, score: p.score, maxScore: p.maxScore ?? 100, metaStatus: p.metaStatus ?? undefined });
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
        failed.push(p);
      }
    }
    // 실패한 항목은 pending에 복원하여 다음 flush에서 재시도
    for (const p of failed) {
      const key = pendingKeyForChange(p);
      pendingRef.current.set(key, p);
      dirtyKeysRef.current.add(key);
    }
    qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
    qc.invalidateQueries({ queryKey: ["clinic-targets"] });
    qc.invalidateQueries({ queryKey: ["admin-exam-results"] });
    const successCount = list.length - failed.length;
    if (failed.length > 0) {
      feedback.error(`${failed.length}건의 점수 저장에 실패했습니다. 다시 저장해 주세요.`);
    } else if (successCount > 0) {
      feedback.success(`${successCount}건의 점수가 저장되었습니다.`);
    }
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
        if (el) el.innerText = p.metaStatus === "NOT_SUBMITTED" ? "미응시" : String(Math.round(p.score));
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

  const examOptions = useMemo(
    () => (viewFilter === "homework" ? [] : (meta?.exams ?? [])),
    [viewFilter, meta?.exams],
  );
  const homeworkOptions = useMemo(
    () => (viewFilter === "exam" ? [] : (meta?.homeworks ?? [])),
    [viewFilter, meta?.homeworks],
  );

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
        const metaStatus = entry?.block?.meta?.status;
        if (metaStatus === "NOT_SUBMITTED") {
          el.innerText = "미응시";
        } else {
          const score = entry?.block?.score;
          el.innerText = score != null ? String(Math.round(score)) : "";
        }
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

  /**
   * 컬럼 구조는 모드와 무관하게 항상 동일.
   * scoreDisplayMode로 표시 형태만 결정, isEditMode로 editable 플래그만 결정.
   * → 모드 전환 시 테이블 레이아웃 안 흔들림.
   */
  const columns = useMemo((): ScoreColumnDef[] => {
    const list: ScoreColumnDef[] = [
      { type: "name", key: "name", width: COL_NAME, editable: false },
      { type: "attendance", key: "attendance", width: COL_ATTENDANCE, editable: false },
    ];
    examOptions.forEach((e) => {
      if (scoreDisplayMode === "total") {
        list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "total", key: `exam_${e.exam_id}_total`, width: COL_SCORE, editable: isEditMode && examEditTotal });
      } else {
        list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "objective", key: `exam_${e.exam_id}_objective`, width: COL_SCORE, editable: isEditMode && examEditObjective });
        list.push({ type: "exam", examId: e.exam_id, title: e.title, sub: "subjective", key: `exam_${e.exam_id}_subjective`, width: COL_SCORE, editable: isEditMode && examEditSubjective });
      }
    });
    if (examOptions.length > 1) {
      // 합불(exam_summary_pass) 컬럼 제거(2026-05-12) — 학원장 피드백 "셀이 안 보인다" + "합불 셀 제거하고 색상으로 구분".
      // 점수 셀 자체에 data-pass-status로 합격=녹/불합=적 색상 + 테두리 강조(table.css)로 즉시 식별.
      list.push(
        { type: "exam_summary", sub: "score", key: "exam_summary_score", width: 96, editable: false },
      );
    }
    homeworkOptions.forEach((h) => {
      list.push(
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "score", key: `hw_${h.homework_id}_score`, width: COL_SCORE, editable: isEditMode && homeworkEdit },
      );
    });
    // P1-2 (2026-05-13): clinic_reason 컬럼 제거 — 판정 셀 안에 사유를 함께 표시.
    list.push(
      { type: "clinic_target", key: "clinic_target", width: COL_CLINIC_TARGET, editable: false }
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
        minWidth: c.key === "name" ? 100 : c.key === "clinic_target" ? 80 : 48,
        maxWidth: 500,
      })),
    ];
  }, [columns]);

  /* 2026-05-13 4차 Visual Polish: 컬럼 폭 default 추가 재조정.
     v3 bump → 기존 stale prefs (v2 학원장 환경에 박힌 큰 값) 무시. */
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("session-scores-v4", columnDefs);

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
    <div>
      {/* 편집 모드 안내 배너 — SSOT 클래스(2026-05-13 3차).
          인라인 style + raw text-xs 제거. table.css 의 .scores-edit-help-banner 단일 소스. */}
      {isEditMode && (
        <div className="scores-edit-help-banner" role="note">
          <span className="scores-edit-help-banner__accent">편집 모드</span>
          <span className="scores-edit-help-banner__sep">|</span>
          <span>점수 입력 후 <kbd className="score-help-kbd">Enter</kbd> 저장</span>
          <span className="scores-edit-help-banner__sep">·</span>
          <span>
            <kbd className="score-help-kbd">/</kbd> 입력 후 <kbd className="score-help-kbd">Enter</kbd>
            <span className="scores-edit-help-banner__muted"> = 미응시/미제출 처리</span>
          </span>
          <span className="scores-edit-help-banner__sep">·</span>
          <span className="scores-edit-help-banner__muted">
            <kbd className="score-help-kbd">Tab</kbd> 다음 셀 <kbd className="score-help-kbd">Esc</kbd> 취소
          </span>
        </div>
      )}
      {/* P0-2 (2026-05-13): 테이블 위 absolute OMR 미니버튼 제거.
          학원장 캡처에서 헤더 위 "+OMR +OMR" 줄이 시각 노이즈 + 툴바 OMR 버튼과 중복.
          OMR 업로드는 툴바 우측 OMR 버튼 (시험 1개면 직진, 2+개면 드롭다운) 단일 경로. */}
    <DomainTable
      tableClassName="ds-table--flat ds-table--center ds-scores-table"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
      dataAttributes={isEditMode ? { "data-edit-mode": "true" } : undefined}
    >
      <colgroup>
        {tableCols.map((w, i) => (
          // eslint-disable-next-line no-restricted-syntax
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>

      <thead>
        {/* Row1: 선택 | 이름 | 출석 | [시험 뱃지] 시험이름 | [과제 뱃지] 과제이름 | 클리닉 | 사유 */}
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
            className="text-center font-semibold text-[var(--color-text-primary)]"
            data-col-type="name"
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
            className="text-center font-semibold text-[var(--color-text-primary)]"
            data-col-type="attendance"
          >
            출석
          </ResizableTh>
          {examOptions.map((ex, exIdx) => {
            const examColsList = examColsMap[ex.exam_id] ?? [];
            const colSpan = examColsList.length || 1;
            /* 단일 sub(합산)만 있을 때는 sub-row를 비우고 시험 헤더에 rowSpan=2 부여.
               "합산" 라벨 N번 반복 = 정보 노이즈 제거.
               + 단일 sub 시 시험 헤더 자체를 ResizableTh로 — 직전엔 plain th 라 학원장이 드래그 폭 조절 못 했음.
               다중 sub 시는 row2 sub-cell의 ResizableTh로 개별 조절 (기존 그대로). */
            const singleSub = colSpan === 1;
            const totalCol = examColsList.find((c) => c.sub === "total");
            const groupParity = exIdx % 2 === 0 ? "even" : "odd";
            /* 2026-05-13 학원장 결정: ◀▶ 버튼 폐기 → 드래그앤드롭. grip cursor 로 affordance. */
            const headerInner = (
              <span
                className="scores-col-drag-handle inline-flex items-center gap-1 min-w-0 max-w-full"
                draggable={!!onReorderColumnSwap}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/x-academy-col", `exam:${ex.exam_id}`);
                }}
                onDragOver={(e) => {
                  const payload = e.dataTransfer.types.includes("text/x-academy-col");
                  if (payload) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; (e.currentTarget as HTMLElement).classList.add("scores-col-drag-over"); }
                }}
                onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove("scores-col-drag-over"); }}
                onDrop={(e) => {
                  (e.currentTarget as HTMLElement).classList.remove("scores-col-drag-over");
                  const raw = e.dataTransfer.getData("text/x-academy-col");
                  const [t, idStr] = (raw ?? "").split(":");
                  if (t === "exam" && idStr) {
                    e.preventDefault();
                    const fromId = Number(idStr);
                    if (Number.isFinite(fromId) && fromId !== ex.exam_id) {
                      onReorderColumnSwap?.("exam", fromId, ex.exam_id);
                    }
                  }
                }}
                title={onReorderColumnSwap ? `${ex.title} — 끌어서 순서 변경` : ex.title}
              >
                <Badge variant="solid" tone="primary" oneChar ariaLabel="시험">시</Badge>
                <span className="whitespace-normal break-keep min-w-0 leading-tight">{ex.title}</span>
                <span className="ds-col-action-btn shrink-0">
                  <ExamHeaderQuickEdit
                    examId={ex.exam_id}
                    examTitle={ex.title}
                    initialMaxScore={ex.max_score}
                    initialPassScore={ex.pass_score}
                    sessionId={sessionId}
                  />
                </span>
              </span>
            );
            const headerClass = "group text-center font-medium text-[var(--color-text-primary)] align-middle";
            const headerDataAttrs = { "data-col-type": "score", "data-group-start": "", "data-group-parity": groupParity };
            /* 단일 sub: ResizableTh로 폭 조절 가능 (totalCol.key 와 동기화).
               다중 sub: row2 sub-cell ResizableTh가 폭 조절 — row1은 colSpan 묶음. */
            if (singleSub && totalCol) {
              return (
                <ResizableTh
                  key={`head-exam-${ex.exam_id}`}
                  columnKey={totalCol.key}
                  width={columnWidths[totalCol.key] ?? COL_SCORE}
                  minWidth={64}
                  maxWidth={320}
                  onWidthChange={setColumnWidth}
                  rowSpan={2}
                  className={headerClass}
                  title={ex.title}
                  dataAttributes={headerDataAttrs}
                >
                  {headerInner}
                </ResizableTh>
              );
            }
            return (
              <th
                key={`head-exam-${ex.exam_id}`}
                scope="col"
                colSpan={colSpan}
                className={headerClass}
                title={ex.title}
                {...headerDataAttrs}
              >
                {headerInner}
              </th>
            );
          })}
          {examOptions.length > 1 && (
            <th
              scope="col"
              rowSpan={2}
              className="text-center font-medium text-[var(--color-text-primary)]"
              data-col-type="exam-summary"
              data-summary-start=""
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Badge variant="solid" tone="primary" oneChar ariaLabel="총점">Σ</Badge>
                <span>총점</span>
              </span>
            </th>
          )}
          {homeworkOptions.map((hw, idx) => (
            <ResizableTh
              key={`head-hw-${hw.homework_id}`}
              columnKey={`hw_${hw.homework_id}_score`}
              width={columnWidths[`hw_${hw.homework_id}_score`] ?? COL_SCORE}
              minWidth={64}
              maxWidth={240}
              onWidthChange={setColumnWidth}
              rowSpan={2}
              /* 2026-05-13 2차 (P0-A): 과제 헤더도 wrap 허용 — 과제명 길어도 줄바꿈으로 보존. */
              className="group text-center font-medium text-[var(--color-text-primary)] align-middle"
              data-col-type="score"
              {...(idx === 0 ? { "data-section-start": "" } : {})}
              data-group-parity={idx % 2 === 0 ? "even" : "odd"}
            >
              <span
                className="scores-col-drag-handle inline-flex items-center gap-1 min-w-0 max-w-full"
                draggable={!!onReorderColumnSwap}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/x-academy-col", `homework:${hw.homework_id}`);
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("text/x-academy-col")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    (e.currentTarget as HTMLElement).classList.add("scores-col-drag-over");
                  }
                }}
                onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove("scores-col-drag-over"); }}
                onDrop={(e) => {
                  (e.currentTarget as HTMLElement).classList.remove("scores-col-drag-over");
                  const raw = e.dataTransfer.getData("text/x-academy-col");
                  const [t, idStr] = (raw ?? "").split(":");
                  if (t === "homework" && idStr) {
                    e.preventDefault();
                    const fromId = Number(idStr);
                    if (Number.isFinite(fromId) && fromId !== hw.homework_id) {
                      onReorderColumnSwap?.("homework", fromId, hw.homework_id);
                    }
                  }
                }}
                title={onReorderColumnSwap ? `${hw.title} — 끌어서 순서 변경` : hw.title}
              >
                <Badge variant="solid" tone="complement" oneChar ariaLabel="과제">과</Badge>
                <span className="whitespace-normal break-keep min-w-0 leading-tight">{hw.title}</span>
              </span>
            </ResizableTh>
          ))}
          {/* P1-2 (2026-05-13): 판정 + 사유 컬럼 통합. 한 셀에 뱃지 + 사유 줄바꿈으로 표시. */}
          <ResizableTh
            columnKey="clinic_target"
            width={columnWidths.clinic_target ?? COL_CLINIC_TARGET}
            minWidth={72}
            maxWidth={160}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-center font-semibold text-[var(--color-text-primary)]"
            data-col-type="clinic"
            data-verdict-start=""
          >
            판정
          </ResizableTh>
        </tr>
        {/* Row2: 시험별 서브헤더(합산/객관식/주관식/N번/합불) | 과제 점수/합불.
         * 2026-05-12: 학원장 임근혁 요청 — "시험끼리 행 넓이 조절도 안 됨" → ResizableTh로 wrapping
         * → 우측 끝 드래그 핸들로 학원장이 직접 너비 조절 가능. */}
        <tr className="border-b-2 border-[var(--color-border-divider)]">
          {examOptions.map((ex, exIdx) => {
            const examColsList = (examColsMap[ex.exam_id] ?? []) as Extract<ScoreColumnDef, { type: "exam" }>[];
            const questions = (ex as { questions?: { question_id: number; number: number }[] }).questions ?? [];
            const parity = exIdx % 2 === 0 ? "even" : "odd";
            /* 단일 sub(합산)만 있을 땐 row1 th 가 rowSpan=2 이라 row2 자리 차지 X. */
            if (examColsList.length <= 1) return null;
            return (
              <Fragment key={ex.exam_id}>
                {examColsList.map((c, ci) => (
                  <ResizableTh
                    key={c.key}
                    columnKey={c.key}
                    width={columnWidths[c.key] ?? COL_SCORE}
                    minWidth={64}
                    maxWidth={240}
                    onWidthChange={setColumnWidth}
                    className="text-center text-xs font-medium text-[var(--color-text-secondary)]"
                    data-col-type="score"
                    {...(ci === 0 ? { "data-group-start": "" } : {})}
                    data-group-parity={parity}
                  >
                    {c.sub === "total" ? "합산" : c.sub === "objective" ? "객관식" : c.sub === "subjective" ? "주관식" : c.sub === "item" && c.questionId != null
                      ? `${questions.find((q) => q.question_id === c.questionId)?.number ?? c.questionId}번`
                      : "합불"}
                  </ResizableTh>
                ))}
              </Fragment>
            );
          })}
          {/* 총점 헤더는 Row1에서 rowSpan=2 처리 (2026-05-12: 합불 컬럼 제거로 colSpan=2 → rowSpan=2 변경) */}
          {/* 과제 헤더도 Row1에서 rowSpan=2 처리 */}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, rowIndex) => {
          const selected = selectedEnrollmentId === row.enrollment_id;
          const rowChecked = selectedSet.has(row.enrollment_id);
          const { reason: clinicReason } = getClinicReason(row);
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
                  className="ds-checkbox-cell align-middle border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)]"
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
                          onSelectionChange(selectedEnrollmentIds.filter((enrollmentId) => enrollmentId !== row.enrollment_id));
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
                  className="ds-text-name min-w-0 text-[var(--color-text-primary)] align-middle"
                  data-col-type="name"
                  onClick={() => onSelectRow(row)}
                >
                  {/* 성적표 전용: 학생명 우선, 강의는 아래 보조 메타로 낮춰 표 가독성 확보.
                      아바타도 SSOT 동일: 사진 없으면 이니셜 표시 (다른 30+ 화면과 정합).
                      lectures: 단일 강의 → [{...}] 배열로 어댑트 (백엔드 row.lecture_* SSOT 그대로). */}
                  <StudentNameWithLectureChip
                    name={row.student_name ?? ""}
                    profilePhotoUrl={row.profile_photo_url ?? undefined}
                    avatarSize={28}
                    layout="stacked"
                    lectureDisplay="meta"
                    lectures={
                      row.lecture_title
                        ? [{
                            lectureName: row.lecture_title,
                            color: row.lecture_color ?? undefined,
                            chipLabel: row.lecture_chip_label ?? undefined,
                          }]
                        : null
                    }
                    clinicHighlight={row.name_highlight_clinic_target === true}
                  />
                </td>

                <td className="text-center align-middle" data-col-type="attendance">
                  {(() => {
                    const status = attendanceMap[row.enrollment_id];
                    if (!status) return <span className="text-[var(--color-text-muted)]">-</span>;
                    // SSOT (2026-05-13 3차): 출석 표시는 AttendanceStatusBadge 단일 컴포넌트.
                    // 직전 인라인 style 색·라벨 매핑은 ds-status-badge 토큰과 drift 우려 → 제거.
                    return (
                      <AttendanceStatusBadge
                        status={status as Parameters<typeof AttendanceStatusBadge>[0]["status"]}
                        variant="2ch"
                      />
                    );
                  })()}
                </td>

                {/* 시험: 컬럼 정의에 따라 합산/객관식/주관식/문항별/합불 */}
                {examOptions.map((ex, exIdx) => {
                  const entry = row.exams?.find((e) => e.exam_id === ex.exam_id) ?? null;
                  const block = entry?.block;
                  const questions = (ex as { questions?: { question_id: number; number: number; max_score: number }[] }).questions ?? [];
                  const examColsList = (examColsMap[ex.exam_id] ?? []) as Extract<ScoreColumnDef, { type: "exam" }>[];
                  const notEnrolledForExam = !entry;
                  const groupParity = exIdx % 2 === 0 ? "even" : "odd";
                  return (
                    <Fragment key={ex.exam_id}>
                      {examColsList.map((col, colIdx) => {
                        // 시험 대상 미등록 → 회색 비활성 셀.
                        // P1-7 (2026-05-13): hover tooltip 추가 — 학원장이 "왜 입력 안 되지" 헷갈림 방지.
                        if (notEnrolledForExam) {
                          return (
                            <td
                              key={col.key}
                              className="min-w-0 align-middle bg-[var(--color-bg-surface-hover)]"
                              data-col-type="score"
                              {...(colIdx === 0 ? { "data-group-start": "" } : {})}
                              data-group-parity={groupParity}
                              title={`${ex.title} 응시 대상 미등록 — 상단 "수강생 일괄배정" 으로 추가하세요`}
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

                        if (col.sub === "total") {
                          const examMaxScore = block?.max_score ?? ex.max_score ?? null;
                          const isExamNotSubmitted = block?.meta?.status === "NOT_SUBMITTED";
                          const scoreText = isExamNotSubmitted ? "미응시" : block?.score == null ? "-" : scoreFormat === "fraction" && examMaxScore != null ? `${Math.round(block.score)}/${examMaxScore}` : `${Math.round(block.score)}`;
                          const hasRetakes = (entry?.attempt_count ?? 0) >= 2;
                          const hasClinicLink = entry?.clinic_link_id != null;
                          const canEdit = isEditMode && examEditTotal && !block?.is_locked && !hasRetakes;
                          /* 2026-05-13 학원장 결정: 학생별 상태 = 진행중/이수/판정 — 클리닉 1차/2차/3차 정합.
                             셀 hover 시 tooltip 으로 노출. */
                          const achLabel = achievementLabel(block);
                          const cellTitle = `${ex.title} · ${scoreText} · ${achLabel}`;
                          return (
                            <td
                              key={col.key}
                              data-col-type="score"
                              data-group-parity={groupParity}
                              {...(colIdx === 0 ? { "data-group-start": "" } : {})}
                              {...(canEdit ? { "data-editable": "true" } : {})}
                              {...(block?.passed != null ? { "data-pass-status": block.passed ? "pass" : "fail" } : {})}
                              {...(block?.achievement ? { "data-achievement": block.achievement } : isExamNotSubmitted ? { "data-achievement": "NOT_SUBMITTED" } : {})}
                              className={`min-w-0 text-center align-middle ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                              title={cellTitle}
                              onClick={(e) => { if (isEditMode) e.stopPropagation(); onSelectCell(row, "exam", ex.exam_id, "total"); }}
                            >
                              {canEdit ? (
                                <span
                                  ref={(el) => {
                                    const k = `${row.enrollment_id}-${ex.exam_id}`;
                                    examInputRefs.current[k] = el;
                                    if (el && el !== document.activeElement && !dirtyKeysRef.current.has(`examTotal:${row.enrollment_id}:${ex.exam_id}`)) {
                                      if (isExamNotSubmitted) el.innerText = "미응시";
                                      else el.innerText = block?.score != null ? String(Math.round(block.score)) : "";
                                    }
                                  }}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className={`ds-scores-cell-editable font-medium text-center tabular-nums text-sm outline-none inline-block w-full min-w-0 ${isExamNotSubmitted ? "text-[var(--color-text-muted)]" : ""}`}
                                  onFocus={(e) => {
                                    const el = e.currentTarget;
                                    examScoreValueOnFocusRef.current[`${row.enrollment_id}-${ex.exam_id}`] = isExamNotSubmitted ? "미응시" : (block?.score != null ? String(Math.round(block.score)) : "");
                                    requestAnimationFrame(() => selectAllScoreCell(el));
                                  }}
                                  onBlur={async () => {
                                    const el = examInputRefs.current[`${row.enrollment_id}-${ex.exam_id}`];
                                    if (!el) return;
                                    const raw = firstLine(el.innerText);
                                    const cellKey = `examTotal:${row.enrollment_id}:${ex.exam_id}`;
                                    // "/" or "미응시" → NOT_SUBMITTED
                                    if (raw === "/" || raw === "미응시") {
                                      el.innerText = "미응시";
                                      pendingRef.current.set(cellKey, { type: "examTotal", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: 0, metaStatus: "NOT_SUBMITTED" });
                                      dirtyKeysRef.current.add(cellKey);
                                      return;
                                    }
                                    const metaMax = block?.max_score ?? ex.max_score ?? 100;
                                    const parsed = parseScoreInput(raw, metaMax);
                                    if (parsed != null && validateScore(parsed, metaMax)) {
                                      pendingRef.current.set(cellKey, { type: "examTotal", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed, maxScore: metaMax });
                                      dirtyKeysRef.current.add(cellKey);
                                    } else if (raw !== "") el.innerText = isExamNotSubmitted ? "미응시" : (block?.score != null ? String(Math.round(block.score)) : "");
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
                                      const raw = el?.innerText?.trim() ?? "";
                                      // "/" + Enter → 미응시
                                      if (raw === "/") {
                                        if (el) el.innerText = "미응시";
                                        const cellKey = `examTotal:${row.enrollment_id}:${ex.exam_id}`;
                                        pendingRef.current.set(cellKey, { type: "examTotal", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: 0, metaStatus: "NOT_SUBMITTED" });
                                        dirtyKeysRef.current.add(cellKey);
                                      } else if (raw === "미응시") {
                                        const cellKey = `examTotal:${row.enrollment_id}:${ex.exam_id}`;
                                        pendingRef.current.set(cellKey, { type: "examTotal", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: 0, metaStatus: "NOT_SUBMITTED" });
                                        dirtyKeysRef.current.add(cellKey);
                                      } else {
                                        // 숫자 입력 → 점수 저장
                                        const metaMax = block?.max_score ?? ex.max_score ?? 100;
                                        const parsed = parseScoreInput(raw, metaMax);
                                        if (parsed != null && validateScore(parsed, metaMax)) {
                                          const cellKey = `examTotal:${row.enrollment_id}:${ex.exam_id}`;
                                          pendingRef.current.set(cellKey, { type: "examTotal", examId: ex.exam_id, enrollmentId: row.enrollment_id, score: parsed, maxScore: metaMax });
                                          dirtyKeysRef.current.add(cellKey);
                                        }
                                      }
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
                              ) : isEditMode && hasRetakes ? (
                                <div className="ds-cell-attempt-info" title="재시험 이력이 있습니다. 학생을 클릭하여 드로어에서 편집하세요.">
                                  <span className="ds-cell-score-locked">{scoreText}</span>
                                  <span className="ds-cell-retake-badge">{entry?.attempt_count}차 시도</span>
                                </div>
                              ) : (
                                <span className={`font-medium ${isExamNotSubmitted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}>{scoreText}</span>
                              )}
                              {isEditMode && hasClinicLink && !hasRetakes && block?.passed === false && (
                                <div
                                  className="ds-cell-add-retake"
                                  onClick={(e) => { e.stopPropagation(); onSelectRow(row); }}
                                  title="드로어에서 재시험 추가"
                                >
                                  +{(entry?.attempt_count ?? 0) + 1}차
                                </div>
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
                              data-col-type="score"
                              data-group-parity={groupParity}
                              {...(colIdx === 0 ? { "data-group-start": "" } : {})}
                              {...(block?.passed != null ? { "data-pass-status": block.passed ? "pass" : "fail" } : {})}
                              className={`min-w-0 text-center align-middle ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
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
                                    const metaMax = block?.max_score ?? ex.max_score ?? 100;
                                    const parsed = parseScoreInput(raw, metaMax);
                                    if (parsed != null && validateScore(parsed, metaMax)) {
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
                              data-col-type="score"
                              data-group-parity={groupParity}
                              {...(colIdx === 0 ? { "data-group-start": "" } : {})}
                              {...(block?.passed != null ? { "data-pass-status": block.passed ? "pass" : "fail" } : {})}
                              className={`min-w-0 text-center align-middle ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
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
                                    const metaMax = block?.max_score ?? ex.max_score ?? 100;
                                    const parsed = parseScoreInput(raw, metaMax);
                                    if (parsed != null && validateScore(parsed, metaMax)) {
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
                              data-col-type="score"
                              data-group-parity={groupParity}
                              {...(colIdx === 0 ? { "data-group-start": "" } : {})}
                              {...(canEdit ? { "data-editable": "true" } : {})}
                              className={`min-w-0 text-center align-middle ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""}`}
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

                {/* 시험 총점 요약 — 시험 2개 이상일 때만 표시 */}
                {examOptions.length > 1 && (() => {
                  let totalScore = 0;
                  let totalMaxScore = 0;
                  let hasAnyScore = false;
                  let allPassed: boolean | null = null; // null = no data
                  for (const ex of examOptions) {
                    const entry = row.exams?.find((e) => e.exam_id === ex.exam_id);
                    if (!entry) continue;
                    const block = entry.block;
                    if (block?.score != null) {
                      hasAnyScore = true;
                      totalScore += Math.round(block.score);
                      totalMaxScore += block.max_score ?? ex.max_score ?? 100;
                    }
                    if (block?.passed != null) {
                      if (allPassed === null) allPassed = block.passed;
                      else if (!block.passed) allPassed = false;
                    }
                  }
                  return (
                    <td
                      className="min-w-0 text-center align-middle"
                      data-col-type="exam-summary"
                      data-summary-start=""
                      data-summary=""
                      {...(allPassed != null ? { "data-pass-status": allPassed ? "pass" : "fail" } : {})}
                    >
                      <span className="font-bold text-[var(--color-text-primary)] tabular-nums">
                        {hasAnyScore ? `${totalScore}/${totalMaxScore}` : "-"}
                      </span>
                    </td>
                  );
                })()}

                {/* 과제: 점수(점수만) | 합불 — canEditScore이면 block 없어도 입력 셀 표시 */}
                {homeworkOptions.map((hw, hwBodyIdx) => {
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
                  const hwParity = hwBodyIdx % 2 === 0 ? "even" : "odd";

                  // border는 CSS data-section-start로 처리
                  return (
                    <Fragment key={hw.homework_id}>
                      {notEnrolledForHw ? (
                          <td
                            className={`min-w-0 align-middle bg-[var(--color-bg-surface-hover)]`}
                            data-col-type="score"
                            data-group-parity={hwParity}
                            {...(hwBodyIdx === 0 ? { "data-section-start": "" } : {})}
                            title={`${hw.title} 제출 대상 미등록 — 상단 "수강생 일괄배정" 으로 추가하세요`}
                          >
                            <span className="text-[var(--color-text-muted)] select-none">-</span>
                          </td>
                      ) : (
                      <td
                        className={`min-w-0 text-center align-middle ${isSelected ? "ds-scores-cell-active" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                        data-col-type="score"
                        data-group-parity={hwParity}
                        {...(hwBodyIdx === 0 ? { "data-section-start": "" } : {})}
                        {...(canEditScore ? { "data-editable": "true" } : {})}
                        {...(isNotSubmitted
                          ? { "data-achievement": "NOT_SUBMITTED" }
                          : block?.passed != null
                            ? { "data-pass-status": block.passed ? "pass" : "fail" }
                            : {})}
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
                              // eslint-disable-next-line no-restricted-syntax
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
                              {isNotSubmitted ? "미제출" : (block?.score != null ? (scoreFormat === "fraction" && (block.max_score ?? hw.max_score) != null ? `${block.score}/${block.max_score ?? hw.max_score}` : `${block.score}`) : "-")}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">-</span>
                          )}
                        </span>
                      </td>
                      )}
                    </Fragment>
                  );
                })}

                {/* P1-2 (2026-05-13): 판정 + 사유 통합 셀.
                    이전엔 두 컬럼 ("대상" 뱃지 + "대상" 텍스트 중복) → 한 셀에 뱃지 + 사유 줄바꿈. */}
                <td
                  className="text-center align-middle"
                  data-col-type="clinic"
                  data-verdict-start=""
                >
                  {(() => {
                    const verdict = getSessionScoresTableVerdict(row);
                    if (verdict === "dash") {
                      return <span className="text-[var(--color-text-muted)]" title="시험·과제 없음">-</span>;
                    }
                    let badge: React.ReactNode = null;
                    if (verdict === "clinic_target") {
                      badge = (
                        <span className="ds-scores-pass-fail-badge" data-tone="warning" title="클리닉 미해소 대상">
                          대상
                        </span>
                      );
                    } else if (verdict === "fail") {
                      badge = (
                        <span className="ds-scores-pass-fail-badge" data-tone="danger" title="커트라인 미만 항목 있음">
                          불합
                        </span>
                      );
                    } else {
                      badge = (
                        <span className="ds-scores-pass-fail-badge" data-tone="success" title="전 항목 커트라인 이상">
                          합격
                        </span>
                      );
                    }
                    return (
                      <div className="inline-flex flex-col items-center gap-0.5 leading-tight">
                        {badge}
                        {clinicReason && (
                          <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                            {clinicReason}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>

            </Fragment>
          );
        })}
      </tbody>
    </DomainTable>
    </div>
  );
});

export default ScoresTable;
