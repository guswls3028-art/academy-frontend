// PATH: src/features/staff/components/HeaderCenterStaffClock.tsx
// 헤더 중앙: 근무 중인 직원(직급아이콘+이름) + 총근무 시간 + 출근(초록)/휴식(노랑)/근무(노랑)/퇴근(빨강)

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStaffMe } from "../api/staffMe.api";
import {
  fetchWorkCurrent,
  startWork,
  endWork,
  startBreak,
  endBreak,
  fetchCurrentlyWorkingStaff,
} from "../api/workRecords.api";
import type { WorkCurrentStatus } from "../api/workRecords.api";
import { Button } from "@/shared/ui/ds";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** date(YYYY-MM-DD) + time(HH:MM:SS) → 로컬 기준 출근 시각(ms) */
function parseStartedAt(dateStr: string, timeStr: string): number {
  const date = dateStr.trim();
  const time = String(timeStr).trim().split(".")[0];
  const iso = time.length <= 5 ? `${date}T${time}:00` : `${date}T${time}`;
  return new Date(iso).getTime();
}

/** 직급 라벨 (아이콘 대신 한글) */
function RoleLabel({ role }: { role?: "TEACHER" | "ASSISTANT" }) {
  const label = role === "TEACHER" ? "선생" : role === "ASSISTANT" ? "직원" : "";
  if (!label) return null;
  return (
    <span
      className="app-header__centerClockRole"
      title={role === "TEACHER" ? "선생님" : "직원"}
    >
      {label}
    </span>
  );
}

function WorkingAvatar({ name, role }: { name: string; role?: "TEACHER" | "ASSISTANT" }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <span
      className="app-header__centerClockAvatar app-header__centerClockAvatar--withRole"
      title={name}
      aria-label={name}
    >
      <RoleLabel role={role} />
      <span className="app-header__centerClockAvatarName">{name}</span>
    </span>
  );
}

export function HeaderCenterStaffClock() {
  const queryClient = useQueryClient();
  const { data: staffMe } = useQuery({ queryKey: ["staff-me"], queryFn: fetchStaffMe });
  const staffId = staffMe?.staff_id;
  const defaultWorkTypeId = staffMe?.default_work_type_id;

  const { data: workingList = [] } = useQuery({
    queryKey: ["work-currently-working"],
    queryFn: fetchCurrentlyWorkingStaff,
    refetchInterval: 30_000,
  });

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
      queryClient.invalidateQueries({ queryKey: ["work-currently-working"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-records"] });
    },
  });

  const endMutation = useMutation({
    mutationFn: (recordId: number) => endWork(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-current", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-currently-working"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-records"] });
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: (recordId: number) => startBreak(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-current", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-currently-working"] });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: (recordId: number) => endBreak(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-current", staffId] });
      queryClient.invalidateQueries({ queryKey: ["work-currently-working"] });
    },
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!current || current.status === "OFF" || !("date" in current) || !("started_at" in current)) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = parseStartedAt(current.date, current.started_at);
    const breakMins = current.break_minutes ?? 0;

    if (current.status === "BREAK" && "break_started_at" in current && current.break_started_at) {
      const breakStartedAt = new Date(current.break_started_at).getTime();
      const frozen = Math.max(0, Math.floor((breakStartedAt - startedAt) / 1000) - breakMins * 60);
      setElapsedSeconds(frozen);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const raw = Math.floor((now - startedAt) / 1000);
      setElapsedSeconds(Math.max(0, raw - breakMins * 60));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [current]);

  const isWorking = current?.status === "WORKING" || current?.status === "BREAK";
  const isOnBreak = (current as WorkCurrentStatus)?.status === "BREAK";
  const workRecordId = current && "work_record_id" in current ? current.work_record_id : null;
  const isStarting = startMutation.isPending;
  const isEnding = endMutation.isPending;
  const isBreakStarting = startBreakMutation.isPending;
  const isBreakEnding = endBreakMutation.isPending;

  const timeLabel = currentLoading
    ? "확인 중..."
    : isWorking
      ? formatElapsed(elapsedSeconds)
      : "0:00";

  return (
    <div className="app-header__centerClock">
      {workingList.length > 0 && (
        <div className="app-header__centerClockAvatars" aria-label="근무 중인 직원">
          {workingList.map((s) => (
            <WorkingAvatar key={s.staff_id} name={s.staff_name} role={s.role} />
          ))}
        </div>
      )}
      <div className="app-header__centerClockTime">
        <span className="app-header__centerClockLabel">총근무 시간</span>
        <span className="app-header__centerClockValue" aria-live="polite">
          {timeLabel}
        </span>
      </div>
      {staffId != null && defaultWorkTypeId != null && (
        <div className="app-header__centerClockActions">
          {isWorking ? (
            <>
              {isOnBreak ? (
                <Button
                  type="button"
                  size="md"
                  disabled={isBreakEnding}
                  onClick={() => workRecordId != null && endBreakMutation.mutate(workRecordId)}
                  className="app-header__clockBtn app-header__clockBtn--resume"
                >
                  {isBreakEnding ? "처리 중…" : "근무"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="md"
                  disabled={isBreakStarting}
                  onClick={() => workRecordId != null && startBreakMutation.mutate(workRecordId)}
                  className="app-header__clockBtn app-header__clockBtn--break"
                >
                  {isBreakStarting ? "처리 중…" : "휴식"}
                </Button>
              )}
              <Button
                type="button"
                size="md"
                disabled={isEnding}
                onClick={() => workRecordId != null && endMutation.mutate(workRecordId)}
                className="app-header__clockBtn app-header__clockBtn--end"
              >
                {isEnding ? "처리 중…" : "퇴근"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="md"
              disabled={isStarting}
              onClick={() => startMutation.mutate()}
              className="app-header__clockBtn app-header__clockBtn--start"
            >
              {isStarting ? "처리 중…" : "출근"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
