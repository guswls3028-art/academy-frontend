// src/student/domains/exams/pages/ExamListPage.tsx
/**
 * ✅ ExamListPage (학생)
 * - 시험 목록
 * - session_id query param 지원 (세션 허브에서 진입 시 유용)
 *
 * 원칙:
 * - OPEN/CLOSED 판단 ❌
 * - 백엔드 필드 그대로 노출 ✅
 */

import { Link, useSearchParams } from "react-router-dom";
import StudentPageShell from "@/student/shared/components/StudentPageShell";
import EmptyState from "@/student/shared/components/EmptyState";
import { useStudentExams } from "@/student/domains/exams/hooks/useStudentExams";
import { formatYmd } from "@/student/shared/utils/date";

export default function ExamListPage() {
  const [sp] = useSearchParams();
  const sessionParam = sp.get("session");
  const sessionId = sessionParam ? Number(sessionParam) : undefined;

  const { data, isLoading, isError } = useStudentExams(
    sessionId ? { session_id: sessionId } : undefined
  );

  const items = data?.items ?? [];

  return (
    <StudentPageShell
      title="시험"
      description={sessionId ? `세션(${sessionId}) 기준 시험 목록` : "전체 시험 목록"}
    >
      {isLoading && <div style={{ fontSize: 14, color: "#666" }}>불러오는 중...</div>}

      {(isError || !data) && <EmptyState title="시험 목록을 불러오지 못했습니다." />}

      {data && items.length === 0 && (
        <EmptyState title="시험이 없습니다." description="등록된 시험이 없거나 접근 권한이 없습니다." />
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((e) => (
            <Link
              key={e.id}
              to={`/student/exams/${e.id}`}
              style={{
                textDecoration: "none",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                background: "#fff",
                color: "#111",
              }}
            >
              <div style={{ fontWeight: 900 }}>{e.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#777" }}>
                open: {formatYmd(e.open_at)} · close: {formatYmd(e.close_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </StudentPageShell>
  );
}
