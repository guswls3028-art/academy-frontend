// PATH: src/app_teacher/domains/attendance/pages/SwipeAttendancePage.tsx
// 출석 체크 — 스와이프 UI. 우측=출석, 좌측=결석, 탭=상태 선택
import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  fetchAttendance,
  updateAttendance,
  bulkSetPresent,
  type AttendanceListItem,
} from "../api";
import AttendanceCard from "../components/AttendanceCard";
import StatusBottomSheet from "../components/StatusBottomSheet";
import styles from "./SwipeAttendancePage.module.css";

const EMPTY_RECORDS: AttendanceListItem[] = [];

type AttendanceSummary = {
  present: number;
  absent: number;
  other: number;
};

export default function SwipeAttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sid = Number(sessionId);

  const { data: result, isLoading } = useQuery({
    queryKey: ["attendance", sid],
    queryFn: () => fetchAttendance(sid, { page_size: 200 }),
    enabled: Number.isFinite(sid),
  });

  const records = result?.data ?? EMPTY_RECORDS;

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateAttendance(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", sid] });
      qc.invalidateQueries({ queryKey: ["session-attendance", sid] });
    },
    onError: (e) => feedback.error(extractApiError(e, "상태 변경 실패")),
  });

  const bulkMut = useMutation({
    mutationFn: () => bulkSetPresent(sid),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["attendance", sid] });
      qc.invalidateQueries({ queryKey: ["session-attendance", sid] });
      feedback.success(`${data.updated}명 출석 처리`);
    },
    onError: (e) => feedback.error(extractApiError(e, "전체 출석 실패")),
  });

  const [sheetRecord, setSheetRecord] = useState<AttendanceListItem | null>(null);
  const [undoItem, setUndoItem] = useState<{
    id: number;
    prev: string;
  } | null>(null);

  const handleStatusChange = useCallback(
    (attendanceId: number, status: string) => {
      const prev = records.find((r) => r.id === attendanceId);
      if (prev) {
        setUndoItem({ id: attendanceId, prev: prev.status });
        setTimeout(() => setUndoItem(null), 3000);
      }
      updateMut.mutate({ id: attendanceId, status });
    },
    [records, updateMut],
  );

  const handleUndo = useCallback(() => {
    if (undoItem) {
      updateMut.mutate({ id: undoItem.id, status: undoItem.prev });
      setUndoItem(null);
    }
  }, [undoItem, updateMut]);

  // Summary
  const summary = records.reduce(
    (acc: AttendanceSummary, r) => {
      if (["PRESENT", "ONLINE", "LATE", "SUPPLEMENT"].includes(r.status))
        acc.present++;
      else if (["ABSENT", "RUNAWAY"].includes(r.status)) acc.absent++;
      else acc.other++;
      return acc;
    },
    { present: 0, absent: 0, other: 0 },
  );

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className={styles.title}>
          출석 체크
        </h1>
        <button
          onClick={() => bulkMut.mutate()}
          disabled={bulkMut.isPending}
          className={styles.bulkButton}
        >
          전체출석
        </button>
      </div>

      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <span className={styles.summaryPresent}>
          출석 {summary.present}
        </span>
        <span className={styles.summaryAbsent}>
          결석 {summary.absent}
        </span>
        {summary.other > 0 && (
          <span className={styles.summaryOther}>
            기타 {summary.other}
          </span>
        )}
        <span className={styles.summaryTotal}>
          총 {records.length}명
        </span>
      </div>

      {/* Hint */}
      <div className={styles.hint}>
        우측 스와이프 = 출석 · 좌측 = 결석 · 탭 = 상태 선택
      </div>

      {/* Cards */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : records.length > 0 ? (
        <div className={styles.cardList}>
          {records.map((r) => (
            <AttendanceCard
              key={r.id}
              record={r}
              onStatusChange={handleStatusChange}
              onTap={setSheetRecord}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title="출석 데이터가 없습니다"
        />
      )}

      {/* Bottom sheet */}
      <StatusBottomSheet
        open={!!sheetRecord}
        record={sheetRecord}
        onSelect={handleStatusChange}
        onClose={() => setSheetRecord(null)}
      />

      {/* Undo snackbar */}
      {undoItem && (
        <div className={styles.undoSnackbar}>
          <span>상태가 변경되었습니다</span>
          <button
            onClick={handleUndo}
            className={styles.undoButton}
          >
            되돌리기
          </button>
        </div>
      )}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={styles.backButton}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
