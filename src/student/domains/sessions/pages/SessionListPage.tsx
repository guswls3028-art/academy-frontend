/**
 * 일정 — 클리닉처럼 달력 제공, 날짜 클릭 시 그날 상세 일정 표시
 * 달력은 영역이 작으므로 요약만(날짜+일정 있으면 점), 상세는 아래 영역에 표시
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import ScheduleCalendar from "@/student/shared/ui/components/ScheduleCalendar";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import type { StudentSession } from "@/student/domains/sessions/api/sessions";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";
import { IconCalendar, IconChevronRight } from "@/student/shared/ui/icons/Icons";

function toDateKey(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

export default function SessionListPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data: sessions = [], isLoading, isError } = useMySessions();

  const datesWithSessions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (key) set.add(key);
    });
    return Array.from(set);
  }, [sessions]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, StudentSession[]>();
    sessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.date || "").localeCompare(b.date || "")));
    return map;
  }, [sessions]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsByDate.get(selectedDate) ?? [];
  }, [selectedDate, sessionsByDate]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  if (isLoading) {
    return (
      <StudentPageShell title="일정" description="내 차시 일정">
        <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-md)", marginBottom: "var(--stu-space-4)" }} />
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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-5)" }}>
        {/* 소형 달력 (요약만) */}
        <ScheduleCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          datesWithSessions={datesWithSessions}
        />

        {/* 선택한 날짜의 상세 일정 */}
        {selectedDate ? (
          <div className="stu-section stu-section--nested">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
              {formatYmd(selectedDate)} 일정
            </div>
            {selectedDaySessions.length === 0 ? (
              <EmptyState
                title="해당 날짜에 일정이 없습니다."
                description="다른 날짜를 선택해 보세요."
                compact
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {selectedDaySessions.map((s) => {
                  const status = (s.status ?? "").toLowerCase();
                  const panelVariant =
                    status.includes("완료") || status.includes("종료")
                      ? "stu-panel--complete"
                      : status.includes("임박") || status.includes("마감")
                        ? "stu-panel--danger"
                        : status.includes("예정") || status.includes("진행")
                          ? "stu-panel--action"
                          : "stu-panel--nav";
                  return (
                    <Link
                      key={s.id}
                      to={`/student/sessions/${s.id}`}
                      className={`stu-panel stu-panel--pressable stu-panel--accent ${panelVariant}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--stu-space-4)",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: "var(--stu-surface-soft)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <IconCalendar style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{s.title}</div>
                        <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                          {s.status ? ` · ${s.status}` : ""}
                        </div>
                      </div>
                      <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-6)", fontSize: 14 }}>
            날짜를 선택하면 해당 날의 일정이 여기에 표시됩니다.
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
