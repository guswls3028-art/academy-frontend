// PATH: src/features/staff/components/StaffClockHeader.tsx
// 직원 로그인 시 헤더 크레딧 영역 옆 출근/퇴근 버튼 + 실시간 근무시간

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStaffMe } from "../api/staffMe.api";
import {
  fetchWorkCurrent,
  startWork,
  endWork,
  type WorkCurrentStatus,
} from "../api/workRecords.api";
import { Button } from "@/shared/ui/ds";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseStartedAt(dateStr: string, timeStr: string): number {
  const date = dateStr.trim();
  const time = String(timeStr).trim();
  const iso = time.length <= 5 ? `${date}T${time}:00` : `${date}T${time}`;
  return new Date(iso).getTime();
}

export function StaffClockHeader() {
  const queryClient = useQueryClient();
  const { data: staffMe } = useQuery({ queryKey: ["staff-me"], queryFn: fetchStaffMe });
  const staffId = staffMe?.staff_id;
  const defaultWorkTypeId = staffMe?.default_work_type_id;

  const { data: current, isLoading: currentLoading } = useQuery({
    queryKey: ["work-current", staffId],
    queryFn: () => fetchWorkCurrent(staffId!),
    enabled: !!staffId,
    refetchInterval: 30_000,
  });

  const startMutation = useMutation({
    mutationFn: () => startWork(staffId!, defaultWorkTypeId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-current", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-records"] });
    },
  });

  const endMutation = useMutation({
    mutationFn: (recordId: number) => endWork(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-current", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-records"] });
    },
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!current || current.status !== "WORKING" || !("date" in current) || !("started_at" in current)) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = parseStartedAt(current.date, current.started_at);
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [current?.status, current?.date, current?.started_at]);

  if (!staffId || defaultWorkTypeId == null) return null;

  const isWorking = current?.status === "WORKING" || current?.status === "BREAK";
  const workRecordId = current && "work_record_id" in current ? current.work_record_id : null;
  const isStarting = startMutation.isPending;
  const isEnding = endMutation.isPending;

  return (
    <div className="app-header__staffClock flex items-center gap-2">
      {currentLoading ? (
        <span className="text-xs text-[var(--color-text-muted)]">확인 중...</span>
      ) : isWorking ? (
        <>
          <span className="app-header__staffClockElapsed font-mono text-sm font-semibold tabular-nums text-[var(--color-primary)]">
            {formatElapsed(elapsedSeconds)}
          </span>
          <Button
            intent="primary"
            size="sm"
            disabled={isEnding}
            onClick={() => workRecordId != null && endMutation.mutate(workRecordId)}
          >
            {isEnding ? "처리 중…" : "퇴근"}
          </Button>
        </>
      ) : (
        <Button
          intent="secondary"
          size="sm"
          disabled={isStarting}
          onClick={() => startMutation.mutate()}
        >
          {isStarting ? "처리 중…" : "출근"}
        </Button>
      )}
    </div>
  );
}
