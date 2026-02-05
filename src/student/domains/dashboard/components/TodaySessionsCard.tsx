// src/student/domains/dashboard/components/TodaySessionsCard.tsx
/**
 * ✅ TodaySessionsCard (MVP)
 * - "오늘 할 일" 카드
 * - 정렬/판단 ❌ (백엔드가 준 순서 그대로)
 */

import { Link } from "react-router-dom";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import SectionHeader from "../../../shared/ui/layout/SectionHeader";
import { DashboardSession } from "@/student/domains/dashboard/api/dashboard";
import { formatYmd } from "@/student/shared/utils/date";

export default function TodaySessionsCard({ sessions }: { sessions: DashboardSession[] }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff", padding: 14 }}>
      <SectionHeader title="오늘 할 일" right={<span style={{ fontSize: 12, color: "#777" }}>차시</span>} />

      {!sessions.length && (
        <EmptyState title="오늘 할 차시가 없습니다." description="백엔드가 내려주는 할 일 목록을 그대로 표시합니다." />
      )}

      {sessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/student/sessions/${s.id}`}
              style={{
                textDecoration: "none",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#111",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{s.title}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#777" }}>
                  {formatYmd(s.date ?? null)}
                  {s.status ? ` · ${s.status}` : ""}
                </div>
              </div>
              <div style={{ color: "#999" }}>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
