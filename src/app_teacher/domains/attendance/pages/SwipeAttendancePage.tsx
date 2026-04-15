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
  STATUS_CONFIG,
} from "../api";
import AttendanceCard from "../components/AttendanceCard";
import StatusBottomSheet from "../components/StatusBottomSheet";

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

  const records = result?.data ?? [];

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateAttendance(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", sid] });
    },
    onError: (e) => feedback.error(extractApiError(e, "상태 변경 실패")),
  });

  const bulkMut = useMutation({
    mutationFn: () => bulkSetPresent(sid),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["attendance", sid] });
      feedback.success(`${data.updated}명 출석 처리`);
    },
    onError: (e) => feedback.error(extractApiError(e, "전체 출석 실패")),
  });

  const [sheetRecord, setSheetRecord] = useState<any | null>(null);
  const [undoItem, setUndoItem] = useState<{
    id: number;
    prev: string;
  } | null>(null);

  const handleStatusChange = useCallback(
    (attendanceId: number, status: string) => {
      const prev = records.find((r: any) => r.id === attendanceId);
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
    (acc: any, r: any) => {
      if (["PRESENT", "ONLINE", "LATE", "SUPPLEMENT"].includes(r.status))
        acc.present++;
      else if (["ABSENT", "RUNAWAY"].includes(r.status)) acc.absent++;
      else acc.other++;
      return acc;
    },
    { present: 0, absent: 0, other: 0 },
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1
          className="text-[17px] font-bold flex-1"
          style={{ color: "var(--tc-text)" }}
        >
          출석 체크
        </h1>
        <button
          onClick={() => bulkMut.mutate()}
          disabled={bulkMut.isPending}
          className="rounded-full text-[13px] font-bold text-white cursor-pointer disabled:opacity-60"
          style={{ padding: "6px 14px", background: "var(--tc-success)" }}
        >
          전체출석
        </button>
      </div>

      {/* Summary bar */}
      <div
        className="flex gap-3 text-[13px] rounded-lg"
        style={{
          padding: "var(--tc-space-3) var(--tc-space-4)",
          background: "var(--tc-surface)",
          border: "1px solid var(--tc-border)",
        }}
      >
        <span className="font-bold" style={{ color: "var(--tc-success)" }}>
          출석 {summary.present}
        </span>
        <span className="font-bold" style={{ color: "var(--tc-danger)" }}>
          결석 {summary.absent}
        </span>
        {summary.other > 0 && (
          <span
            className="font-semibold"
            style={{ color: "var(--tc-text-muted)" }}
          >
            기타 {summary.other}
          </span>
        )}
        <span className="ml-auto" style={{ color: "var(--tc-text-muted)" }}>
          총 {records.length}명
        </span>
      </div>

      {/* Hint */}
      <div
        className="text-xs text-center"
        style={{ color: "var(--tc-text-muted)" }}
      >
        우측 스와이프 = 출석 · 좌측 = 결석 · 탭 = 상태 선택
      </div>

      {/* Cards */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : records.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {records.map((r: any) => (
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
        <div
          className="fixed left-4 right-4 flex justify-between items-center rounded-lg text-white text-sm"
          style={{
            bottom: "calc(var(--tc-tabbar-h) + var(--tc-safe-bottom) + 16px)",
            zIndex: "var(--tc-z-snackbar)" as any,
            background: "#1e293b",
            padding: "12px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <span>상태가 변경되었습니다</span>
          <button
            onClick={handleUndo}
            className="font-bold cursor-pointer"
            style={{ color: "var(--tc-primary)", background: "none", border: "none" }}
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
      className="flex p-1 cursor-pointer"
      style={{
        background: "none",
        border: "none",
        color: "var(--tc-text-secondary)",
      }}
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
