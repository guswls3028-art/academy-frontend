// PATH: src/app_teacher/domains/attendance/pages/SwipeAttendancePage.tsx
// 출석 체크 — 스와이프 UI. 우측=출석, 좌측=결석, 탭=상태 선택
import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useTrackedTask } from "@/shared/productAnalytics";
import {
  fetchAttendanceRoster,
  updateAttendance,
  bulkSetPresent,
  type AttendanceListItem,
} from "../api";
import AttendanceCard from "../components/AttendanceCard";
import StatusBottomSheet from "../components/StatusBottomSheet";
import { teacherAttendanceQueryKeys } from "../queryKeys";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import styles from "./SwipeAttendancePage.module.css";

const EMPTY_RECORDS: AttendanceListItem[] = [];

type AttendanceSummary = {
  present: number;
  absent: number;
  unset: number;
  other: number;
};

export default function SwipeAttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sid = Number(sessionId);
  const validSession = Number.isSafeInteger(sid) && sid > 0;
  const runTrackedTask = useTrackedTask();

  const { data: result, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: teacherAttendanceQueryKeys.completeAttendance(sid),
    queryFn: () => fetchAttendanceRoster(sid),
    enabled: validSession,
  });

  const records = result ?? EMPTY_RECORDS;
  const rosterReady = validSession && result !== undefined && !isError;

  const updateMut = useMutation({
    mutationFn: ({ id, status, confirm_secession }: {
      id: number;
      status: string;
      confirm_secession?: boolean;
    }) => runTrackedTask(
      "attendance.update",
      () => updateAttendance(id, { status, confirm_secession }),
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherAttendanceQueryKeys.attendance(sid) });
      qc.invalidateQueries({ queryKey: teacherAttendanceQueryKeys.sessionAttendance(sid) });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sid) });
    },
    onError: (e) => feedback.error(extractApiError(e, "상태 변경 실패")),
  });

  const bulkMut = useMutation({
    mutationFn: () => runTrackedTask(
      "attendance.bulk-present",
      () => bulkSetPresent(sid),
    ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: teacherAttendanceQueryKeys.attendance(sid) });
      qc.invalidateQueries({ queryKey: teacherAttendanceQueryKeys.sessionAttendance(sid) });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sid) });
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
      updateMut.mutate({
        id: attendanceId,
        status,
        confirm_secession: status === "SECESSION" ? true : undefined,
      });
    },
    [records, updateMut],
  );

  const handleUndo = useCallback(() => {
    if (undoItem) {
      updateMut.mutate({
        id: undoItem.id,
        status: undoItem.prev,
        confirm_secession: undoItem.prev === "SECESSION" ? true : undefined,
      });
      setUndoItem(null);
    }
  }, [undoItem, updateMut]);

  // Summary
  const summary = records.reduce(
    (acc: AttendanceSummary, r) => {
      if (["PRESENT", "ONLINE", "LATE", "SUPPLEMENT"].includes(r.status))
        acc.present++;
      else if (["ABSENT", "RUNAWAY"].includes(r.status)) acc.absent++;
      else if (r.status === "UNSET") acc.unset++;
      else acc.other++;
      return acc;
    },
    { present: 0, absent: 0, unset: 0, other: 0 },
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
          disabled={!rosterReady || isFetching || !records.length || bulkMut.isPending || updateMut.isPending}
          className={styles.bulkButton}
        >
          전체출석
        </button>
      </div>

      {/* Summary bar */}
      {rosterReady && <div className={styles.summaryBar}>
        <span className={styles.summaryPresent}>
          출석 {summary.present}
        </span>
        <span className={styles.summaryAbsent}>
          결석 {summary.absent}
        </span>
        {summary.unset > 0 && (
          <span className={styles.summaryOther}>
            미입력 {summary.unset}
          </span>
        )}
        {summary.other > 0 && (
          <span className={styles.summaryOther}>
            기타 {summary.other}
          </span>
        )}
        <span className={styles.summaryTotal}>
          총 {records.length}명
        </span>
      </div>}

      {/* Hint */}
      <div className={styles.hint}>
        우측 스와이프 = 출석 · 좌측 = 결석 · 탭 = 상태 선택
      </div>

      {/* Cards */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : !validSession || isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="출석 명단을 불러오지 못했습니다"
          description={validSession
            ? extractApiError(error, "전체 명단을 다시 불러온 뒤 출석을 입력해 주세요.")
            : "차시 정보를 확인한 뒤 다시 열어 주세요."}
          actions={
            validSession ? (
              <EmptyActionButton variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
                다시 시도
              </EmptyActionButton>
            ) : (
              <EmptyActionButton variant="secondary" onClick={() => navigate(-1)}>
                차시로 돌아가기
              </EmptyActionButton>
            )
          }
        />
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
          description="차시에 수강생이 등록되면 출석 체크 카드가 자동으로 표시됩니다."
          actions={
            <EmptyActionButton variant="secondary" onClick={() => navigate(-1)}>
              차시로 돌아가기
            </EmptyActionButton>
          }
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
