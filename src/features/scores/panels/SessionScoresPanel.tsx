// PATH: src/features/scores/panels/SessionScoresPanel.tsx
// 성적 테이블 — 엑셀형 키보드 이동 (Tab/화살표), 입력은 테이블 셀에서만

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchSessionScores,
  type SessionScoreRow,
  type SessionScoreMeta,
} from "../api/sessionScores";
import { fetchAttendance } from "@/features/lectures/api/attendance";

import ScoresTable from "../components/ScoresTable";
import { EmptyState } from "@/shared/ui/ds";

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
  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;
};

type ScoreCellRef =
  | { type: "exam"; examId: number; sub: "total" }
  | { type: "exam"; examId: number; sub: "objective" }
  | { type: "exam"; examId: number; sub: "item"; questionId: number }
  | { type: "homework"; homeworkId: number };

type FocusScoreCell = {
  enrollmentId: number;
} & ScoreCellRef;

export default function SessionScoresPanel({
  sessionId,
  search = "",
  isEditMode = false,
  examEditTotal = false,
  examEditObjective = false,
  examEditSubjective = false,
  homeworkEdit = false,
  scoreDisplayMode = "total",
  selectedEnrollmentIds = [],
  onSelectionChange,
}: Props) {
  const [focusCell, setFocusCell] = useState<FocusScoreCell | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-scores", sessionId],
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const { data: attendanceList } = useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: () => fetchAttendance(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const allRows = useMemo<SessionScoreRow[]>(() => data?.rows ?? [], [data]);
  const meta: SessionScoreMeta | null = data?.meta ?? null;

  const attendanceMap = useMemo(() => {
    const raw = attendanceList;
    const list = Array.isArray(raw) ? raw : (raw as { results?: unknown[] })?.results ?? [];
    const map: Record<number, string> = {};
    for (const a of list) {
      const item = a as { enrollment_id?: number; enrollment?: number; status?: string };
      const eid = item?.enrollment_id ?? item?.enrollment;
      if (eid != null && item?.status) map[Number(eid)] = String(item.status);
    }
    return map;
  }, [attendanceList]);

  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => (r.student_name ?? "").toLowerCase().includes(q));
  }, [allRows, search]);

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
        if (examEditSubjective) {
          const questions = (e as { questions?: { question_id: number }[] }).questions ?? [];
          questions.forEach((q) => list.push({ type: "exam", examId: e.exam_id, sub: "item", questionId: q.question_id }));
        }
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
    setFocusCell({ enrollmentId: row.enrollment_id, ...col });
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
      setFocusCell(null);
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

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (isError || !data) {
    return <EmptyState scope="panel" tone="error" title="성적 로드 실패" />;
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
          rows={rows}
          meta={meta}
          sessionId={sessionId}
          attendanceMap={attendanceMap}
          isEditMode={isEditMode}
          examEditTotal={examEditTotal}
          examEditObjective={examEditObjective}
          examEditSubjective={examEditSubjective}
          homeworkEdit={homeworkEdit}
          scoreDisplayMode={scoreDisplayMode}
          selectedEnrollmentId={selectedEnrollmentId}
          selectedCell={selectedEnrollmentId != null ? (() => {
            const col = editableCols[clampCol(selectedColIndex)];
            return col ? ({ enrollmentId: selectedEnrollmentId, ...col } as FocusScoreCell) : null;
          })() : null}
          focusCell={focusCell}
          onFocusDone={() => setFocusCell(null)}
          onRequestMoveNext={onRequestMoveNext}
          onRequestMovePrev={onRequestMovePrev}
          onRequestMoveDown={onRequestMoveDown}
          onRequestMoveUp={onRequestMoveUp}
          onSelectCell={isEditMode
            ? (row, type, id, questionIdOrSub) => {
                setSelectedEnrollmentId(row.enrollment_id);
                const rIdx = rows.findIndex((r) => r.enrollment_id === row.enrollment_id);
                if (type === "exam") {
                  const sub = questionIdOrSub as "total" | "objective" | number | undefined;
                  const cIdx = editableCols.findIndex((c) => {
                    if (c.type !== "exam" || c.examId !== id) return false;
                    if (c.sub === "total") return sub === "total" || (sub == null && questionIdOrSub == null);
                    if (c.sub === "objective") return sub === "objective";
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
          onSelectRow={isEditMode ? (r) => setSelectedEnrollmentId(r.enrollment_id) : () => {}}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </div>
  );
}
