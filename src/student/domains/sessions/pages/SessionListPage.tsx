/**
 * 일정 — 내 차시 목록, 유튜브형 카드
 */
import { Link } from "react-router-dom";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";
import { IconCalendar, IconChevronRight } from "@/student/shared/ui/icons/Icons";

export default function SessionListPage() {
  const { data, isLoading, isError } = useMySessions();

  if (isLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <div className="stu-skel" style={{ height: 72, borderRadius: "var(--stu-radius-md)", marginBottom: 8 }} />
        <div className="stu-skel" style={{ height: 72, borderRadius: "var(--stu-radius-md)" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)" }}>일정</h1>
        <EmptyState title="일정을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)" }}>일정</h1>
        <EmptyState title="등록된 차시가 없습니다." description="수강 중인 강의/차시를 확인해주세요." />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)", paddingLeft: "var(--stu-space-2)" }}>
        일정
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        {data.map((s) => (
          <Link
            key={s.id}
            to={`/student/sessions/${s.id}`}
            className="stu-card stu-card--pressable"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--stu-space-4)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--stu-surface-soft)", display: "grid", placeItems: "center" }}>
              <IconCalendar style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{s.title}</div>
              <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                {formatYmd(s.date ?? null)}
                {s.status ? ` · ${s.status}` : ""}
              </div>
            </div>
            <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
