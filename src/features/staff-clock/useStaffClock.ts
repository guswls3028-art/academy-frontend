import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  endBreak,
  endWork,
  fetchCurrentlyWorkingStaff,
  fetchStaffMe,
  fetchWorkCurrent,
  startBreak,
  startWork,
  type AssignedWorkType,
  type WorkCurrentStatus,
} from "./api";
import { staffClockQueryKeys } from "./queryKeys";
import { workElapsedLabel, workElapsedSeconds } from "./time";

function useElapsedSeconds(current: WorkCurrentStatus | undefined) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!current || current.status === "OFF") {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => setElapsedSeconds(workElapsedSeconds(current));
    tick();
    if (current.status === "BREAK") return;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [current]);

  return elapsedSeconds;
}

export function useCurrentlyWorkingStaff() {
  return useQuery({
    queryKey: staffClockQueryKeys.currentlyWorking,
    queryFn: fetchCurrentlyWorkingStaff,
    refetchInterval: 30_000,
  });
}

export function useStaffClock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const shouldPromptForClockIn = user?.tenantRole === "staff";
  const canResolveStaffIdentity = user?.tenantRole === "owner"
    || user?.tenantRole === "admin"
    || user?.tenantRole === "teacher"
    || shouldPromptForClockIn;
  const staffMeQ = useQuery({
    queryKey: staffClockQueryKeys.me,
    queryFn: fetchStaffMe,
    enabled: canResolveStaffIdentity,
    staleTime: 30_000,
  });
  const staffId = staffMeQ.data?.staff_id;
  const assignedWorkTypes = staffMeQ.data?.assigned_work_types ?? [];
  const canUseClock = staffId != null && !staffMeQ.data?.is_owner;
  const currentQ = useQuery({
    queryKey: staffClockQueryKeys.current(staffId),
    queryFn: () => fetchWorkCurrent(staffId!),
    enabled: canUseClock,
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
  const isMutating = startMutation.isPending
    || endMutation.isPending
    || startBreakMutation.isPending
    || endBreakMutation.isPending;

  return {
    isAuthenticated: Boolean(user),
    shouldPromptForClockIn,
    canUseClock,
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
    isMutating,
  };
}
