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
        <EmptyState title="일정을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: "var(--stu-space-4) 0" }}>
        <EmptyState title="등록된 차시가 없습니다." description="수강 중인 강의/차시를 확인해주세요." />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        {data.map((s) => {
          // 상태 기반 Panel variant 결정
          const getPanelVariant = () => {
            const status = s.status?.toLowerCase() || "";
            if (status.includes("완료") || status.includes("종료")) {
              return "stu-panel--complete";
            }
            if (status.includes("임박") || status.includes("마감")) {
              return "stu-panel--danger";
            }
            if (status.includes("예정") || status.includes("진행")) {
              return "stu-panel--action";
            }
            return "stu-panel--nav";
          };

          return (
            <Link
              key={s.id}
              to={`/student/sessions/${s.id}`}
              className={`stu-panel stu-panel--pressable stu-panel--accent ${getPanelVariant()}`}
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
          );
        })}
      </div>
    </div>
  );
}
