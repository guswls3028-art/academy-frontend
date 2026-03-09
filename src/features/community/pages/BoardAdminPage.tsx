// PATH: src/features/community/pages/BoardAdminPage.tsx
// 커뮤니티 게시판 — 2-pane (목록 | 상세·댓글)
// fetchAdminPosts로 전체 또는 블록 유형별 필터. 댓글(PostReply) CRUD 포함.

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminPosts,
  fetchBlockTypes,
  fetchPost,
  fetchPostReplies,
  createAnswer,
  updateReply as updateReplyApi,
  deleteReply as deleteReplyApi,
  deletePost,
  updatePost,
  type PostEntity,
  type BlockType,
  type Answer,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import BoardCreateModal from "../components/BoardCreateModal";
import "@/features/community/qna-inbox.css";
import "@/features/community/board-admin.css";

const PAGE_SIZE = 100;
const SNIPPET_LEN = 80;

/* ─── Avatar ────────────────────────────────────────── */
function initials(name: string): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0];
}
function avatarSlot(name: string): number {
  return [...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
}
function BoardAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const style = size !== 32 ? { width: size, height: size, fontSize: size * 0.34 } : undefined;
  return (
    <div className="qna-inbox__avatar" data-slot={avatarSlot(name)} style={style}>
      {initials(name)}
    </div>
  );
}

