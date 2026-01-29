// src/student/domains/sessions/pages/SessionListPage.tsx
/**
 * ✅ SessionListPage (MVP)
 * - 내 차시 목록
 * - 클릭 -> SessionDetailPage (행동 허브)
 */

import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/components/StudentPageShell";
import EmptyState from "@/student/shared/components/EmptyState";
import { useMySessions } from "@/student/domains/sessions/hooks/useStudentSessions";
import { formatYmd } from "@/student/shared/utils/date";

export default function SessionListPage() {
  const { data, isLoading, isError } = useMySessions();

  return (
    <StudentPageShell title="차시" description="학습할 차시를 선택하세요.">
      {isLoading && <div style={{ fontSize: 14, color: "#666" }}>불러오는 중...</div>}

      {(isError || !data) && (
        <EmptyState title="차시 목록을 불러오지 못했습니다." />
      )}

      {data && data.length === 0 && (
        <EmptyState title="차시가 없습니다." description="수강 중인 강의/차시를 확인해주세요." />
      )}

      {data && data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.map((s) => (
            <Link
              key={s.id}
              to={`/student/sessions/${s.id}`}
              style={{
                textDecoration: "none",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                background: "#fff",
                color: "#111",
              }}
            >
              <div style={{ fontWeight: 800 }}>{s.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#777" }}>
                {formatYmd(s.date ?? null)}
                {s.status ? ` · ${s.status}` : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </StudentPageShell>
  );
}
