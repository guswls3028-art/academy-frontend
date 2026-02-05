// PATH: src/student/domains/dashboard/components/TodaySessionsCard.tsx

import { Link } from "react-router-dom";
import { DashboardSession } from "../api/dashboard";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import SectionHeader from "@/student/shared/ui/layout/SectionHeader";
import { formatYmd } from "@/student/shared/utils/date";

export default function TodaySessionsCard({
  sessions,
}: {
  sessions: DashboardSession[];
}) {
  return (
    <div className="stu-card">
      <SectionHeader title="오늘 할 일" />

      {(!sessions || sessions.length === 0) && (
        <EmptyState title="오늘 할 차시가 없습니다." />
      )}

      {sessions && sessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/student/sessions/${s.id}`}
              className="stu-list-item"
            >
              <div>
                <div style={{ fontWeight: 800 }}>{s.title}</div>
                <div className="stu-muted" style={{ fontSize: 12 }}>
                  {formatYmd(s.date ?? null)}
                  {s.status ? ` · ${s.status}` : ""}
                </div>
              </div>
              <div style={{ opacity: 0.6 }}>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
