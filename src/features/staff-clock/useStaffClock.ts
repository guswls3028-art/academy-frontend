import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  endBreak,
  endWork,
  fetchStaffMe,
  fetchWorkCurrent,
  startBreak,
  startWork,
  type AssignedWorkType,
  type WorkCurrentStatus,
} from "./api";
import { staffClockQueryKeys } from "./queryKeys";

function parseStartedAt(date: string, time: string): number {
  const normalizedTime = String(time).trim().split(".")[0];
  const iso = normalizedTime.length <= 5
    ? `${date}T${normalizedTime}:00`
    : `${date}T${normalizedTime}`;
  return new Date(iso).getTime();
}

export function workElapsedLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function useElapsedSeconds(current: WorkCurrentStatus | undefined) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!current || current.status === "OFF") {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = parseStartedAt(current.date, current.started_at);
    const breakSeconds = current.break_total_seconds ?? ((current.break_minutes ?? 0) * 60);
    if (current.status === "BREAK" && current.break_started_at) {
      const breakStartedAt = new Date(current.break_started_at).getTime();
      setElapsedSeconds(
        Math.max(0, Math.floor((breakStartedAt - startedAt) / 1000) - breakSeconds),
      );
      return;
    }
    const tick = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000) - breakSeconds),
      );
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [current]);

  return elapsedSeconds;
}

export function useStaffClock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAssistant = user?.tenantRole === "staff";
  const staffMeQ = useQuery({
    queryKey: staffClockQueryKeys.me,
    queryFn: fetchStaffMe,
    enabled: isAssistant,
    staleTime: 30_000,
  });
  const staffId = staffMeQ.data?.staff_id;
  const assignedWorkTypes = staffMeQ.data?.assigned_work_types ?? [];
  const currentQ = useQuery({
    queryKey: staffClockQueryKeys.current(staffId),
    queryFn: () => fetchWorkCurrent(staffId!),
    enabled: isAssistant && staffId != null,
    refetchInterval: 30_000,
  });
  const elapsedSeconds = useElapsedSeconds(currentQ.data);

  const invalidateTotals = () => {
    queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.records });
    queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.summary });
    queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.personalRecordsRoot });
    queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.personalSummaryRoot });
    queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.currentlyWorking });
  };

  const startMutation = useMutation({
    mutationFn: (workType: AssignedWorkType) => startWork(staffId!, workType.id),
    onSuccess: (record) => {
      const nextCurrent: WorkCurrentStatus = {
        status: "WORKING",
        work_record_id: record.id,
        date: record.date,
        started_at: record.start_time,
        work_type: record.work_type,
        work_type_name: record.work_type_name,
        hourly_wage: record.resolved_hourly_wage,
        break_minutes: 0,
        break_total_seconds: 0,
      };
      queryClient.setQueryData<WorkCurrentStatus>(
        staffClockQueryKeys.current(staffId),
        nextCurrent,
      );
      invalidateTotals();
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "출근 처리에 실패했습니다."));
    },
  });

  const endMutation = useMutation({
    mutationFn: (recordId: number) => endWork(recordId),
    onSuccess: () => {
      queryClient.setQueryData<WorkCurrentStatus>(
        staffClockQueryKeys.current(staffId),
        { status: "OFF" },
      );
      invalidateTotals();
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "퇴근 처리에 실패했습니다."));
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: (recordId: number) => startBreak(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.current(staffId) });
      queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.currentlyWorking });
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "휴식을 시작하지 못했습니다."));
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: (recordId: number) => endBreak(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.current(staffId) });
      queryClient.invalidateQueries({ queryKey: staffClockQueryKeys.currentlyWorking });
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "근무를 다시 시작하지 못했습니다."));
    },
  });

  const current = currentQ.data;
  const isWorking = current?.status === "WORKING" || current?.status === "BREAK";
  const isOnBreak = current?.status === "BREAK";
  const recordId = current && current.status !== "OFF" ? current.work_record_id : null;

  return {
    isAuthenticated: Boolean(user),
    isAssistant,
    staffMeQ,
    currentQ,
    staffId,
    assignedWorkTypes,
    current,
    isWorking,
    isOnBreak,
    recordId,
    elapsedSeconds,
    timeLabel: isWorking ? workElapsedLabel(elapsedSeconds) : "0:00",
    startWork: (workType: AssignedWorkType) => startMutation.mutateAsync(workType),
    endWork: () => recordId == null ? Promise.resolve(undefined) : endMutation.mutateAsync(recordId),
    startBreak: () => recordId == null ? Promise.resolve(undefined) : startBreakMutation.mutateAsync(recordId),
    endBreak: () => recordId == null ? Promise.resolve(undefined) : endBreakMutation.mutateAsync(recordId),
    isStarting: startMutation.isPending,
    isEnding: endMutation.isPending,
    isBreakStarting: startBreakMutation.isPending,
    isBreakEnding: endBreakMutation.isPending,
  };
}
