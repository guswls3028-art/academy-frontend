// PATH: src/app_teacher/domains/comms/pages/CommunicationPage.tsx
// 소통 탭 — 공지사항 / Q&A / 등록요청 3탭 통합
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { fetchPosts, fetchRegistrationRequests } from "../api";
import type { Post, RegistrationRequest } from "../api";
import PostListItem from "../components/PostListItem";
import PostDetail from "../components/PostDetail";
import RegistrationRequestList from "../components/RegistrationRequestList";

type Tab = "notices" | "qna" | "requests";

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("notices");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { counts } = useAdminNotificationCounts();

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["teacher-comms", tab],
    queryFn: () => fetchPosts(tab === "notices" ? "notice" : "qna"),
    enabled: tab !== "requests",
  });

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ["teacher-registration-requests"],
    queryFn: () => fetchRegistrationRequests("pending"),
    enabled: tab === "requests",
  });

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "notices", label: "공지사항" },
    { key: "qna", label: "Q&A", badge: counts?.qnaPending },
    { key: "requests", label: "등록요청", badge: counts?.registrationRequestsPending },
  ];

  // 게시글 상세 보기
  if (selectedPost) {
    return <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--tc-border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 text-sm cursor-pointer relative"
            style={{
              padding: 12,
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--tc-primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              fontWeight: tab === t.key ? 700 : 500,
            }}
          >
            {t.label}
            {!!t.badge && t.badge > 0 && (
              <span
                className="absolute text-[10px] font-bold text-white rounded-full"
                style={{
                  top: 6,
                  right: "calc(50% - 24px)",
                  minWidth: 16,
                  height: 16,
                  lineHeight: "16px",
                  padding: "0 4px",
                  background: "var(--tc-danger)",
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col" style={{ paddingTop: "var(--tc-space-2)" }}>
        {tab === "requests" ? (
          reqLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : reqData && reqData.results.length > 0 ? (
            <RegistrationRequestList requests={reqData.results} />
          ) : (
            <EmptyState scope="panel" tone="empty" title="대기 중인 등록요청이 없습니다" />
          )
        ) : postsLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : posts && posts.length > 0 ? (
          <div className="flex flex-col">
            {posts.map((p) => (
              <PostListItem
                key={p.id}
                post={p}
                showReplyBadge={tab === "qna"}
                onClick={() => setSelectedPost(p)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            scope="panel"
            tone="empty"
            title={tab === "notices" ? "공지사항이 없습니다" : "Q&A가 없습니다"}
          />
        )}
      </div>
    </div>
  );
}
