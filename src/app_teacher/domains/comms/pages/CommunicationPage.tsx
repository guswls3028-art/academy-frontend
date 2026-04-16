// PATH: src/app_teacher/domains/comms/pages/CommunicationPage.tsx
// 소통 — 5탭 (공지/Q&A/등록요청/게시판/자료) — 데스크톱 커뮤니티 1:1
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchPosts, fetchRegistrationRequests } from "../api";
import type { Post } from "../api";
import PostListItem from "../components/PostListItem";
import PostDetail from "../components/PostDetail";
import RegistrationRequestList from "../components/RegistrationRequestList";

type Tab = "notices" | "qna" | "requests" | "board" | "materials";

const POST_TYPE_MAP: Record<Tab, string> = {
  notices: "notice",
  qna: "qna",
  requests: "",
  board: "board",
  materials: "materials",
};

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("notices");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { counts } = useAdminNotificationCounts();

  const postType = POST_TYPE_MAP[tab];
  const isPostTab = tab !== "requests";

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["teacher-comms", tab],
    queryFn: () => fetchPosts(postType),
    enabled: isPostTab,
  });

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ["teacher-registration-requests"],
    queryFn: () => fetchRegistrationRequests("pending"),
    enabled: tab === "requests",
  });

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "notices", label: "공지사항" },
    { key: "qna", label: "Q&A", badge: counts?.qnaPending },
    { key: "requests", label: "가입신청", badge: counts?.registrationRequestsPending },
    { key: "board", label: "게시판" },
    { key: "materials", label: "자료" },
  ];

  if (selectedPost) {
    return <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <div className="flex flex-col gap-0">
      {/* 5탭 — 가로 스크롤 */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: "1px solid var(--tc-border)", WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="shrink-0 text-[13px] cursor-pointer relative"
            style={{
              padding: "12px 14px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--tc-primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              fontWeight: tab === t.key ? 700 : 500,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {!!t.badge && t.badge > 0 && (
              <span
                className="absolute text-[9px] font-bold text-white rounded-full"
                style={{
                  top: 4,
                  right: 2,
                  minWidth: 14,
                  height: 14,
                  lineHeight: "14px",
                  padding: "0 3px",
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
          <EmptyState scope="panel" tone="empty" title={emptyTitle(tab)} />
        )}
      </div>
    </div>
  );
}

function emptyTitle(tab: Tab): string {
  const map: Record<Tab, string> = {
    notices: "공지사항이 없습니다",
    qna: "Q&A가 없습니다",
    requests: "가입 신청이 없습니다",
    board: "게시글이 없습니다",
    materials: "자료가 없습니다",
  };
  return map[tab];
}
