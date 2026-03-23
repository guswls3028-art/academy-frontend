// PATH: src/features/scores/panels/SessionScoresPanel.tsx
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
import { fetchAttendance, updateAttendance } from "@/features/lectures/api/attendance";

import ScoresTable, { type ScoresTableHandle } from "../components/ScoresTable";
import StudentScoresDrawer from "../components/StudentScoresDrawer";
import StudentResultDrawer from "@/features/results/components/StudentResultDrawer";
import { EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import AdminOmrBatchUploadBox from "@/features/submissions/components/AdminOmrBatchUploadBox";
import { reorderSession } from "../api/reorderSession";

type Props = {
  sessionId: number;
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

type FocusScoreCell = {
  enrollmentId: number;
} & ScoreCellRef;

export default forwardRef<SessionScoresPanelHandle, Props>(function SessionScoresPanel({
  sessionId,
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
  const [openOmrForExam, setOpenOmrForExam] = useState<{ examId: number; title: string } | null>(null);
  /** 읽기 모드 — 학생 상세 드로어 (이름 클릭) */
  const [drawerEnrollmentId, setDrawerEnrollmentId] = useState<number | null>(null);
  /** 답안 상세 드로어 (StudentScoresDrawer → 답안 상세 보기) */
  const [answerDetail, setAnswerDetail] = useState<{ examId: number; enrollmentId: number; examTitle: string } | null>(null);

  const handleOpenOmrModal = useCallback((examId: number, title: string) => {
    setOpenOmrForExam({ examId, title });
  }, []);

  const handleCloseOmrModal = useCallback(() => {
    setOpenOmrForExam(null);
    qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
  }, [qc, sessionId]);

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

  const handleReorder = useCallback(async (type: "exam" | "homework", id: number, direction: "up" | "down") => {
    if (!meta) return;
    const list = type === "exam"
      ? meta.exams.map((e) => e.exam_id)
      : meta.homeworks.map((h) => h.homework_id);
    const idx = list.indexOf(id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const newList = [...list];
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
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
      if (newStatus === "SECESSION") {
        qc.invalidateQueries({ queryKey: ["attendance-matrix"] });
        qc.invalidateQueries({ queryKey: ["session-enrollments"] });
        feedback.success("퇴원 처리되었습니다.");
      }
    } catch {
      feedback.error("출결 변경에 실패했습니다.");
    }
  }, [attendanceIdMap, qc, sessionId]);

  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => (r.student_name ?? "").toLowerCase().includes(q));
  }, [allRows, search]);

  // 드로어에 항상 최신 rows 데이터를 전달 (쿼리 갱신 시 자동 반영)
  const drawerRow = useMemo(
    () => (drawerEnrollmentId != null ? allRows.find((r) => r.enrollment_id === drawerEnrollmentId) ?? null : null),
    [allRows, drawerEnrollmentId],
  );

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(0); // editable columns index
  const prevEditModeRef = useRef(false);

  const examCols = meta?.exams ?? [];
  const homeworkCols = meta?.homeworks ?? [];
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
        title={search.trim() ? "검색 결과가 없습니다" : "등록된 수강생이 없습니다"}
        description={search.trim() ? "다른 검색어로 시도해 보세요." : "수강생 등록 후 성적을 입력할 수 있습니다."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
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

      {openOmrForExam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="omr-upload-modal-title"
        >
          <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg border border-[var(--color-border-divider)] max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-divider)]">
              <h2 id="omr-upload-modal-title" className="text-base font-semibold text-[var(--color-text-primary)]">
                OMR 업로드 — {openOmrForExam.title}
              </h2>
              <button
                type="button"
                onClick={handleCloseOmrModal}
                className="p-2 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <AdminOmrBatchUploadBox examId={openOmrForExam.examId} />
            </div>
            <div className="px-4 py-3 border-t border-[var(--color-border-divider)] flex justify-end">
              <button
                type="button"
                onClick={handleCloseOmrModal}
                className="h-9 px-4 rounded text-sm font-medium bg-[var(--color-brand-primary)] text-white hover:opacity-90"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
