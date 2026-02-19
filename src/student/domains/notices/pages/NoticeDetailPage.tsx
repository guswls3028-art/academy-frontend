/**
 * 공지 상세 페이지
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchNoticeDetail } from "../api/notices";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const noticeId = id ? Number(id) : null;

  const { data: notice, isLoading, isError } = useQuery({
    queryKey: ["student-notice", noticeId],
    queryFn: () => (noticeId != null ? fetchNoticeDetail(noticeId) : Promise.resolve(null)),
    enabled: noticeId != null,
  });

  if (isLoading) {
    return (
      <StudentPageShell title="공지사항">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !notice || noticeId == null) {
    return (
      <StudentPageShell title="공지사항">
        <EmptyState
          title="공지를 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
        />
      </StudentPageShell>
    );
  }

  const firstNode = notice.mappings?.[0]?.node_detail;
  const lectureTitle = firstNode?.lecture_title;

  return (
    <StudentPageShell title="공지사항">
      <div className="stu-section stu-section--nested">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          {/* 제목 */}
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: "var(--stu-space-3)" }}>
              {notice.title}
            </h1>
            <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
              {lectureTitle && (
                <span
                  className="stu-muted"
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
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
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "var(--stu-surface-soft)",
                  }}
                >
                  {notice.block_type_label}
                </span>
              )}
              <span className="stu-muted" style={{ fontSize: 13 }}>
                {formatYmd(notice.created_at)}
              </span>
            </div>
          </div>

          {/* 내용 */}
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--stu-text)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {notice.content || "내용이 없습니다."}
          </div>

          {/* 목록으로 돌아가기 */}
          <div style={{ marginTop: "var(--stu-space-4)", paddingTop: "var(--stu-space-4)", borderTop: "1px solid var(--stu-border)" }}>
            <Link
              to="/student/notices"
              className="stu-btn stu-btn--secondary stu-btn--sm"
              style={{ display: "inline-block" }}
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}
