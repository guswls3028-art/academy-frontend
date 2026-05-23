// PATH: src/app_teacher/domains/comms/pages/CommunicationPage.tsx
// 소통 — 5탭 (공지/Q&A/등록요청/게시판/자료) + 작성 + 검색
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Search, Plus, X } from "@teacher/shared/ui/Icons";
import { fetchPosts, fetchRegistrationRequests } from "../api";
import type { Post } from "../api";
import PostListItem from "../components/PostListItem";
import PostDetail from "../components/PostDetail";
import RegistrationRequestList from "../components/RegistrationRequestList";
import CreatePostSheet from "../components/CreatePostSheet";
import styles from "./CommunicationPage.module.css";

type Tab = "notices" | "qna" | "counsel" | "requests" | "board" | "materials";

const POST_TYPE_MAP: Record<Tab, string> = {
  notices: "notice",
  qna: "qna",
  counsel: "counsel",
  requests: "",
  board: "board",
  materials: "materials",
};

const TAB_LABELS: Record<Tab, string> = {
  notices: "공지사항",
  qna: "QnA",
  counsel: "상담 신청",
  requests: "가입신청",
  board: "게시판",
  materials: "자료실",
};

// Tabs that support post creation by staff
const WRITABLE_TABS: Tab[] = ["notices", "board", "materials"];

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("notices");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { counts } = useTeacherPendingCounts();

  const postType = POST_TYPE_MAP[tab];
  const isPostTab = tab !== "requests";
  const canWrite = WRITABLE_TABS.includes(tab);

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["teacher-comms", tab, searchQuery],
    queryFn: () => fetchPosts(postType, 50, searchQuery || undefined),
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
    { key: "counsel", label: "상담", badge: counts?.counselPending },
    { key: "requests", label: "가입신청", badge: counts?.registrationRequestsPending },
    { key: "board", label: "게시판" },
    { key: "materials", label: "자료" },
  ];

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    setSearchQuery("");
    setSearchOpen(false);
  }, []);

  if (selectedPost) {
    return <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <div className={styles.page}>
      {/* Search bar (toggled) */}
      {searchOpen && isPostTab && (
        <div className={styles.searchBar}>
          <Search size={ICON.sm} className={styles.searchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목, 내용, 작성자 검색"
            autoFocus
            className={styles.searchInput}
          />
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            className={styles.iconButton}
            type="button"
            aria-label="검색 닫기"
            title="검색 닫기"
          >
            <X size={ICON.sm} />
          </button>
        </div>
      )}

      {/* 5탭 + action buttons */}
      <div className={styles.tabBar}>
        <div className={styles.tabScroller}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`${styles.tabButton} ${tab === t.key ? styles.tabButtonActive : ""}`}
              type="button"
            >
              {t.label}
              {!!t.badge && t.badge > 0 && (
                <span className={styles.badge}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action buttons: search + create */}
        <div className={styles.actions}>
          {isPostTab && (
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={`${styles.iconButtonLarge} ${searchOpen ? styles.iconButtonActive : ""}`}
              type="button"
              aria-label={searchOpen ? "검색 닫기" : "검색 열기"}
              title={searchOpen ? "검색 닫기" : "검색 열기"}
            >
              <Search size={ICON.md} />
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => setCreateOpen(true)}
              className={`${styles.iconButtonLarge} ${styles.createButton}`}
              type="button"
              aria-label={`${TAB_LABELS[tab]} 작성`}
              title={`${TAB_LABELS[tab]} 작성`}
            >
              <Plus size={ICON.md} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
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
          <div className={styles.postList}>
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
          <EmptyState scope="panel" tone="empty" title={searchQuery ? `"${searchQuery}" 검색 결과가 없습니다` : emptyTitle(tab)} />
        )}
      </div>

      {/* Create post sheet */}
      {canWrite && (
        <CreatePostSheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          postType={postType}
          postTypeLabel={TAB_LABELS[tab]}
        />
      )}
    </div>
  );
}

function emptyTitle(tab: Tab): string {
  const map: Record<Tab, string> = {
    notices: "공지사항이 없습니다",
    qna: "Q&A가 없습니다",
    counsel: "상담 신청이 없습니다",
    requests: "가입 신청이 없습니다",
    board: "게시글이 없습니다",
    materials: "자료가 없습니다",
  };
  return map[tab];
}
