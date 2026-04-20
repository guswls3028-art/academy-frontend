/**
 * 공지 목록 페이지 — 전체공지 / 강의공지 / 차시공지 탭
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchNotices } from "../api/notices.api";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import type { PostEntity } from "@admin/domains/community/api/community.api";

/** HTML 태그를 제거하고 순수 텍스트만 추출 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

type NoticeTab = "all" | "lecture" | "session";

const TAB_CONFIG: { key: NoticeTab; label: string }[] = [
  { key: "all", label: "전체공지" },
  { key: "lecture", label: "강의공지" },
  { key: "session", label: "차시공지" },
];

function filterNotices(notices: PostEntity[], tab: NoticeTab): PostEntity[] {
  if (tab === "all") return notices;
  if (tab === "lecture") return notices.filter((n) => n.mappings?.some((m) => m.node_detail?.level === "COURSE"));
  if (tab === "session") return notices.filter((n) => n.mappings?.some((m) => m.node_detail?.level === "SESSION"));
  return notices;
}

export default function NoticesPage() {
  const [activeTab, setActiveTab] = useState<NoticeTab>("all");

  const { data: notices, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-notices"],
    queryFn: fetchNotices,
  });

  const lectureCount = notices ? filterNotices(notices, "lecture").length : 0;
  const sessionCount = notices ? filterNotices(notices, "session").length : 0;
  const allCount = notices?.length ?? 0;

  const counts: Record<NoticeTab, number> = {
    all: allCount,
    lecture: lectureCount,
    session: sessionCount,
  };

  const filtered = notices ? filterNotices(notices, activeTab) : [];

  if (isLoading) {
    return (
      <StudentPageShell title="공지사항">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius-md)" }} />
          ))}
        </div>
      </StudentPageShell>
    );
  }

  if (isError || !notices) {
    return (
      <StudentPageShell title="공지사항">
        <EmptyState
          title="공지를 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
          onRetry={() => refetch()}
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="공지사항">
      {/* 탭 */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--stu-surface-soft)",
          borderRadius: 10,
          marginBottom: "var(--stu-space-6)",
        }}
      >
        {TAB_CONFIG.map(({ key, label }) => {
          const isActive = activeTab === key;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                padding: "8px 6px",
                border: "none",
                borderRadius: 7,
                background: isActive ? "var(--stu-surface)" : "transparent",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--stu-text)" : "var(--stu-text-muted)",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
                cursor: "pointer",
                transition: "all var(--stu-motion-fast)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                letterSpacing: "-0.01em",
              }}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 999,
                    background: isActive ? "var(--stu-primary)" : "rgba(17,17,17,0.1)",
                    color: isActive ? "#fff" : "var(--stu-text-muted)",
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <EmptyState
          title={
            activeTab === "all"
              ? "등록된 공지가 없습니다."
              : activeTab === "lecture"
              ? "강의 공지가 없습니다."
              : "차시 공지가 없습니다."
          }
          description="새로운 공지가 등록되면 여기에 표시됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          {filtered.map((notice) => {
            const mappingNode = notice.mappings?.[0]?.node_detail;
            const lectureTitle = mappingNode?.lecture_title;
            const sessionTitle = mappingNode?.session_title;
            const isSessionLevel = mappingNode?.level === "SESSION";

            return (
              <Link
                key={notice.id}
                to={`/student/notices/${notice.id}`}
                className={`stu-panel stu-panel--pressable${(notice.is_urgent || notice.is_pinned) ? " stu-panel--accent" : ""}`}
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
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      {notice.is_urgent && (
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--stu-danger, #ef4444)", borderRadius: 4, padding: "1px 6px", lineHeight: 1.5 }}>긴급</span>
                      )}
                      {notice.is_pinned && !notice.is_urgent && (
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--stu-primary)", background: "color-mix(in srgb, var(--stu-primary) 12%, transparent)", borderRadius: 4, padding: "1px 6px", lineHeight: 1.5 }}>고정</span>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notice.title}</span>
                    </div>
                    {notice.content && (() => {
                      const preview = stripHtml(notice.content);
                      return preview ? (
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
                          {preview}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--stu-space-1)" }}>
                  <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
                    {lectureTitle && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isSessionLevel ? "color-mix(in srgb, var(--stu-primary) 10%, transparent)" : "var(--stu-surface-soft)",
                          color: isSessionLevel ? "var(--stu-primary)" : "var(--stu-text-muted)",
                          border: isSessionLevel ? "1px solid color-mix(in srgb, var(--stu-primary) 18%, transparent)" : "none",
                        }}
                      >
                        {lectureTitle}
                      </span>
                    )}
                    {sessionTitle && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "color-mix(in srgb, var(--stu-primary) 12%, transparent)",
                          color: "var(--stu-primary)",
                          border: "1px solid color-mix(in srgb, var(--stu-primary) 20%, transparent)",
                        }}
                      >
                        {sessionTitle}
                      </span>
                    )}
                  </div>
                  <span className="stu-muted" style={{ fontSize: 12, flexShrink: 0 }}>
                    {formatYmd(notice.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </StudentPageShell>
  );
}
