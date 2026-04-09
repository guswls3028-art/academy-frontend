/**
 * 일정 — 3탭: 내 일정(달력) | 예약 | 지난 일정
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import ScheduleCalendar from "@/student/shared/ui/components/ScheduleCalendar";
import type { DateStatusColor } from "@/student/shared/ui/components/ScheduleCalendar";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import type { StudentSession } from "@/student/domains/sessions/api/sessions";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";
import { IconCalendar, IconClinic, IconChevronRight } from "@/student/shared/ui/icons/Icons";

function toDateKey(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

type ScheduleTab = "calendar" | "upcoming" | "past";

const TAB_ITEMS: { key: ScheduleTab; label: string }[] = [
  { key: "calendar", label: "내 일정" },
  { key: "upcoming", label: "예약" },
  { key: "past", label: "지난 일정" },
];

export default function SessionListPage() {
  const [tab, setTab] = useState<ScheduleTab>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data: sessions = [], isLoading, isError } = useMySessions();

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  // 날짜별 그룹
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, StudentSession[]>();
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
    return map;
  }, [sessions]);

  // 예약 (오늘 이후 + clinic 예약)
  const upcomingSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const d = toDateKey(s.date);
        if (!d) return false;
        return d >= today;
      })
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [sessions, today]);

  // 지난 일정 (오늘 이전)
  const pastSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const d = toDateKey(s.date);
        if (!d) return false;
        return d < today;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")); // 최신순
  }, [sessions, today]);

  const datesWithSessions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (key) set.add(key);
    });
    return Array.from(set);
  }, [sessions]);

  const dateStatusMap = useMemo(() => {
    const map: Record<string, DateStatusColor> = {};
    sessionsByDate.forEach((arr, date) => {
      const statuses = arr.map((s) => (s.status ?? "").toLowerCase());
      if (statuses.some((st) => st.includes("임박") || st.includes("마감"))) {
        map[date] = "danger";
      } else if (statuses.some((st) => st.includes("예정") || st.includes("진행") || st.includes("예약"))) {
        map[date] = "action";
      } else if (statuses.some((st) => st.includes("완료") || st.includes("종료"))) {
        map[date] = "complete";
      }
    });
    return map;
  }, [sessionsByDate]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsByDate.get(selectedDate) ?? [];
  }, [selectedDate, sessionsByDate]);

  if (isLoading) {
    return (
      <StudentPageShell title="일정" description="내 차시 일정">
        <div className="stu-skel" style={{ height: 48, borderRadius: "var(--stu-radius-md)", marginBottom: 8 }} />
        <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-md)", marginBottom: 8 }} />
        <div className="stu-skel" style={{ height: 72, borderRadius: "var(--stu-radius-md)" }} />
      </StudentPageShell>
    );
  }

  if (isError || !sessions) {
    return (
      <StudentPageShell title="일정">
        <EmptyState title="일정을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="일정" description="날짜를 누르면 해당 날의 일정을 볼 수 있어요.">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {/* 3탭 */}
        <TabBar items={TAB_ITEMS} value={tab} onChange={setTab} counts={{ upcoming: upcomingSessions.length, past: pastSessions.length }} />

        {/* 내 일정 탭: 달력 */}
        {tab === "calendar" && (
          <>
            <ScheduleCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              datesWithSessions={datesWithSessions}
              dateStatusMap={dateStatusMap}
            />
            {selectedDate ? (
              <div className="stu-section stu-section--nested">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
                  {formatYmd(selectedDate)} 일정
                </div>
                {selectedDaySessions.length === 0 ? (
                  <EmptyState title="해당 날짜에 일정이 없습니다." description="다른 날짜를 선택해 보세요." compact />
                ) : (
                  <SessionList sessions={selectedDaySessions} />
                )}
              </div>
            ) : (
              <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-6)", fontSize: 14 }}>
                날짜를 선택하면 해당 날의 일정이 여기에 표시됩니다.
              </div>
            )}
          </>
        )}

        {/* 예약 탭 */}
        {tab === "upcoming" && (
          upcomingSessions.length === 0 ? (
            <EmptyState title="예약된 일정이 없습니다." description="수업이나 클리닉이 예약되면 여기에 표시됩니다." />
          ) : (
            <SessionList sessions={upcomingSessions} showDate />
          )
        )}

        {/* 지난 일정 탭 */}
        {tab === "past" && (
          pastSessions.length === 0 ? (
            <EmptyState title="지난 일정이 없습니다." description="완료된 수업과 클리닉이 여기에 기록됩니다." />
          ) : (
            <>
              <div className="stu-muted" style={{ fontSize: 13, textAlign: "center", padding: "2px 0 4px" }}>
                총 {pastSessions.length}건의 지난 일정
              </div>
              <SessionList sessions={pastSessions} showDate isPast />
            </>
          )
        )}
      </div>
    </StudentPageShell>
  );
}

// ─── Tab Bar ───
function TabBar<T extends string>({
  items,
  value,
  onChange,
  counts,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        padding: 3,
        background: "var(--stu-surface-soft)",
        borderRadius: 12,
      }}
    >
      {items.map(({ key, label }) => {
        const active = value === key;
        const count = counts?.[key as string];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderRadius: 9,
              background: active ? "var(--stu-surface)" : "transparent",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--stu-text)" : "var(--stu-text-muted)",
              boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)" : undefined,
              cursor: "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <span>{label}</span>
            {count != null && count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: active ? "var(--stu-primary)" : "rgba(17,17,17,0.08)",
                  color: active ? "#fff" : "var(--stu-text-muted)",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Session List ───
function SessionList({
  sessions,
  showDate,
  isPast,
}: {
  sessions: StudentSession[];
  showDate?: boolean;
  isPast?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
      {sessions.map((s) => {
        const isClinic = s.type === "clinic";
        const linkTo = isClinic ? "/student/clinic" : `/student/sessions/${s.id}`;
        const status = (s.status ?? "").toLowerCase();
        const panelVariant = isPast
          ? "stu-panel--complete"
          : status.includes("완료") || status.includes("종료")
            ? "stu-panel--complete"
            : status.includes("임박") || status.includes("마감")
              ? "stu-panel--danger"
              : status.includes("예정") || status.includes("진행") || status.includes("예약")
                ? "stu-panel--action"
                : "stu-panel--nav";
        return (
          <Link
            key={s.id}
            to={linkTo}
            className={`stu-panel stu-panel--pressable stu-panel--accent ${panelVariant}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--stu-space-4)",
              textDecoration: "none",
              color: "inherit",
              opacity: isPast ? 0.7 : 1,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: isClinic ? "rgba(16,185,129,0.1)" : isPast ? "var(--stu-surface-soft)" : "var(--stu-surface-soft)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {isClinic
                ? <IconClinic style={{ width: 22, height: 22, color: isPast ? "var(--stu-text-muted)" : "var(--stu-success, #10b981)" }} />
                : <IconCalendar style={{ width: 22, height: 22, color: isPast ? "var(--stu-text-muted)" : "var(--stu-primary)" }} />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: isPast ? 600 : 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.title}
              </div>
              <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                {showDate && s.date && <>{formatYmd(s.date)} · </>}
                {s.start_time && s.start_time.slice(0, 5)}
                {s.status ? ` · ${s.status}` : isPast ? " · 완료" : ""}
              </div>
            </div>
            <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)", flexShrink: 0 }} />
          </Link>
        );
      })}
    </div>
  );
}
