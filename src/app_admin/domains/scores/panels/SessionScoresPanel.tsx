// PATH: src/app_admin/domains/scores/panels/SessionScoresPanel.tsx
// 성적 테이블 — 엑셀형 키보드 이동 (Tab/화살표), 입력은 테이블 셀에서만
// 편집 종료 시 한 번에 저장(flushPendingChanges)

import { useEffect, useMemo, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchSessionScores,
  type SessionScoreRow,
  type SessionScoreMeta,
} from "../api/sessionScores";
import { scoresQueryKeys } from "../api/queryKeys";
import { fetchAttendance, updateAttendance } from "@admin/domains/lectures/api/attendance";

import ScoresTable, { type ScoresTableHandle } from "../components/ScoresTable";
import StudentScoresDrawer from "../components/StudentScoresDrawer";
import StudentResultDrawer from "@admin/domains/results/components/StudentResultDrawer";
import { EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { reorderSession } from "../api/reorderSession";

/** P0-5 (2026-05-13): 도움 안내 카드 dismiss 키. 학원장(브라우저)별 영속. */
const HELP_DISMISS_KEY = "scores-tab-help-dismissed-v1";
const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const HANGUL_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function normalizeStudentSearch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function toHangulInitials(value: string): string {
  return Array.from(value).map((char) => {
    const code = char.charCodeAt(0);
    if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return char;
    return HANGUL_INITIALS[Math.floor((code - HANGUL_SYLLABLE_START) / 588)] ?? char;
  }).join("");
}

function matchesStudentSearch(studentName: string, rawQuery: string): boolean {
  const query = normalizeStudentSearch(rawQuery);
  if (!query) return true;
  const name = normalizeStudentSearch(studentName);
  const initials = normalizeStudentSearch(toHangulInitials(studentName));
  return name.includes(query) || initials.includes(query);
}

type Props = {
  sessionId: number;
  lectureId?: number;
  search?: string;
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
  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;
};

export type SessionScoresPanelHandle = {
  /** 편집 모드 종료 전 호출 — 대기 중인 점수 변경을 한 번에 저장 */
  flushPendingChanges: () => Promise<void>;
  /** 자동 저장용: 현재 pending 스냅샷 */
  getPendingSnapshot: () => import("../api/scoreDraft").PendingChange[];
  /** 드래프트 복원 시 호출 */
  applyDraftPatch: (changes: import("../api/scoreDraft").PendingChange[]) => void;
};

type ScoreCellRef =
  | { type: "exam"; examId: number; sub: "total" }
  | { type: "exam"; examId: number; sub: "objective" }
  | { type: "exam"; examId: number; sub: "item"; questionId: number }
  | { type: "exam"; examId: number; sub: "subjective" }
  | { type: "homework"; homeworkId: number };

const EMPTY_EXAM_COLS: SessionScoreMeta["exams"] = [];
const EMPTY_HOMEWORK_COLS: SessionScoreMeta["homeworks"] = [];

type FocusScoreCell = {
  enrollmentId: number;
} & ScoreCellRef;

export default forwardRef<SessionScoresPanelHandle, Props>(function SessionScoresPanel({
  sessionId,
  lectureId,
  search = "",
  isEditMode = false,
  examEditTotal = false,
  examEditObjective = false,
  examEditSubjective = false,
  homeworkEdit = false,
  scoreDisplayMode = "total",
  scoreFormat = "raw",
  viewFilter = "all",
  selectedEnrollmentIds = [],
  onSelectionChange,
}, ref) {
  const confirm = useConfirm();
  /** Direct DOM focus — no React state cycle needed */
  const tableRef = useRef<ScoresTableHandle>(null);
  const qc = useQueryClient();
  /** 읽기 모드 — 학생 상세 드로어 (이름 클릭) */
  const [drawerEnrollmentId, setDrawerEnrollmentId] = useState<number | null>(null);
  /** 답안 상세 드로어 (StudentScoresDrawer → 답안 상세 보기) */
  const [answerDetail, setAnswerDetail] = useState<{ examId: number; enrollmentId: number; examTitle: string } | null>(null);
  /** 도움 안내 dismiss 상태 (localStorage 영속).
   *  2026-05-13: default 를 dismissed(=collapsed) 로 변경 — 매번 strip 노출하던 시각 노이즈 해소.
   *  학원장이 "? 도움말" 버튼 클릭하면 펼쳐짐. 이전 "0" 또는 unset 인 사용자도 collapsed 시작. */
  const [helpDismissed, setHelpDismissed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(HELP_DISMISS_KEY);
      // "1" 명시 dismiss / "0" 명시 expanded / null = default-dismissed
      return v !== "0";
    } catch { return true; }
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: scoresQueryKeys.sessionScores(sessionId),
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const { data: attendanceList } = useQuery({
    queryKey: scoresQueryKeys.attendance(sessionId),
    queryFn: () => fetchAttendance(sessionId, { page_size: 500 }),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const allRows = useMemo<SessionScoreRow[]>(() => {
    const raw = data?.rows ?? [];
    // 시험·과제 둘 다 대상 등록이 안 된 학생은 성적탭에서 제외
    return raw.filter((r) => (r.exams?.length ?? 0) > 0 || (r.homeworks?.length ?? 0) > 0);
  }, [data]);
  const meta: SessionScoreMeta | null = data?.meta ?? null;

  /** 2026-05-13 학원장 결정: 컬럼 순서 변경 = 드래그앤드롭으로 전환.
   *  기존 ◀▶ 버튼 + direction("up"|"down") 시그니처 → fromId→toId 스왑 시그니처. */
  const handleReorderSwap = useCallback(async (type: "exam" | "homework", fromId: number, toId: number) => {
    if (!meta || fromId === toId) return;
    const list = type === "exam"
      ? meta.exams.map((e) => e.exam_id)
      : meta.homeworks.map((h) => h.homework_id);
    const fromIdx = list.indexOf(fromId);
    const toIdx = list.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    // from 을 빼고 to 위치에 다시 삽입 (drag-drop 자연 순서)
    const newList = [...list];
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);
    try {
      await reorderSession(sessionId, type === "exam" ? { exams: newList } : { homeworks: newList });
      void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
    } catch {
      feedback.error("순서 변경 실패");
    }
  }, [meta, sessionId, qc]);

  useImperativeHandle(ref, () => ({
    flushPendingChanges: () => tableRef.current?.flushPendingChanges?.() ?? Promise.resolve(),
    getPendingSnapshot: () => tableRef.current?.getPendingSnapshot?.() ?? [],
    applyDraftPatch: (changes) => tableRef.current?.applyDraftPatch?.(changes),
  }), []);

  const attendanceMap = useMemo(() => {
    const list = attendanceList?.data ?? [];
    const map: Record<number, string> = {};
    for (const a of list) {
      const item = a as { enrollment_id?: number; enrollment?: number; status?: string };
      const eid = item?.enrollment_id ?? item?.enrollment;
      if (eid != null && item?.status) map[Number(eid)] = String(item.status);
    }
    return map;
  }, [attendanceList]);

  /** enrollment_id → attendance record id (for PATCH API) */
  const attendanceIdMap = useMemo(() => {
    const list = attendanceList?.data ?? [];
    const map: Record<number, number> = {};
    for (const a of list) {
      const item = a as { enrollment_id?: number; enrollment?: number; id?: number };
      const eid = item?.enrollment_id ?? item?.enrollment;
      if (eid != null && item?.id != null) map[Number(eid)] = Number(item.id);
    }
    return map;
  }, [attendanceList]);

  const handleAttendanceChange = useCallback(async (enrollmentId: number, newStatus: string) => {
    const attendanceRecordId = attendanceIdMap[enrollmentId];
    if (!attendanceRecordId) return;
    if (newStatus === "SECESSION") {
      const secOk = await confirm({
        title: "확인",
        message: "퇴원 처리하시겠습니까?\n\n• 수강등록이 비활성화됩니다\n• 시험/과제 응시 대상에서 제외됩니다\n• 기존 데이터(성적·출결)는 보관됩니다",
        danger: true,
        confirmText: "확인",
      });
      if (!secOk) return;
    }
    try {
      await updateAttendance(attendanceRecordId, { status: newStatus });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.attendance(sessionId) });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
      if (newStatus === "SECESSION") {
        qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureId] });
        qc.invalidateQueries({ queryKey: ["session-enrollments", sessionId] });
        feedback.success("퇴원 처리되었습니다.");
      }
    } catch {
      feedback.error("출결 변경에 실패했습니다.");
    }
  }, [attendanceIdMap, confirm, qc, sessionId, lectureId]);

  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim();
    return allRows.filter((r) => matchesStudentSearch(r.student_name ?? "", q));
  }, [allRows, search]);

  // 드로어에 항상 최신 rows 데이터를 전달 (쿼리 갱신 시 자동 반영)
  const drawerRow = useMemo(
    () => (drawerEnrollmentId != null ? allRows.find((r) => r.enrollment_id === drawerEnrollmentId) ?? null : null),
    [allRows, drawerEnrollmentId],
  );

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(0); // editable columns index
  const prevEditModeRef = useRef(false);

  const examCols = meta?.exams ?? EMPTY_EXAM_COLS;
  const homeworkCols = meta?.homeworks ?? EMPTY_HOMEWORK_COLS;
  const editableCols = useMemo((): ScoreCellRef[] => {
    const list: ScoreCellRef[] = [];
    if (isEditMode) {
      examCols.forEach((e) => {
        if (examEditTotal) list.push({ type: "exam", examId: e.exam_id, sub: "total" });
        if (examEditObjective) list.push({ type: "exam", examId: e.exam_id, sub: "objective" });
        if (examEditSubjective) list.push({ type: "exam", examId: e.exam_id, sub: "subjective" });
      });
      if (homeworkEdit) homeworkCols.forEach((h) => list.push({ type: "homework", homeworkId: h.homework_id }));
    }
    return list;
  }, [examCols, homeworkCols, isEditMode, examEditTotal, examEditObjective, examEditSubjective, homeworkEdit]);

  const rowIndex = useMemo(() => {
    if (selectedEnrollmentId == null) return 0;
    const i = rows.findIndex((r) => r.enrollment_id === selectedEnrollmentId);
    return i >= 0 ? i : 0;
  }, [rows, selectedEnrollmentId]);

  const clampCol = useCallback((i: number) => {
    if (editableCols.length <= 0) return 0;
    return Math.max(0, Math.min(i, editableCols.length - 1));
  }, [editableCols.length]);

  const ensureSelection = useCallback(() => {
    if (!rows.length || editableCols.length === 0) return { r: 0, c: 0, ok: false as const };
    const r = Math.max(0, Math.min(rowIndex, rows.length - 1));
    const c = clampCol(selectedColIndex);
    return { r, c, ok: true as const };
  }, [rows.length, editableCols.length, rowIndex, clampCol, selectedColIndex]);

  const focusAt = useCallback((r: number, c: number) => {
    const row = rows[Math.max(0, Math.min(r, rows.length - 1))];
    const col = editableCols[clampCol(c)];
    if (!row || !col) return;
    setSelectedEnrollmentId(row.enrollment_id);
    setSelectedColIndex(clampCol(c));
    // Focus synchronously — no state→rerender→effect cycle
    tableRef.current?.imperativeFocusCell({ enrollmentId: row.enrollment_id, ...col } as Parameters<ScoresTableHandle["imperativeFocusCell"]>[0]);
  }, [rows, editableCols, clampCol]);

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditMode) return;
    const cur = ensureSelection();
    if (!cur.ok) return;

    const key = e.key;
    const isTab = key === "Tab";

    if (key === "ArrowDown" || key === "Enter") {
      e.preventDefault();
      focusAt(cur.r + 1, cur.c);
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      focusAt(cur.r - 1, cur.c);
      return;
    }
    if (key === "ArrowRight" || (isTab && !e.shiftKey)) {
      e.preventDefault();
      const nextC = cur.c + 1;
      if (nextC >= editableCols.length) focusAt(cur.r + 1, 0);
      else focusAt(cur.r, nextC);
      return;
    }
    if (key === "ArrowLeft" || (isTab && e.shiftKey)) {
      e.preventDefault();
      const prevC = cur.c - 1;
      if (prevC < 0) focusAt(cur.r - 1, editableCols.length - 1);
      else focusAt(cur.r, prevC);
      return;
    }
  };

  const onRequestMoveNext = useCallback(() => {
    const cur = ensureSelection();
    if (!cur.ok) return;
    const nextC = cur.c + 1;
    if (nextC >= editableCols.length) focusAt(cur.r + 1, 0);
    else focusAt(cur.r, nextC);
  }, [ensureSelection, editableCols.length, focusAt]);

  const onRequestMovePrev = useCallback(() => {
    const cur = ensureSelection();
    if (!cur.ok) return;
    const prevC = cur.c - 1;
    if (prevC < 0) focusAt(cur.r - 1, editableCols.length - 1);
    else focusAt(cur.r, prevC);
  }, [ensureSelection, editableCols.length, focusAt]);

  const onRequestMoveDown = useCallback(() => {
    const cur = ensureSelection();
    if (!cur.ok) return;
    focusAt(cur.r + 1, cur.c);
  }, [ensureSelection, focusAt]);

  const onRequestMoveUp = useCallback(() => {
    const cur = ensureSelection();
    if (!cur.ok) return;
    focusAt(cur.r - 1, cur.c);
  }, [ensureSelection, focusAt]);

  useEffect(() => {
    if (!isEditMode) {
      prevEditModeRef.current = false;
      setSelectedEnrollmentId(null);
      return;
    }
    // 편집 모드 진입 시에만 첫 점수 셀 자동 포커스
    const justEntered = !prevEditModeRef.current;
    prevEditModeRef.current = true;
    if (justEntered && rows.length > 0 && editableCols.length > 0) {
      const timer = setTimeout(() => {
        setSelectedColIndex(0);
        focusAt(0, 0);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isEditMode, rows, editableCols.length, focusAt]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedEnrollmentId(null);
      return;
    }

    if (!isEditMode) return;

    // 선택된 enrollment가 사라졌으면 첫 행으로
    if (selectedEnrollmentId == null) {
      setSelectedEnrollmentId(rows[0].enrollment_id);
      return;
    }
    const exists = rows.some((r) => r.enrollment_id === selectedEnrollmentId);
    if (!exists) {
      setSelectedEnrollmentId(rows[0].enrollment_id);
    }
    // colIndex clamp
    setSelectedColIndex((prev) => clampCol(prev));
  }, [rows, selectedEnrollmentId, isEditMode, clampCol]);

  /** Stable object — prevents ScoresTable from seeing a new prop reference every render */
  const selectedCell = useMemo(() => {
    if (selectedEnrollmentId == null) return null;
    const col = editableCols[clampCol(selectedColIndex)];
    return col ? ({ enrollmentId: selectedEnrollmentId, ...col } as FocusScoreCell) : null;
  }, [selectedEnrollmentId, selectedColIndex, editableCols, clampCol]);

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="성적을 불러오지 못했습니다"
        description="네트워크 연결을 확인하고 다시 시도해 주세요."
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-8 px-3 rounded text-sm font-medium border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
          >
            다시 시도
          </button>
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title={search.trim() ? "검색 결과가 없습니다" : "아직 등록된 수강생이 없어요"}
        description={search.trim()
          ? "다른 검색어로 시도해 보세요."
          : "이 세션에 수강생을 먼저 등록해주세요. 등록 후 자동으로 성적 입력표가 만들어집니다."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 도움 안내 — 읽기 모드 only, dismissible.
          P0-5 (2026-05-13): 매번 노출되던 ⓵⓶⓷⓸ 카드를 localStorage dismiss로 전환.
          한 번 보고 닫으면 같은 학원장 (브라우저)에서는 ?로 다시 펼치기 전까진 안 보임.
          편집 모드 안내는 ScoresTable 의 단일 안내로 통합 (P0-4). */}
      {!isEditMode && !helpDismissed && (
        <div className="scores-read-help-strip" role="note">
          <span className="scores-read-help-strip__key">⓵ 학생 행 클릭</span>
          <span>→ 상세 드로어</span>
          <span className="scores-read-help-strip__sep">|</span>
          <span className="scores-read-help-strip__key">⓶ 시험명 옆 ⚙</span>
          <span>→ 만점/커트라인 수정</span>
          <span className="scores-read-help-strip__sep">|</span>
          <span className="scores-read-help-strip__key">⓷ 헤더 드래그</span>
          <span>→ 컬럼 순서 변경</span>
          <span className="scores-read-help-strip__sep">|</span>
          <span className="scores-read-help-strip__key">⓸ 회색 "-"</span>
          <span>= 미등록 (수강생 일괄배정 필요)</span>
          <button
            type="button"
            className="scores-read-help-strip__close"
            onClick={() => {
              try { localStorage.setItem(HELP_DISMISS_KEY, "1"); } catch { /* ignore */ }
              setHelpDismissed(true);
            }}
            aria-label="도움말 닫기"
            title="다시 안 보기"
          >
            ✕
          </button>
        </div>
      )}
      {!isEditMode && helpDismissed && (
        <button
          type="button"
          className="self-start text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-surface-hover)]"
          onClick={() => {
            try { localStorage.setItem(HELP_DISMISS_KEY, "0"); } catch { /* ignore */ }
            setHelpDismissed(false);
          }}
          title="도움말 보기"
        >
          ? 도움말
        </button>
      )}
      <div
        tabIndex={0}
        className="min-w-0 overflow-x-auto outline-none"
        onKeyDown={handleGridKeyDown}
      >
        <ScoresTable
          ref={tableRef}
          rows={rows}
          meta={meta}
          sessionId={sessionId}
          attendanceMap={attendanceMap}
          attendanceIdMap={attendanceIdMap}
          onAttendanceChange={handleAttendanceChange}
          isEditMode={isEditMode}
          examEditTotal={examEditTotal}
          examEditObjective={examEditObjective}
          examEditSubjective={examEditSubjective}
          homeworkEdit={homeworkEdit}
          scoreDisplayMode={scoreDisplayMode}
          scoreFormat={scoreFormat}
          viewFilter={viewFilter}
          selectedEnrollmentId={selectedEnrollmentId}
          selectedCell={selectedCell}
          onRequestMoveNext={onRequestMoveNext}
          onRequestMovePrev={onRequestMovePrev}
          onRequestMoveDown={onRequestMoveDown}
          onRequestMoveUp={onRequestMoveUp}
          onSelectCell={isEditMode
            ? (row, type, id, questionIdOrSub) => {
                setSelectedEnrollmentId(row.enrollment_id);
                const rIdx = rows.findIndex((r) => r.enrollment_id === row.enrollment_id);
                if (type === "exam") {
                  const sub = questionIdOrSub as "total" | "objective" | "subjective" | number | undefined;
                  const cIdx = editableCols.findIndex((c) => {
                    if (c.type !== "exam" || c.examId !== id) return false;
                    if (c.sub === "total") return sub === "total" || (sub == null && questionIdOrSub == null);
                    if (c.sub === "objective") return sub === "objective";
                    if (c.sub === "subjective") return sub === "subjective";
                    if (c.sub === "item") return typeof sub === "number" && c.questionId === sub;
                    return false;
                  });
                  const colIdx = cIdx >= 0 ? cIdx : 0;
                  setSelectedColIndex(colIdx);
                  focusAt(rIdx, colIdx);
                } else {
                  const c = editableCols.findIndex((c) => c.type === "homework" && c.homeworkId === id);
                  const colIdx = c >= 0 ? c : 0;
                  setSelectedColIndex(colIdx);
                  focusAt(rIdx, colIdx);
                }
              }
            : () => {}}
          onSelectRow={(r) => {
            if (isEditMode) setSelectedEnrollmentId(r.enrollment_id);
            setDrawerEnrollmentId((prev) =>
              prev === r.enrollment_id ? null : r.enrollment_id
            );
          }}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={onSelectionChange}
          onReorderColumnSwap={handleReorderSwap}
        />
      </div>

      {/* 학생 상세 드로어 (편집 모드에서도 유지) */}
      {drawerRow && (
        <StudentScoresDrawer
          row={drawerRow}
          meta={meta}
          sessionId={sessionId}
          onClose={() => { setDrawerEnrollmentId(null); setAnswerDetail(null); }}
          onOpenAnswerDetail={(examId, enrollmentId, examTitle) => {
            setAnswerDetail({ examId, enrollmentId, examTitle });
          }}
        />
      )}

      {/* 답안 상세 드로어 (StudentScoresDrawer 에서 "답안 상세 보기" 클릭) */}
      {answerDetail && (
        <StudentResultDrawer
          examId={answerDetail.examId}
          enrollmentId={answerDetail.enrollmentId}
          studentName={drawerRow?.student_name ?? ""}
          examTitle={answerDetail.examTitle}
          onClose={() => setAnswerDetail(null)}
        />
      )}

    </div>
  );
});
