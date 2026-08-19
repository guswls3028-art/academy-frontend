 
// PATH: src/app_admin/domains/staff/components/HeaderCenterStaffClock.tsx
// 헤더 중앙: 근무 중인 직원(직급 아바타 + 이름) + 총근무 시간 + 출근(초록)/휴식(노랑)/퇴근(빨강)

import { useState, useEffect } from "react";
import type { CurrentlyWorkingItem } from "@/features/staff-clock/api";
import {
  useCurrentlyWorkingStaff,
  useStaffClock,
} from "@/features/staff-clock/useStaffClock";
import {
  workElapsedLabel,
  workElapsedSeconds,
} from "@/features/staff-clock/time";
import { Dropdown } from "antd";
import { Button } from "@/shared/ui/ds";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import type { StaffRoleType } from "@/shared/ui/avatars";

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
    const tick = () => setElapsedSeconds(workElapsedSeconds(item));
    tick();
    if (item.break_started_at) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [item]);

  const timeLabel = item.date && item.started_at ? workElapsedLabel(elapsedSeconds) : "—";

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
  const clock = useStaffClock();
  const { data: workingList = [] } = useCurrentlyWorkingStaff();
  const staffMe = clock.staffMeQ.data;
  const timeLabel = clock.currentQ.isLoading
    ? "확인 중..."
    : clock.timeLabel;

  const sortedWorkingList = [...workingList].sort(
    (a, b) => (ROLE_ORDER[a.role ?? ""] ?? 99) - (ROLE_ORDER[b.role ?? ""] ?? 99)
  );

  const hasVisibleClockContent = sortedWorkingList.length > 0 || !staffMe?.is_owner;
  if (!hasVisibleClockContent) return null;

  return (
    <div className="app-header__centerClock">
      {sortedWorkingList.length > 0 && (
        <>
          <div className="app-header__centerClockAvatars" aria-label="근무 중인 직원">
            {sortedWorkingList.map((s) => (
              <WorkingAvatar key={s.staff_id} item={s} />
            ))}
          </div>
          <span className="app-header__centerClockDivider" />
        </>
      )}
      {/* WORK TIME 표기 + 본인 출퇴근 컨트롤은 owner 에게 잡음.
          "본인 시급 정산"이 필요 없는 학원장이 매번 노출되는 것을 hide (시각 검수 M-1).
          owner 도 본인 staff record가 있으면 staff/근태 페이지에서 등록 가능. */}
      {!staffMe?.is_owner && (
        <div className="app-header__centerClockTime">
          <span className="app-header__centerClockLabel">WORK TIME</span>
          <span className="app-header__centerClockValue" aria-live="polite">
            {timeLabel}
          </span>
        </div>
      )}
      {clock.canUseClock && clock.assignedWorkTypes.length > 0 && (
        <>
          <span className="app-header__centerClockDivider" />
          <div className="app-header__centerClockActions">
            {clock.isWorking ? (
              <>
                {clock.isOnBreak ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={clock.isBreakEnding}
                    onClick={() => void clock.endBreak().catch(() => undefined)}
                    className="app-header__clockBtn app-header__clockBtn--resume"
                  >
                    {clock.isBreakEnding ? "..." : "근무"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={clock.isBreakStarting}
                    onClick={() => void clock.startBreak().catch(() => undefined)}
                    className="app-header__clockBtn app-header__clockBtn--break"
                  >
                    {clock.isBreakStarting ? "..." : "휴식"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={clock.isEnding}
                  onClick={() => void clock.endWork().catch(() => undefined)}
                  className="app-header__clockBtn app-header__clockBtn--end"
                >
                  {clock.isEnding ? "..." : "퇴근"}
                </Button>
              </>
            ) : (
              clock.assignedWorkTypes.length === 1 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={clock.isStarting}
                  onClick={() => void clock.startWork(clock.assignedWorkTypes[0]).catch(() => undefined)}
                  className="app-header__clockBtn app-header__clockBtn--start"
                  title={clock.assignedWorkTypes[0].name}
                >
                  {clock.isStarting ? "..." : "출근"}
                </Button>
              ) : (
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: clock.assignedWorkTypes.map((workType) => ({
                      key: String(workType.id),
                      label: `${workType.name} · ${workType.hourly_wage.toLocaleString()}원`,
                    })),
                    onClick: ({ key }) => {
                      const selected = clock.assignedWorkTypes.find(
                        (workType) => workType.id === Number(key),
                      );
                      if (selected) void clock.startWork(selected).catch(() => undefined);
                    },
                  }}
                >
                  <Button
                    type="button"
                    size="sm"
                    disabled={clock.isStarting}
                    className="app-header__clockBtn app-header__clockBtn--start"
                  >
                    {clock.isStarting ? "..." : "출근 유형 선택"}
                  </Button>
                </Dropdown>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
