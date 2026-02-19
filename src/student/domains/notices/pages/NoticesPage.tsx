/**
 * 공지 목록 페이지 — 학생이 볼 수 있는 모든 공지
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchNotices } from "../api/notices";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";

export default function NoticesPage() {
  const { data: notices, isLoading, isError } = useQuery({
    queryKey: ["student-notices"],
    queryFn: fetchNotices,
  });

  if (isLoading) {
    return (
      <StudentPageShell title="공지사항">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !notices) {
    return (
      <StudentPageShell title="공지사항">
        <EmptyState
          title="공지를 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
        />
      </StudentPageShell>
    );
  }

  if (notices.length === 0) {
    return (
      <StudentPageShell title="공지사항">
        <EmptyState
          title="등록된 공지가 없습니다."
          description="새로운 공지가 등록되면 여기에 표시됩니다."
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="공지사항">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        {notices.map((notice) => {
          const firstNode = notice.mappings?.[0]?.node_detail;
          const lectureTitle = firstNode?.lecture_title;
          
          return (
            <Link
              key={notice.id}
              to={`/student/notices/${notice.id}`}
              className="stu-panel stu-panel--pressable stu-panel--accent"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--stu-space-2)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--stu-space-3)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {notice.title}
                  </div>
                  {notice.content && (
                    <div
                      className="stu-muted"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginTop: 4,
                      }}
                    >
                      {notice.content}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--stu-space-1)" }}>
                <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center" }}>
                  {lectureTitle && (
                    <span
                      className="stu-muted"
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--stu-surface-soft)",
                      }}
                    >
                      {lectureTitle}
                    </span>
                  )}
                  {notice.block_type_label && (
                    <span
                      className="stu-muted"
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--stu-surface-soft)",
                      }}
                    >
                      {notice.block_type_label}
                    </span>
                  )}
                </div>
                <span className="stu-muted" style={{ fontSize: 12 }}>
                  {formatYmd(notice.created_at)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </StudentPageShell>
  );
}