/* ─── Time helper ────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}

/* ─── Main Page ─────────────────────────────────────── */
export default function BoardAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId =
    selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const [blockTypeFilter, setBlockTypeFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [accPosts, setAccPosts] = useState<PostEntity[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const blockTypesQ = useQuery<BlockType[]>({
    queryKey: ["community-block-types"],
    queryFn: fetchBlockTypes,
  });
  const blockTypes = blockTypesQ.data ?? [];

  const postsQ = useQuery({
    queryKey: ["community-board-admin-posts", blockTypeFilter, page],
    queryFn: () => fetchAdminPosts({ blockTypeId: blockTypeFilter, page, pageSize: PAGE_SIZE }),
  });
  const totalCount = postsQ.data?.count ?? 0;

  // Accumulate pages for load-more
  useEffect(() => {
    if (!postsQ.data?.results) return;
    setAccPosts((prev) =>
      page === 1 ? postsQ.data!.results : [...prev, ...postsQ.data!.results]
    );
  }, [postsQ.data, page]);

  // Reset when filter changes
  useEffect(() => {
    setAccPosts([]);
    setPage(1);
  }, [blockTypeFilter]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return accPosts;
    const q = searchQuery.trim().toLowerCase();
    return accPosts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.content ?? "").toLowerCase().includes(q) ||
        (p.created_by_display ?? "").toLowerCase().includes(q) ||
        (p.block_type_label ?? "").toLowerCase().includes(q)
    );
  }, [accPosts, searchQuery]);

  const setSelectedId = useCallback(
    (id: number | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id != null) next.set("id", String(id));
        else next.delete("id");
        return next;
      });
    },
    [setSearchParams]
  );

  // j/k keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = selectedId != null ? filtered.findIndex((p) => p.id === selectedId) : -1;
      if (e.key === "j") {
        e.preventDefault();
        setSelectedId(filtered[Math.min(idx + 1, filtered.length - 1)].id);
      } else if (e.key === "k") {
        e.preventDefault();
        setSelectedId(filtered[Math.max(idx <= 0 ? filtered.length : idx - 1, 0)].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, setSelectedId]);

  const hasMore = page * PAGE_SIZE < totalCount && !searchQuery.trim();

  return (
    <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
      {/* ── LEFT panel ── */}
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          {/* Title + create button */}
          <div className="board-admin__list-title-row">
            <h2 className="qna-inbox__list-title">게시판</h2>
            <Button intent="primary" size="sm" onClick={() => setShowCreate(true)}>
              + 글쓰기
            </Button>
          </div>

          {/* Block-type filter tabs */}
          <div className="qna-inbox__filter-group" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              className={`qna-inbox__filter-btn ${blockTypeFilter === null ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setBlockTypeFilter(null)}
            >
              <span>전체</span>
              {blockTypeFilter === null && (
                <span className="qna-inbox__filter-badge">{totalCount}</span>
              )}
            </button>
            {blockTypes.map((bt) => (
              <button
                key={bt.id}
                type="button"
                className={`qna-inbox__filter-btn ${blockTypeFilter === bt.id ? "qna-inbox__filter-btn--active" : ""}`}
                onClick={() => setBlockTypeFilter(bt.id)}
              >
                <span>{bt.label}</span>
                {blockTypeFilter === bt.id && (
                  <span className="qna-inbox__filter-badge">{totalCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="qna-inbox__search">
            <input
              type="search"
              className="ds-input"
              placeholder="제목 · 내용 · 작성자 · 유형"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="게시판 검색"
            />
          </div>
        </div>

        <div className="qna-inbox__list-body">
          {postsQ.isLoading && accPosts.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">불러오는 중…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">게시물이 없습니다</p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim()
                  ? "검색어를 바꿔 보세요."
                  : "새 글 작성 버튼으로 첫 게시물을 등록하세요."}
              </p>
            </div>
          ) : (
            <>
              {filtered.map((p) => (
                <BoardPostCard
                  key={p.id}
                  post={p}
                  isActive={p.id === selectedId}
                  onClick={() => setSelectedId(p.id)}
                />
              ))}
              {hasMore && (
                <div style={{ padding: "8px 12px" }}>
                  <Button
                    intent="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setPage((n) => n + 1)}
                    disabled={postsQ.isFetching}
                  >
                    {postsQ.isFetching
                      ? "불러오는 중…"
                      : `더 보기 (${totalCount - accPosts.length}건 더)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── RIGHT panel ── */}
      <main className="qna-inbox__thread">
        {selectedId == null ? (
          <div className="qna-inbox__empty">
            <p className="qna-inbox__empty-title">게시물을 선택하세요</p>
            <p className="qna-inbox__empty-desc">
              왼쪽 목록에서 게시물을 클릭하면 내용이 표시됩니다.
            </p>
            <p className="qna-inbox__keyboard-hint">
              <kbd>j</kbd> 다음 · <kbd>k</kbd> 이전
            </p>
          </div>
        ) : (
          <PostDetailView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["community-board-admin-posts"] });
            }}
          />
        )}
      </main>

      {showCreate && (
        <BoardCreateModal
          blockTypes={blockTypes}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["community-board-admin-posts"] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

/* ─── Post List Card ─────────────────────────────────── */
function BoardPostCard({
  post,
  isActive,
  onClick,
}: {
  post: PostEntity;
  isActive: boolean;
  onClick: () => void;
}) {
  const snippet =
    post.content && post.content.length > SNIPPET_LEN
      ? post.content.slice(0, SNIPPET_LEN).trim() + "…"
      : post.content || "";
  const authorName = post.created_by_deleted
    ? "삭제된 사용자"
    : (post.created_by_display ?? "관리자");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""}`}
    >
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-avatar-wrap">
          <BoardAvatar name={authorName} size={30} />
        </div>
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{post.title || "(제목 없음)"}</div>
            <span className="ds-status-badge" data-tone="neutral">
              {post.block_type_label}
            </span>
          </div>
          {snippet && <div className="qna-inbox__card-snippet">{snippet}</div>}
          <div className="qna-inbox__card-meta">
            <span>{authorName}</span>
            <span className="qna-inbox__card-meta-dot" />
            <span>{timeAgo(post.created_at)}</span>
            {(post.replies_count ?? 0) > 0 && (
              <>
                <span className="qna-inbox__card-meta-dot" />
                <span>댓글 {post.replies_count}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── Post Detail View ──────────────────────────────── */
function PostDetailView({
  postId,
  onClose,
  onDeleted,
}: {
  postId: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Sync local edit state when post loads / changes
  useEffect(() => {
    setEditingTitle(false);
    if (post) {
      setEditTitle(post.title ?? "");
      setEditContent(post.content ?? "");
    }
  }, [post?.id]);

  const updateMut = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-board-admin-posts"] });
      setEditingTitle(false);
      feedback.success("수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "수정에 실패했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-board-admin-posts"] });
      feedback.success("게시물이 삭제되었습니다.");
      onDeleted();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  if (isLoading || !post) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">
          {isLoading ? "불러오는 중…" : "게시물을 찾을 수 없습니다."}
        </p>
      </div>
    );
  }

  const authorName = post.created_by_deleted
    ? "삭제된 사용자"
    : (post.created_by_display ?? "관리자");
  const lectureLabel = post.mappings?.[0]?.node_detail?.lecture_title ?? null;
  const contentDirty = editContent !== (post.content ?? "");

  return (
    <>
      {/* Header */}
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group" style={{ flex: 1, minWidth: 0 }}>
            {editingTitle ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <input
                  className="ds-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ flex: 1, fontSize: 15, fontWeight: 600 }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateMut.mutate({ title: editTitle });
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
                <Button
                  size="sm"
                  intent="primary"
                  onClick={() => updateMut.mutate({ title: editTitle })}
                  disabled={updateMut.isPending || !editTitle.trim()}
                >
                  저장
                </Button>
                <Button size="sm" intent="secondary" onClick={() => setEditingTitle(false)}>
                  취소
                </Button>
              </div>
            ) : (
              <h1
                className="qna-inbox__thread-title"
                style={{ cursor: "text" }}
                title="클릭하여 제목 수정"
                onClick={() => setEditingTitle(true)}
              >
                {post.title}
              </h1>
            )}
            <div className="qna-inbox__thread-meta">
              <span className="ds-status-badge" data-tone="neutral" style={{ fontSize: 10 }}>
                {post.block_type_label}
              </span>
              <span className="qna-inbox__thread-meta-dot" />
              <span>{authorName}</span>
              {lectureLabel && (
                <>
                  <span className="qna-inbox__thread-meta-dot" />
                  <span>{lectureLabel}</span>
                </>
              )}
              <span className="qna-inbox__thread-meta-dot" />
              <span>
                {new Date(post.created_at).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onClose}>
              목록
            </Button>
            <Button
              intent="danger"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() =>
                window.confirm("이 게시물을 삭제할까요?") && deleteMut.mutate()
              }
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      {/* Thread body */}
      <div className="qna-inbox__thread-body">
        {/* Original post */}
        <div className="qna-inbox__message-row">
          <BoardAvatar name={authorName} size={32} />
          <div className="qna-inbox__message-bubble">
            <div className="qna-inbox__message-meta">
              <span className="qna-inbox__message-author">{authorName}</span>
              <span className="qna-inbox__message-badge">{post.block_type_label}</span>
              <span className="qna-inbox__message-date">
                {new Date(post.created_at).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <textarea
              className="ds-input w-full"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              style={{
                resize: "vertical",
                minHeight: 120,
                fontSize: 14,
                lineHeight: 1.65,
                background: "transparent",
                border: "1px solid var(--color-border-divider)",
              }}
              placeholder="내용을 입력하세요."
            />
            {contentDirty && (
              <div style={{ marginTop: 8 }}>
                <Button
                  size="sm"
                  intent="primary"
                  onClick={() => updateMut.mutate({ content: editContent })}
                  disabled={updateMut.isPending}
                >
                  {updateMut.isPending ? "저장 중…" : "내용 저장"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Comment separator */}
        {(post.replies_count ?? 0) > 0 && (
          <div className="qna-inbox__thread-sep">
            <span className="qna-inbox__thread-sep-label">
              댓글 {post.replies_count}개
            </span>
          </div>
        )}

        <CommentThread postId={postId} />
      </div>

      <CommentComposer postId={postId} />
    </>
  );
}

/* ─── Comment Thread ─────────────────────────────────── */
function CommentThread({ postId }: { postId: number }) {
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["post-replies", postId],
    queryFn: () => fetchPostReplies(postId),
  });

  if (isLoading) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p className="qna-inbox__empty-desc">댓글 불러오는 중…</p>
      </div>
    );
  }

  return (
    <>
      {replies.map((reply) => (
        <CommentBlock key={reply.id} postId={postId} reply={reply} />
      ))}
    </>
  );
}

/* ─── Single Comment ─────────────────────────────────── */
function CommentBlock({ postId, reply }: { postId: number; reply: Answer }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);

  const updateMut = useMutation({
    mutationFn: () => updateReplyApi(postId, reply.id, editContent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      setEditing(false);
      feedback.success("댓글이 수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "수정에 실패했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteReplyApi(postId, reply.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      feedback.success("댓글이 삭제되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const authorName = reply.created_by_display ?? "관리자";

  return (
    <div className="qna-inbox__message-row qna-inbox__message-row--teacher">
      <BoardAvatar name={authorName} size={32} />
      <div className="qna-inbox__message-bubble">
        <div className="qna-inbox__message-meta">
          <span className="qna-inbox__message-author">{authorName}</span>
          <span className="qna-inbox__message-badge">댓글</span>
          <span className="qna-inbox__message-date">
            {new Date(reply.created_at).toLocaleString("ko-KR", {
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {editing ? (
          <div className="qna-inbox__edit-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
            />
            <div className="qna-inbox__edit-actions">
              <Button
                size="sm"
                intent="primary"
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
              >
                저장
              </Button>
              <Button size="sm" intent="secondary" onClick={() => setEditing(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="qna-inbox__message-body">{reply.content}</div>
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button
                size="sm"
                intent="ghost"
                onClick={() =>
                  window.confirm("이 댓글을 삭제할까요?") && deleteMut.mutate()
                }
                disabled={deleteMut.isPending}
              >
                삭제
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Comment Composer ──────────────────────────────── */
function CommentComposer({ postId }: { postId: number }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-board-admin-posts"] });
      setContent("");
      feedback.success("댓글이 등록되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "등록에 실패했습니다.");
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && content.trim() && !createMut.isPending) {
      e.preventDefault();
      createMut.mutate();
    }
  };

  return (
    <div className="qna-inbox__composer">
      <div className="qna-inbox__composer-inner">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="댓글을 작성하세요…"
          rows={3}
        />
        <div className="qna-inbox__composer-footer">
          <span className="qna-inbox__composer-hint">
            <kbd>⌘</kbd>
            <kbd>Enter</kbd> 빠른 등록
          </span>
          <Button
            intent="primary"
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={!content.trim() || createMut.isPending}
          >
            {createMut.isPending ? "등록 중…" : "댓글 등록"}
          </Button>
        </div>
      </div>
    </div>
  );
}
