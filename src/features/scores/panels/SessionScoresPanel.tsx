// PATH: src/features/scores/panels/SessionScoresPanel.tsx
// 성적 테이블 + 사이드패널 — 엑셀형 키보드 이동 (Tab/화살표)

import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchSessionScores,
  type SessionScoreRow,
  type SessionScoreMeta,
} from "../api/sessionScores";
import { fetchAttendance } from "@/features/lectures/api/attendance";

import ScoresTable from "../components/ScoresTable";
import ScoreSidePanel from "./ScoreSidePanel";
import { EmptyState } from "@/shared/ui/ds";

type Props = {
  sessionId: number;
  search?: string;
};

export default function SessionScoresPanel({ sessionId, search = "" }: Props) {
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [focusHomeworkCell, setFocusHomeworkCell] = useState<{
    enrollmentId: number;
    homeworkId: number;
  } | null>(null);

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

  const [selected, setSelected] = useState<SessionScoreRow | null>(null);
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [currentHomeworkId, setCurrentHomeworkId] = useState<number | null>(null);
  const [activeColumn, setActiveColumn] = useState<"exam" | "homework">("exam");

  const examCols = meta?.exams ?? [];
  const homeworkCols = meta?.homeworks ?? [];
  const totalCols = 2 + examCols.length + homeworkCols.length;

  const rowIndex = useMemo(
    () => (selected ? rows.findIndex((r) => r.enrollment_id === selected.enrollment_id) : 0),
    [rows, selected]
  );
  const colIndex = useMemo(() => {
    if (activeColumn === "exam" && currentExamId != null) {
      const i = examCols.findIndex((e) => e.exam_id === currentExamId);
      return i >= 0 ? 2 + i : 2;
    }
    if (activeColumn === "homework" && currentHomeworkId != null) {
      const i = homeworkCols.findIndex((h) => h.homework_id === currentHomeworkId);
      return i >= 0 ? 2 + examCols.length + i : 2 + examCols.length;
    }
    return 1;
  }, [activeColumn, currentExamId, currentHomeworkId, examCols, homeworkCols]);

  const moveTo = useMemo(
    () =>
      (nextRow: number, nextCol: number) => {
        const r = Math.max(0, Math.min(nextRow, rows.length - 1));
        const c = Math.max(0, Math.min(nextCol, totalCols - 1));
        const row = rows[r];
        if (!row) return;
        setSelected(row);
        setFocusHomeworkCell(null);
        if (c <= 1) {
          setActiveColumn(examCols.length > 0 ? "exam" : "homework");
          setCurrentExamId(examCols[0]?.exam_id ?? null);
          setCurrentHomeworkId(homeworkCols[0]?.homework_id ?? null);
          return;
        }
        if (c < 2 + examCols.length) {
          const exam = examCols[c - 2];
          setActiveColumn("exam");
          setCurrentExamId(exam?.exam_id ?? null);
          setCurrentHomeworkId(homeworkCols[0]?.homework_id ?? null);
          return;
        }
        const hw = homeworkCols[c - 2 - examCols.length];
        setActiveColumn("homework");
        setCurrentHomeworkId(hw?.homework_id ?? null);
        setCurrentExamId(examCols[0]?.exam_id ?? null);
        if (hw && row) {
          setFocusHomeworkCell({ enrollmentId: row.enrollment_id, homeworkId: hw.homework_id });
        }
      },
    [rows, examCols, homeworkCols, totalCols]
  );

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0 || totalCols <= 0) return;
    const isTab = e.key === "Tab";
    const isShiftTab = e.key === "Tab" && e.shiftKey;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveTo(rowIndex + 1, colIndex);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveTo(rowIndex - 1, colIndex);
      return;
    }
    if (isTab || e.key === "ArrowRight") {
      e.preventDefault();
      if (colIndex + 1 >= totalCols) moveTo(rowIndex + 1, 0);
      else moveTo(rowIndex, colIndex + 1);
      return;
    }
    if (isShiftTab || e.key === "ArrowLeft") {
      e.preventDefault();
      if (colIndex - 1 < 0) moveTo(rowIndex - 1, totalCols - 1);
      else moveTo(rowIndex, colIndex - 1);
      return;
    }
  };

  useEffect(() => {
    if (!rows.length) {
      setSelected(null);
      setCurrentExamId(null);
      setCurrentHomeworkId(null);
      return;
    }

    if (!selected) {
      const first = rows[0];
      setSelected(first);
      setCurrentExamId(first.exams?.[0]?.exam_id ?? null);
      setCurrentHomeworkId(first.homeworks?.[0]?.homework_id ?? null);
      return;
    }

    const next = rows.find((r) => r.enrollment_id === selected.enrollment_id);
    const resolved = next ?? rows[0];
    setSelected(resolved);

    if (
      currentExamId == null ||
      !resolved.exams.some((e) => e.exam_id === currentExamId)
    ) {
      setCurrentExamId(resolved.exams?.[0]?.exam_id ?? null);
    }

    if (
      currentHomeworkId == null ||
      !resolved.homeworks.some((h) => h.homework_id === currentHomeworkId)
    ) {
      setCurrentHomeworkId(resolved.homeworks?.[0]?.homework_id ?? null);
    }
  }, [rows, selected, currentExamId, currentHomeworkId]);

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
    <div className="flex gap-6">
      <div
        ref={tableWrapperRef}
        tabIndex={0}
        className="flex-1 min-w-0 overflow-x-auto outline-none"
        onKeyDown={handleGridKeyDown}
      >
        <ScoresTable
          rows={rows}
          meta={meta}
          sessionId={sessionId}
          attendanceMap={attendanceMap}
          selectedEnrollmentId={selected?.enrollment_id ?? null}
          selectedExamId={currentExamId}
          selectedHomeworkId={currentHomeworkId}
          focusHomeworkCell={focusHomeworkCell}
          onFocusHomeworkDone={() => setFocusHomeworkCell(null)}
          onSelectCell={(row, type, id) => {
            setSelected(row);
            setFocusHomeworkCell(null);
            if (type === "exam") {
              setActiveColumn("exam");
              setCurrentExamId(id);
              if (currentHomeworkId == null && row.homeworks?.[0])
                setCurrentHomeworkId(row.homeworks[0].homework_id);
            } else {
              setActiveColumn("homework");
              setCurrentHomeworkId(id);
              if (currentExamId == null && row.exams?.[0])
                setCurrentExamId(row.exams[0].exam_id);
            }
          }}
          onSelectRow={setSelected}
        />
      </div>

      {selected && currentExamId != null && currentHomeworkId != null && meta && (
        <div className="w-[420px] shrink-0">
          <ScoreSidePanel
            sessionId={sessionId}
            examId={currentExamId}
            homeworkId={currentHomeworkId}
            row={selected}
            meta={meta}
            onClose={() => {}}
            activeColumn={activeColumn}
            onSelectExam={(id) => {
              setActiveColumn("exam");
              setCurrentExamId(id);
            }}
            onSelectHomework={(id) => {
              setActiveColumn("homework");
              setCurrentHomeworkId(id);
            }}
          />
        </div>
      )}
    </div>
  );
}
