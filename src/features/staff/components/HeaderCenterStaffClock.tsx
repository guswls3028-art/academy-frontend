// PATH: src/features/staff/components/HeaderCenterStaffClock.tsx
// 헤더 중앙: 근무 중인 직원(직급 아바타 + 이름) + 총근무 시간 + 출근(초록)/휴식(노랑)/퇴근(빨강)

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
import type { WorkCurrentStatus, CurrentlyWorkingItem } from "../api/workRecords.api";
import { Dropdown } from "antd";
import { Button } from "@/shared/ui/ds";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import type { StaffRoleType } from "@/shared/ui/avatars";

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

/** 직급 순서: 높은 순 좌측 배치 (대표 → 강사 → 조교) */
const ROLE_ORDER: Record<string, number> = { owner: 0, OWNER: 0, TEACHER: 1, ASSISTANT: 2 };

/** 드롭다운 내용: 직급 아이콘 + 이름 + 근무시간 (해당 직원의 date/started_at/break 기준 경과 시간) */
function WorkingStaffDropdownContent({ item }: { item: CurrentlyWorkingItem }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const normalized = item.role === "owner" || item.role === "OWNER" ? "owner" : item.role === "TEACHER" ? "TEACHER" : "ASSISTANT";
  const roleForAvatar: StaffRoleType = normalized as StaffRoleType;

  useEffect(() => {
    if (!item.date || !item.started_at) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = parseStartedAt(item.date, item.started_at);
    const breakSeconds = item.break_total_seconds ?? ((item.break_minutes ?? 0) * 60);
    if (item.break_started_at) {
      const breakStartedAt = new Date(item.break_started_at).getTime();
      const frozen = Math.max(0, Math.floor((breakStartedAt - startedAt) / 1000) - breakSeconds);
      setElapsedSeconds(frozen);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const raw = Math.floor((now - startedAt) / 1000);
      setElapsedSeconds(Math.max(0, raw - breakSeconds));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [item.date, item.started_at, item.break_minutes, item.break_total_seconds, item.break_started_at]);

  const timeLabel = item.date && item.started_at ? formatElapsed(elapsedSeconds) : "—";

  return (
    <div className="app-header__workingStaffDropdown">
      <div className="app-header__workingStaffDropdownRow">
        <StaffRoleAvatar role={roleForAvatar} size={20} className="text-[var(--color-primary)] shrink-0" />
        <span className="app-header__workingStaffDropdownName">{item.staff_name}</span>
      </div>
      <div className="app-header__workingStaffDropdownMeta">
        <span className="app-header__workingStaffDropdownLabel">근무시간</span>
        <span className="app-header__workingStaffDropdownValue">{timeLabel}</span>
      </div>
    </div>
  );
}

/** 직급 아바타 위, 이름 아래 + 온라인 느낌 초록 애니메이션.
 * role은 API(직원관리와 동일한 실제 데이터) 기준: owner=대표(왕관), TEACHER=강사(학사모), ASSISTANT=조교. */
function WorkingAvatar({ item }: { item: CurrentlyWorkingItem }) {
  const normalized = item.role === "owner" || item.role === "OWNER" ? "owner" : item.role === "TEACHER" ? "TEACHER" : "ASSISTANT";
  const roleForAvatar: StaffRoleType = normalized as StaffRoleType;
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomLeft"
      popupRender={() => (
        <div className="ds-header-dropdown app-header__workingStaffDropdownWrap">
          <WorkingStaffDropdownContent item={item} />
        </div>
      )}
    >
      <span
        role="button"
        tabIndex={0}
        className="app-header__centerClockAvatarCard app-header__centerClockAvatarCard--online app-header__centerClockAvatarCard--clickable"
        title={item.staff_name}
        aria-label={`${item.staff_name} 근무 정보 보기`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.preventDefault();
        }}
      >
        <span className="app-header__centerClockAvatarIcon">
          <StaffRoleAvatar role={roleForAvatar} size={12} className="text-[var(--color-primary)]" />
        </span>
        <span className="app-header__centerClockAvatarName">{item.staff_name}</span>
      </span>
    </Dropdown>
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
  /** 휴식 클릭 직후 서버 응답 전까지 표시할 일시정지 시간(초). 있으면 시계를 이 값으로 고정. */
  const [optimisticPausedElapsed, setOptimisticPausedElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!current || current.status === "OFF" || !("date" in current) || !("started_at" in current)) {
      setElapsedSeconds(0);
      setOptimisticPausedElapsed(null);
      return;
    }
    if (current.status === "WORKING") {
      setOptimisticPausedElapsed(null);
    }
    const startedAt = parseStartedAt(current.date, current.started_at);
    const breakSeconds = current.break_total_seconds ?? ((current.break_minutes ?? 0) * 60);

    if (current.status === "BREAK" && "break_started_at" in current && current.break_started_at) {
      const breakStartedAt = new Date(current.break_started_at).getTime();
      const frozen = Math.max(0, Math.floor((breakStartedAt - startedAt) / 1000) - breakSeconds);
      setElapsedSeconds(frozen);
      setOptimisticPausedElapsed(null);
      return;
    }

    if (optimisticPausedElapsed !== null) {
      return;
    }

    const tick = () => {
      const now = Date.now();
      const raw = Math.floor((now - startedAt) / 1000);
      setElapsedSeconds(Math.max(0, raw - breakSeconds));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [current, optimisticPausedElapsed]);

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
      ? formatElapsed(optimisticPausedElapsed ?? elapsedSeconds)
      : "0:00";

  const sortedWorkingList = [...workingList].sort(
    (a, b) => (ROLE_ORDER[a.role ?? ""] ?? 99) - (ROLE_ORDER[b.role ?? ""] ?? 99)
  );

  return (
    <div className="app-header__centerClock">
      {sortedWorkingList.length > 0 && (
        <div className="app-header__centerClockAvatars" aria-label="근무 중인 직원">
          {sortedWorkingList.map((s) => (
            <WorkingAvatar key={s.staff_id} item={s} />
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
                  onClick={() => {
                    if (workRecordId == null) return;
                    setOptimisticPausedElapsed(elapsedSeconds);
                    startBreakMutation.mutate(workRecordId);
                  }}
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
