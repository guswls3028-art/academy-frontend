// PATH: src/features/scores/panels/SessionScoresPanel.tsx
// 성적 테이블 — 엑셀형 키보드 이동 (Tab/화살표), 입력은 테이블 셀에서만

import { useEffect, useMemo, useState, useCallback } from "react";
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
  /** 편집 모드일 때만 점수 셀 입력 가능 */
  isEditMode?: boolean;
  /** 일괄 작업용 행 선택. 부모에서 관리 시 전달 */
  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;
};

export default function SessionScoresPanel({ sessionId, search = "", isEditMode = false, selectedEnrollmentIds = [], onSelectionChange }: Props) {
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
  /** 선택(1) + 이름(1) + 출석(1) + 시험(2*E) + 과제(2*H) + 클리닉대상(1) + 사유(1) */
  const totalCols = 5 + examCols.length * 2 + homeworkCols.length * 2;
  /** 과제 점수 입력란(편집 가능) 첫 컬럼 인덱스 */
  const firstHomeworkScoreCol = 3 + examCols.length * 2;
  /** 과제 점수 입력란 마지막 컬럼 인덱스 (과제가 없으면 first와 동일) */
  const lastHomeworkScoreCol = homeworkCols.length > 0
    ? 3 + examCols.length * 2 + (homeworkCols.length - 1) * 2
    : firstHomeworkScoreCol;

  const rowIndex = useMemo(
    () => (selected ? rows.findIndex((r) => r.enrollment_id === selected.enrollment_id) : 0),
    [rows, selected]
  );
  const colIndex = useMemo(() => {
    if (activeColumn === "exam" && currentExamId != null) {
      const i = examCols.findIndex((e) => e.exam_id === currentExamId);
      return i >= 0 ? 3 + i * 2 : 3;
    }
    if (activeColumn === "homework" && currentHomeworkId != null) {
      const i = homeworkCols.findIndex((h) => h.homework_id === currentHomeworkId);
      return i >= 0 ? 3 + examCols.length * 2 + i * 2 : 3 + examCols.length * 2;
    }
    return 3;
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
        if (c <= 2) {
          setActiveColumn(examCols.length > 0 ? "exam" : "homework");
          setCurrentExamId(examCols[0]?.exam_id ?? null);
          setCurrentHomeworkId(homeworkCols[0]?.homework_id ?? null);
          return;
        }
        if (c < 3 + examCols.length * 2) {
          const examIdx = Math.floor((c - 3) / 2);
          const exam = examCols[examIdx];
          setActiveColumn("exam");
          setCurrentExamId(exam?.exam_id ?? null);
          setCurrentHomeworkId(homeworkCols[0]?.homework_id ?? null);
          return;
        }
        if (c < 3 + examCols.length * 2 + homeworkCols.length * 2) {
          const hwIdx = Math.floor((c - 3 - examCols.length * 2) / 2);
          const hw = homeworkCols[hwIdx];
          setActiveColumn("homework");
          setCurrentHomeworkId(hw?.homework_id ?? null);
          setCurrentExamId(examCols[0]?.exam_id ?? null);
          if (hw && row) {
            setFocusHomeworkCell({ enrollmentId: row.enrollment_id, homeworkId: hw.homework_id });
          }
          return;
        }
        setActiveColumn(examCols.length > 0 ? "exam" : "homework");
        setCurrentExamId(examCols[0]?.exam_id ?? null);
        setCurrentHomeworkId(homeworkCols[0]?.homework_id ?? null);
      },
    [rows, examCols, homeworkCols, totalCols]
  );

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditMode) return;
    if (rows.length === 0 || totalCols <= 0) return;
    const isTab = e.key === "Tab";
    const isShiftTab = e.key === "Tab" && e.shiftKey;
    /** 과제 점수 입력 컬럼인지(점수만, 합불 컬럼 제외). 과제가 없으면 false */
    const inHomeworkScoreCol =
      homeworkCols.length > 0 &&
      colIndex >= firstHomeworkScoreCol &&
      colIndex <= lastHomeworkScoreCol &&
      (colIndex - firstHomeworkScoreCol) % 2 === 0;

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
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (inHomeworkScoreCol) {
        const next = colIndex + 2;
        if (next > lastHomeworkScoreCol) moveTo(rowIndex + 1, firstHomeworkScoreCol);
        else moveTo(rowIndex, next);
      } else {
        moveTo(rowIndex, firstHomeworkScoreCol);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (inHomeworkScoreCol) {
        const prev = colIndex - 2;
        if (prev < firstHomeworkScoreCol) moveTo(rowIndex - 1, lastHomeworkScoreCol);
        else moveTo(rowIndex, prev);
      } else {
        moveTo(rowIndex, lastHomeworkScoreCol);
      }
      return;
    }
    if (isTab || isShiftTab) {
      e.preventDefault();
      if (isTab) {
        if (inHomeworkScoreCol) {
          const next = colIndex + 2;
          if (next > lastHomeworkScoreCol) moveTo(rowIndex + 1, firstHomeworkScoreCol);
          else moveTo(rowIndex, next);
        } else {
          moveTo(rowIndex, firstHomeworkScoreCol);
        }
      } else {
        if (inHomeworkScoreCol) {
          const prev = colIndex - 2;
          if (prev < firstHomeworkScoreCol) moveTo(rowIndex - 1, lastHomeworkScoreCol);
          else moveTo(rowIndex, prev);
        } else {
          moveTo(rowIndex, lastHomeworkScoreCol);
        }
      }
      return;
    }
  };

  const onRequestMoveNext = useCallback(() => {
    const inHomeworkScoreCol =
      colIndex >= firstHomeworkScoreCol &&
      colIndex <= lastHomeworkScoreCol &&
      (colIndex - firstHomeworkScoreCol) % 2 === 0;
    if (inHomeworkScoreCol) {
      const next = colIndex + 2;
      if (next > lastHomeworkScoreCol) moveTo(rowIndex + 1, firstHomeworkScoreCol);
      else moveTo(rowIndex, next);
    } else {
      if (colIndex + 1 >= totalCols) moveTo(rowIndex + 1, firstHomeworkScoreCol);
      else moveTo(rowIndex, colIndex + 1);
    }
  }, [colIndex, rowIndex, totalCols, firstHomeworkScoreCol, lastHomeworkScoreCol, moveTo]);

  const onRequestMovePrev = useCallback(() => {
    const inHomeworkScoreCol =
      colIndex >= firstHomeworkScoreCol &&
      colIndex <= lastHomeworkScoreCol &&
      (colIndex - firstHomeworkScoreCol) % 2 === 0;
    if (inHomeworkScoreCol) {
      const prev = colIndex - 2;
      if (prev < firstHomeworkScoreCol) moveTo(rowIndex - 1, lastHomeworkScoreCol);
      else moveTo(rowIndex, prev);
    } else {
      if (colIndex - 1 < 0) moveTo(rowIndex - 1, lastHomeworkScoreCol);
      else moveTo(rowIndex, colIndex - 1);
    }
  }, [colIndex, rowIndex, totalCols, firstHomeworkScoreCol, lastHomeworkScoreCol, moveTo]);

  const onRequestMoveDown = useCallback(() => {
    moveTo(rowIndex + 1, colIndex);
  }, [rowIndex, colIndex, moveTo]);

  const onRequestMoveUp = useCallback(() => {
    moveTo(rowIndex - 1, colIndex);
  }, [rowIndex, colIndex, moveTo]);

  useEffect(() => {
    if (!isEditMode) {
      setSelected(null);
      setCurrentExamId(null);
      setCurrentHomeworkId(null);
      setFocusHomeworkCell(null);
      return;
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!rows.length) {
      setSelected(null);
      setCurrentExamId(null);
      setCurrentHomeworkId(null);
      return;
    }

    if (!isEditMode) return;

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
  }, [rows, selected, currentExamId, currentHomeworkId, isEditMode]);

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
          selectedEnrollmentId={selected?.enrollment_id ?? null}
          selectedExamId={currentExamId}
          selectedHomeworkId={currentHomeworkId}
          focusHomeworkCell={focusHomeworkCell}
          onFocusHomeworkDone={() => setFocusHomeworkCell(null)}
          onRequestMoveNext={onRequestMoveNext}
          onRequestMovePrev={onRequestMovePrev}
          onRequestMoveDown={onRequestMoveDown}
          onRequestMoveUp={onRequestMoveUp}
          onSelectCell={isEditMode
            ? (row, type, id) => {
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
                  setFocusHomeworkCell({ enrollmentId: row.enrollment_id, homeworkId: id });
                  if (currentExamId == null && row.exams?.[0])
                    setCurrentExamId(row.exams[0].exam_id);
                }
              }
            : () => {}}
          onSelectRow={isEditMode ? setSelected : () => {}}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </div>
  );
}
