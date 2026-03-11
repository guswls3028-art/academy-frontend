// PATH: src/features/community/pages/MaterialsBoardPage.tsx
// 자료실 — 게시판과 동일한 2-pane 디자인 (목록 | 상세·글쓰기)
// block_type "materials" 자동 생성 후 해당 유형 게시물만 표시

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ensureMaterialsBlockType,
  fetchAdminPosts,
  fetchScopeNodes,
  fetchPost,
  fetchPostReplies,
  createAnswer,
  createPost,
  updatePost,
  deletePost,
  updateReply as updateReplyApi,
  deleteReply as deleteReplyApi,
  type PostEntity,
  type Answer,
  type ScopeNodeMinimal,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import "@/features/community/qna-inbox.css";
import "@/features/community/board-admin.css";

const PAGE_SIZE = 100;
const SNIPPET_LEN = 80;

/* ─── helpers ─────────────────────────────────────────── */
function initials(name: string): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0];
}
function avatarSlot(name: string): number {
  return [...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
}
function MatAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const style = size !== 32 ? { width: size, height: size, fontSize: size * 0.34 } : undefined;
  return (
    <div className="qna-inbox__avatar" data-slot={avatarSlot(name)} style={style}>
      {initials(name)}
    </div>
  );
}
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}
function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/* ─── Main Page ─────────────────────────────────────── */
export default function MaterialsBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId =
    selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [accPosts, setAccPosts] = useState<PostEntity[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  // Auto-provision materials block type
  const { data: materialsTypeId, isLoading: typeLoading, isError: typeError } = useQuery({
    queryKey: ["community-materials-type-ensure"],
    queryFn: ensureMaterialsBlockType,
    staleTime: Infinity,
    retry: 2,
  });

  const postsQ = useQuery({
    queryKey: ["community-materials-admin-posts", materialsTypeId, page],
    queryFn: () =>
      fetchAdminPosts({ blockTypeId: materialsTypeId!, page, pageSize: PAGE_SIZE }),
    enabled: materialsTypeId != null,
  });
  const totalCount = postsQ.data?.count ?? 0;

  useEffect(() => {
    if (!postsQ.data?.results) return;
    setAccPosts((prev) =>
      page === 1 ? postsQ.data!.results : [...prev, ...postsQ.data!.results]
    );
  }, [postsQ.data, page]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return accPosts;
    const q = searchQuery.trim().toLowerCase();
    return accPosts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        stripHtml(p.content ?? "").toLowerCase().includes(q) ||
        (p.created_by_display ?? "").toLowerCase().includes(q)
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
      if (id != null) setShowCreate(false);
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

  if (typeLoading) {
    return (
      <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
        <div className="qna-inbox__empty" style={{ gridColumn: "1 / -1" }}>
          <p className="qna-inbox__empty-title">자료실 준비 중…</p>
        </div>
      </div>
    );
  }

  if (typeError) {
    return (
      <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
        <div className="qna-inbox__empty" style={{ gridColumn: "1 / -1" }}>
          <p className="qna-inbox__empty-title">자료실을 불러오지 못했습니다</p>
          <p className="qna-inbox__empty-desc">네트워크를 확인한 뒤 페이지를 새로고침해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
      {/* ── LEFT panel ── */}
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          <div className="board-admin__list-title-row">
            <h2 className="qna-inbox__list-title">자료실</h2>
            <Button
              intent="primary"
              size="sm"
              onClick={() => { setShowCreate(true); setSelectedId(null); }}
            >
              + 자료 등록
            </Button>
          </div>

          <div className="qna-inbox__filter-group" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              className="qna-inbox__filter-btn qna-inbox__filter-btn--active"
            >
              <span>전체</span>
              <span className="qna-inbox__filter-badge">{totalCount}</span>
            </button>
          </div>

          <div className="qna-inbox__search">
            <input
              type="search"
              className="ds-input"
              placeholder="제목 · 내용 · 작성자"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="자료실 검색"
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
              <p className="qna-inbox__empty-title">등록된 자료가 없습니다</p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim()
                  ? "검색어를 바꿔 보세요."
                  : "'자료 등록' 버튼으로 첫 자료를 등록하세요."}
              </p>
            </div>
          ) : (
            <>
              {filtered.map((p) => (
                <MatPostCard
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
        {showCreate && materialsTypeId != null ? (
          <MatCreatePane
            materialsTypeId={materialsTypeId}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["community-materials-admin-posts"] });
              setShowCreate(false);
              feedback.success("자료가 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
          <div className="qna-inbox__empty">
            <p className="qna-inbox__empty-title">자료를 선택하세요</p>
            <p className="qna-inbox__empty-desc">
              왼쪽 목록에서 자료를 클릭하면 내용이 표시됩니다.
            </p>
            <p className="qna-inbox__keyboard-hint">
              <kbd>j</kbd> 다음 · <kbd>k</kbd> 이전
            </p>
          </div>
        ) : (
          <MatDetailView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["community-materials-admin-posts"] });
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ─── Inline Create Pane ──────────────────────────────── */
function MatCreatePane({
  materialsTypeId,
  onCancel,
  onSuccess,
}: {
  materialsTypeId: number;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeNodesQ = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: fetchScopeNodes,
  });
  const courseNodes = useMemo(
    () => (scopeNodesQ.data ?? []).filter((n) => n.level === "COURSE"),
    [scopeNodesQ.data]
  );
  const allSelected = courseNodes.length > 0 && selectedNodeIds.length === courseNodes.length;

  const toggleNode = (id: number) =>
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleAll = () =>
    setSelectedNodeIds(allSelected ? [] : courseNodes.map((n) => n.id));

  const canSubmit = title.trim().length > 0 && selectedNodeIds.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        block_type: materialsTypeId,
        title: title.trim(),
        content,
        node_ids: selectedNodeIds,
      });
      onSuccess();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as Error)?.message ?? "등록에 실패했습니다.";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">새 자료 등록</h1>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onCancel}>취소</Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__thread-body" style={{ padding: "var(--space-4, 16px) var(--space-5, 20px)" }}>
        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <label className="community-field__label community-field__label--required" style={{ display: "block", marginBottom: 6 }}>
            제목
          </label>
          <input
            className="ds-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="자료 제목을 입력하세요"
            style={{ width: "100%" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <label className="community-field__label" style={{ display: "block", marginBottom: 6 }}>
            내용
          </label>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="자료 내용을 입력하세요. 이미지를 삽입하거나 파일을 첨부할 수 있습니다."
            minHeight={250}
          />
        </div>

        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label className="community-field__label community-field__label--required" style={{ margin: 0 }}>
              노출 강의
            </label>
            {courseNodes.length > 1 && (
              <button
                type="button"
                className="community-link"
                style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                onClick={toggleAll}
              >
                {allSelected ? "전체 해제" : "전체 선택"}
              </button>
            )}
          </div>
          {scopeNodesQ.isLoading ? (
            <p className="community-field__hint">강의 목록 불러오는 중…</p>
          ) : courseNodes.length === 0 ? (
            <p className="community-field__hint">등록된 강의가 없습니다.</p>
          ) : (
            <div className="community-checkbox-list">
              {courseNodes.map((n) => (
                <label key={n.id}>
                  <input
                    type="checkbox"
                    checked={selectedNodeIds.includes(n.id)}
                    onChange={() => toggleNode(n.id)}
                  />
                  {n.lecture_title}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="community-field__error">{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
          <Button intent="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
        </div>
      </div>
    </>
  );
}

/* ─── Post Card ──────────────────────────────────────── */
function MatPostCard({
  post,
  isActive,
  onClick,
}: {
  post: PostEntity;
  isActive: boolean;
  onClick: () => void;
}) {
  const plainText = stripHtml(post.content ?? "");
  const snippet =
    plainText.length > SNIPPET_LEN
      ? plainText.slice(0, SNIPPET_LEN).trim() + "…"
      : plainText;
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
          <MatAvatar name={authorName} size={30} />
        </div>
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{post.title || "(제목 없음)"}</div>
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

/* ─── Detail View ────────────────────────────────────── */
function MatDetailView({
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
      qc.invalidateQueries({ queryKey: ["community-materials-admin-posts"] });
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
      qc.invalidateQueries({ queryKey: ["community-materials-admin-posts"] });
      feedback.success("자료가 삭제되었습니다.");
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
          {isLoading ? "불러오는 중…" : "자료를 찾을 수 없습니다."}
        </p>
      </div>
    );
  }

  const authorName = post.created_by_deleted
    ? "삭제된 사용자"
    : (post.created_by_display ?? "관리자");
  const contentDirty = editContent !== (post.content ?? "");

  return (
    <>
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
              <span>{authorName}</span>
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
            <Button intent="ghost" size="sm" onClick={onClose}>목록</Button>
            <Button
              intent="danger"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() =>
                window.confirm("이 자료를 삭제할까요?") && deleteMut.mutate()
              }
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__thread-body">
        <div className="qna-inbox__message-row">
          <MatAvatar name={authorName} size={32} />
          <div className="qna-inbox__message-bubble" style={{ flex: 1, minWidth: 0 }}>
            <div className="qna-inbox__message-meta">
              <span className="qna-inbox__message-author">{authorName}</span>
              <span className="qna-inbox__message-date">
                {new Date(post.created_at).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <RichTextEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="내용을 입력하세요."
              minHeight={200}
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

        {(post.replies_count ?? 0) > 0 && (
          <div className="qna-inbox__thread-sep">
            <span className="qna-inbox__thread-sep-label">
              댓글 {post.replies_count}개
            </span>
          </div>
        )}

        <MatCommentThread postId={postId} />
      </div>

      <MatCommentComposer postId={postId} />
    </>
  );
}

/* ─── Comment Thread ─────────────────────────────────── */
function MatCommentThread({ postId }: { postId: number }) {
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
        <MatCommentBlock key={reply.id} postId={postId} reply={reply} />
      ))}
    </>
  );
}

function MatCommentBlock({ postId, reply }: { postId: number; reply: Answer }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);

  const updateMut = useMutation({
    mutationFn: () => updateReplyApi(postId, reply.id, editContent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
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
      feedback.success("댓글이 삭제되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const authorName = reply.created_by_display ?? "관리자";

  return (
    <div className="qna-inbox__message-row qna-inbox__message-row--teacher">
      <MatAvatar name={authorName} size={32} />
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
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} />
            <div className="qna-inbox__edit-actions">
              <Button size="sm" intent="primary" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>저장</Button>
              <Button size="sm" intent="secondary" onClick={() => setEditing(false)}>취소</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="qna-inbox__message-body">{reply.content}</div>
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>수정</Button>
              <Button
                size="sm"
                intent="ghost"
                onClick={() => window.confirm("이 댓글을 삭제할까요?") && deleteMut.mutate()}
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

function MatCommentComposer({ postId }: { postId: number }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-materials-admin-posts"] });
      setContent("");
      feedback.success("댓글이 등록되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "등록에 실패했습니다.");
    },
  });

  return (
    <div className="qna-inbox__composer">
      <div className="qna-inbox__composer-inner">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && content.trim() && !createMut.isPending) {
              e.preventDefault();
              createMut.mutate();
            }
          }}
          placeholder="댓글을 작성하세요…"
          rows={3}
        />
        <div className="qna-inbox__composer-footer">
          <span className="qna-inbox__composer-hint">
            <kbd>⌘</kbd><kbd>Enter</kbd> 빠른 등록
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
