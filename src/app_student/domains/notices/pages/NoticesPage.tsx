/**
 * 공지 목록 페이지 — 전체공지 / 강의공지 / 차시공지 탭
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchNotices, type PostEntity } from "../api/notices.api";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { richHtmlToPreviewText } from "@/shared/utils/richHtml";

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
    queryKey: studentQueryKeys.notices,
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
        <div className="stu-skel-stack stu-skel-stack--compact">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stu-skel stu-skel--lg" />
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
      <div className="student-notice-tabs">
        {TAB_CONFIG.map(({ key, label }) => {
          const isActive = activeTab === key;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`student-notice-tab${isActive ? " student-notice-tab--active" : ""}`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`student-notice-tab__count${isActive ? " student-notice-tab__count--active" : ""}`}
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
        <div className="student-notice-list">
          {filtered.map((notice) => {
            const mappingNode = notice.mappings?.[0]?.node_detail;
            const lectureTitle = mappingNode?.lecture_title;
            const sessionTitle = mappingNode?.session_title;
            const isSessionLevel = mappingNode?.level === "SESSION";

            return (
              <Link
                key={notice.id}
                to={`/student/notices/${notice.id}`}
                className={`student-notice-card stu-panel stu-panel--pressable${(notice.is_urgent || notice.is_pinned) ? " stu-panel--accent" : ""}`}
              >
                <div className="student-notice-card__head">
                  <div className="student-notice-card__body">
                    <div className="student-notice-card__title-row">
                      {notice.is_urgent && (
                        <span className="student-notice-card__badge student-notice-card__badge--urgent">긴급</span>
                      )}
                      {notice.is_pinned && !notice.is_urgent && (
                        <span className="student-notice-card__badge student-notice-card__badge--pinned">고정</span>
                      )}
                      <span className="student-notice-card__title">{notice.title}</span>
                    </div>
                    {notice.content && (() => {
                      const preview = richHtmlToPreviewText(notice.content, 80);
                      return preview ? (
                        <div
                          className="stu-muted student-notice-card__preview"
                        >
                          {preview}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="student-notice-card__meta">
                  <div className="student-notice-card__scopes">
                    {lectureTitle && (
                      <span
                        className={`student-notice-card__scope${isSessionLevel ? " student-notice-card__scope--primary" : ""}`}
                      >
                        {lectureTitle}
                      </span>
                    )}
                    {sessionTitle && (
                      <span
                        className="student-notice-card__scope student-notice-card__scope--session"
                      >
                        {sessionTitle}
                      </span>
                    )}
                  </div>
                  <span className="stu-muted student-notice-card__date">
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
