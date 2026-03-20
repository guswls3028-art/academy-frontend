// PATH: src/features/community/pages/BoardAdminPage.tsx
// 게시판 — 3-pane (좌측 강의/차시 트리 | 목록 | 상세·글쓰기)
// 공지사항과 동일한 카테고리(트리) 디자인

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchPosts,
  fetchAdminPosts,
  fetchScopeNodes,
  resolveNodeIdFromScope,
  fetchPost,
  fetchPostReplies,
  createAnswer,
  createPost,
  updateReply as updateReplyApi,
  deleteReply as deleteReplyApi,
  deletePost,
  updatePost,
  uploadPostAttachments,
  getAttachmentDownloadUrl,
  deletePostAttachment,
  type PostEntity,
  type PostAttachment,
  type Answer,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import CmsTreeNav from "../components/CmsTreeNav";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import ScopeBadge from "../components/ScopeBadge";
import PostReadView from "../components/PostReadView";
import ContextHeader from "../components/ContextHeader";
import { stripHtml, getInitials, getAvatarSlot, timeAgo, formatFileSize } from "../utils/communityHelpers";
import "@/features/community/qna-inbox.css";
import "@/features/community/notice-tree.css";
import "@/features/community/board-admin.css";

const SNIPPET_LEN = 80;

/* ─── helpers ─────────────────────────────────────────── */
function BoardAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const style = size !== 32 ? { width: size, height: size, fontSize: size * 0.34 } : undefined;
  return (
    <div className="qna-inbox__avatar" data-slot={getAvatarSlot(name)} style={style}>
      {getInitials(name)}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────── */
export default function BoardAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId =
    selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const {
    scope,
    lectureId,
    sessionId,
    effectiveLectureId,
  } = useCommunityScope();

  const scopeParams = useMemo<CommunityScopeParams>(
    () => ({
      scope,
      lectureId: effectiveLectureId ?? undefined,
      sessionId: sessionId ?? undefined,
    }),
    [scope, effectiveLectureId, sessionId]
  );

  const [expandedLectureId, setExpandedLectureId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: scopeNodes = [] } = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: fetchScopeNodes,
  });

  const { data: lectures = [] } = useQuery<Lecture[]>({
    queryKey: ["lectures-list"],
    queryFn: () => fetchLectures({ is_active: true }),
  });

  const { data: sessionsOfLecture = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["lecture-sessions", expandedLectureId],
    queryFn: () => fetchSessions(expandedLectureId!),
    enabled: expandedLectureId != null && Number.isFinite(expandedLectureId),
  });

  // ── All posts for tree counts (게시판 유형만) ──
  const { data: allPostsForCount = [] } = useQuery<PostEntity[]>({
    queryKey: ["community-all-board-posts-for-count"],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ postType: "board", pageSize: 500 });
      return results;
    },
  });

  const treeCounts = useMemo(() => {
    const scopeNodeIds = new Set(scopeNodes.map((n) => n.id));
    const countByNodeId: Record<number, number> = {};
    for (const n of scopeNodes) countByNodeId[n.id] = 0;
    for (const p of allPostsForCount) {
      for (const m of p.mappings ?? []) {
        if (scopeNodeIds.has(m.node)) countByNodeId[m.node] = (countByNodeId[m.node] ?? 0) + 1;
      }
    }
    const total = allPostsForCount.length;
    const totalUnderScope = allPostsForCount.filter((p) =>
      p.mappings?.some((m) => scopeNodeIds.has(m.node))
    ).length;
    const countByLecture: Record<number, number> = {};
    for (const lec of lectures) countByLecture[lec.id] = 0;
    for (const p of allPostsForCount) {
      const seen = new Set<number>();
      for (const m of p.mappings ?? []) {
        const lid = m.node_detail?.lecture;
        if (lid != null && !seen.has(lid)) {
          seen.add(lid);
          countByLecture[lid] = (countByLecture[lid] ?? 0) + 1;
        }
      }
    }
    return { total, totalUnderScope, countByNodeId, countByLecture };
  }, [allPostsForCount, scopeNodes, lectures]);

  // ── Posts for current scope ──
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );

  const canShowList = true;

  // 게시판 전체 목록 (post_type 기반, scope는 클라이언트 필터)
  const postsQ = useQuery<PostEntity[]>({
    queryKey: ["community-board-posts-all"],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ postType: "board", pageSize: 500 });
      return results;
    },
  });
  const allBoardPosts = postsQ.data ?? [];

  // scope 기반 클라이언트 필터: 전체=모든 글, 강의=해당 강의 매핑+GLOBAL, 차시=해당 차시 매핑+GLOBAL
  const boardPosts = useMemo(() => {
    if (scope === "all" || !canShowList) return allBoardPosts;
    return allBoardPosts.filter((p) => {
      const hasNoMapping = !p.mappings || p.mappings.length === 0;
      if (hasNoMapping) return true; // GLOBAL 글은 항상 표시
      if (nodeId == null) return true;
      return p.mappings.some((m) => m.node === nodeId);
    });
  }, [allBoardPosts, scope, nodeId, canShowList]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return boardPosts;
    const q = searchQuery.trim().toLowerCase();
    return boardPosts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        stripHtml(p.content ?? "").toLowerCase().includes(q) ||
        (p.created_by_display ?? "").toLowerCase().includes(q)
    );
  }, [boardPosts, searchQuery]);

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

  // ── Tree selection callbacks ──
  const selectAll = useCallback(() => {
    setShowCreate(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("scope", "all");
      next.delete("lectureId");
      next.delete("sessionId");
      return next;
    });
  }, [setSearchParams]);

  const selectLecture = useCallback(
    (lecId: number) => {
      setShowCreate(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", "lecture");
        next.set("lectureId", String(lecId));
        next.delete("sessionId");
        return next;
      });
    },
    [setSearchParams]
  );

  const selectSession = useCallback(
    (lecId: number, sesId: number) => {
      setShowCreate(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", "session");
        next.set("lectureId", String(lecId));
        next.set("sessionId", String(sesId));
        return next;
      });
    },
    [setSearchParams]
  );

  // j/k keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = selectedId != null ? filtered.findIndex((p) => p.id === selectedId) : -1;
      if (e.key === "j") {
        e.preventDefault();
        const next = Math.min(idx + 1, filtered.length - 1);
        if (filtered[next]) setSelectedId(filtered[next].id);
      } else if (e.key === "k") {
        e.preventDefault();
        const prev = idx <= 0 ? filtered.length - 1 : idx - 1;
        if (filtered[prev]) setSelectedId(filtered[prev].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, setSelectedId]);

  return (
    <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
      <CmsTreeNav
        title="게시판"
        allLabel="전체 보기"
        counts={{
          totalCount: treeCounts.total,
          totalUnderScope: treeCounts.totalUnderScope,
          countByNodeId: treeCounts.countByNodeId,
          countByLecture: treeCounts.countByLecture,
        }}
        scope={scope}
        lectureId={lectureId}
        sessionId={sessionId}
        effectiveLectureId={effectiveLectureId}
        lectures={lectures}
        scopeNodes={scopeNodes}
        sessionsOfLecture={sessionsOfLecture}
        sessionsLoading={sessionsLoading}
        expandedLectureId={expandedLectureId}
        onExpandLecture={setExpandedLectureId}
        onSelectAll={selectAll}
        onSelectLecture={selectLecture}
        onSelectSession={selectSession}
      />

      {/* ═══ 2nd pane: List ═══ */}
      <aside className="qna-inbox__list">
        <ContextHeader
          tabLabel="게시판"
          scope={scope as any}
          lectureName={lectures.find((l) => l.id === lectureId)?.title ?? null}
          sessionName={sessionsOfLecture.find((s) => s.id === sessionId)?.title ?? null}
        />
        <div className="qna-inbox__list-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 className="qna-inbox__list-title">게시물</h2>
            {canShowList && <Button intent="primary" size="sm" onClick={() => { setShowCreate(true); setSelectedId(null); }}>+ 글쓰기</Button>}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              className="ds-input flex-1 min-w-0"
              placeholder="제목 · 내용 · 작성자"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="게시판 검색"
            />
          </div>
        </div>

        <div className="qna-inbox__list-body">
          {!canShowList ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">
                좌측에서 조회 범위를 선택하세요
              </p>
            </div>
          ) : postsQ.isError ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">목록을 불러오지 못했습니다</p>
              <p className="qna-inbox__empty-desc">잠시 후 다시 시도해 주세요.</p>
            </div>
          ) : postsQ.isLoading ? (
            <>
              <div className="cms-skeleton cms-skeleton--card" />
              <div className="cms-skeleton cms-skeleton--card" />
              <div className="cms-skeleton cms-skeleton--card" />
              <div className="cms-skeleton cms-skeleton--card" />
            </>
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">
                {searchQuery.trim() ? "검색 결과가 없습니다" : "게시물이 없습니다"}
              </p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim()
                  ? "다른 검색어를 입력해 보세요."
                  : "'글쓰기' 버튼으로 첫 게시물을 등록하세요."}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <BoardPostCard
                key={p.id}
                post={p}
                isActive={p.id === selectedId}
                onClick={() => setSelectedId(p.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ═══ 3rd pane: Detail / Create ═══ */}
      <main className="qna-inbox__thread">
        {showCreate ? (
          <BoardCreatePane
            scopeNodes={scopeNodes}
            scopeParams={scopeParams}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
              qc.invalidateQueries({ queryKey: ["community-all-board-posts-for-count"] });
              setShowCreate(false);
              feedback.success("게시물이 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
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
              qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
              qc.invalidateQueries({ queryKey: ["community-all-board-posts-for-count"] });
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ─── Inline Create Pane ──────────────────────────────── */
function BoardCreatePane({
  scopeNodes,
  scopeParams,
  onCancel,
  onSuccess,
}: {
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  // Auto-resolve node_ids from current scope
  const autoNodeIds = useMemo(() => {
    if (scopeParams.scope === "session" && scopeParams.sessionId != null) {
      const node = scopeNodes.find(
        (n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId
      );
      return node ? [node.id] : [];
    }
    if (scopeParams.scope === "lecture" && scopeParams.lectureId != null) {
      const nodes = scopeNodes.filter((n) => n.lecture === scopeParams.lectureId && n.level === "COURSE");
      return nodes.map((n) => n.id);
    }
    return []; // 전체 게시물: 매핑 없음
  }, [scopeNodes, scopeParams]);

  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의"
    : "전체 게시물";

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await createPost({
        post_type: "board",
        title: title.trim(),
        content,
        node_ids: autoNodeIds,
      });
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
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
            <h1 className="qna-inbox__thread-title">새 게시물 작성</h1>
            <div className="qna-inbox__thread-meta">
              <span className="ds-badge ds-badge--primary">게시 대상: {scopeLabel}</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              이 글은 <strong>{scopeLabel}</strong> 학생에게{scopeLabel === "전체 대상" ? " 모두" : "만"} 보입니다.
            </p>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onCancel}>취소</Button>
          </div>
        </div>
      </header>

      <div className="cms-form__body">
        <div className="cms-form__field">
          <label className="community-field__label community-field__label--required">제목</label>
          <input
            className="ds-input cms-form__input--full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="게시물 제목을 입력하세요"
            autoFocus
          />
        </div>

        <div className="cms-form__field">
          <label className="community-field__label">내용</label>
          <RichTextEditor value={content} onChange={setContent} placeholder="내용을 입력하세요..." minHeight={250} />
        </div>

        <div className="cms-form__field">
          <div className="cms-attach__header">
            <label className="community-field__label" style={{ margin: 0 }}>
              첨부파일 {files.length > 0 && `(${files.length}/10)`}
            </label>
            <Button intent="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={files.length >= 10}>
              + 파일 추가
            </Button>
            <input
              ref={(el) => { fileInputRef.current = el; }}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) {
                  setFiles((prev) => [...prev, ...Array.from(e.target.files!)].slice(0, 10));
                  e.target.value = "";
                }
              }}
            />
          </div>
          {files.length > 0 && (
            <div className="cms-attach__list">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="cms-attach__item">
                  <span className="cms-attach__item-name">{f.name}</span>
                  <span className="cms-attach__item-size">{formatFileSize(f.size)}</span>
                  <button type="button" className="cms-attach__item-remove" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="community-field__error">{error}</p>}

        <div className="cms-form__actions">
          <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
          <Button intent="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
        </div>
      </div>
    </>
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
  const plainText = stripHtml(post.content ?? "");
  const snippet = plainText.length > SNIPPET_LEN ? plainText.slice(0, SNIPPET_LEN).trim() + "…" : plainText;
  const authorName = post.created_by_deleted ? "삭제된 사용자" : (post.created_by_display ?? "관리자");

  return (
    <button type="button" onClick={onClick} className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""}`}>
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-avatar-wrap">
          <BoardAvatar name={authorName} size={30} />
        </div>
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{post.title || "(제목 없음)"}</div>
          </div>
          {snippet && <div className="qna-inbox__card-snippet">{snippet}</div>}
          <div className="qna-inbox__card-meta">
            <span>{authorName}</span>
            <span className="qna-inbox__card-meta-dot" />
            <ScopeBadge post={post} />
            <span className="qna-inbox__card-meta-dot" />
            <span>{timeAgo(post.created_at)}</span>
            {(post.replies_count ?? 0) > 0 && (
              <><span className="qna-inbox__card-meta-dot" /><span className="ds-badge ds-badge--primary">댓글 {post.replies_count}</span></>
            )}
            {(post.attachments?.length ?? 0) > 0 && (
              <><span className="qna-inbox__card-meta-dot" /><span className="ds-badge ds-badge--neutral">파일 {post.attachments!.length}</span></>
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
  const confirm = useConfirm();
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    setEditingTitle(false);
    setEditingContent(false);
    if (post) {
      setEditTitle(post.title ?? "");
      setEditContent(post.content ?? "");
    }
  }, [post?.id]);

  const updateMut = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
      qc.invalidateQueries({ queryKey: ["community-all-board-posts-for-count"] });
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
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
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
        <p className="qna-inbox__empty-title">{isLoading ? "불러오는 중…" : "게시물을 찾을 수 없습니다."}</p>
      </div>
    );
  }

  const authorName = post.created_by_deleted ? "삭제된 사용자" : (post.created_by_display ?? "관리자");
  const contentDirty = editContent !== (post.content ?? "");

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group" style={{ flex: 1, minWidth: 0 }}>
            {editingTitle ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <input
                  className="ds-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  style={{ flex: 1, fontSize: 15, fontWeight: 600 }} autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateMut.mutate({ title: editTitle });
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
                <Button size="sm" intent="primary" onClick={() => updateMut.mutate({ title: editTitle })} disabled={updateMut.isPending || !editTitle.trim()}>저장</Button>
                <Button size="sm" intent="secondary" onClick={() => setEditingTitle(false)}>취소</Button>
              </div>
            ) : (
              <h1 className="qna-inbox__thread-title" style={{ cursor: "text" }} title="클릭하여 제목 수정" onClick={() => setEditingTitle(true)}>
                {post.title}
              </h1>
            )}
            <div className="qna-inbox__thread-meta">
              <ScopeBadge post={post} />
              <span className="qna-inbox__thread-meta-dot" />
              <span>{authorName}</span>
              <span className="qna-inbox__thread-meta-dot" />
              <span>{new Date(post.created_at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onClose}>목록</Button>
            <Button intent="danger" size="sm" disabled={deleteMut.isPending} onClick={async () => { if (await confirm({ title: "게시물 삭제", message: "이 게시물을 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate(); }}>삭제</Button>
          </div>
        </div>
      </header>

      <div className="cms-detail__body">
        {/* Author/date/scope meta row */}
        <div className="cms-detail__meta-row">
          <span className={`qna-inbox__avatar qna-inbox__avatar--slot-${getAvatarSlot(authorName)}`}>
            {getInitials(authorName)}
          </span>
          <span className="cms-detail__meta-author">{authorName}</span>
          <span className="cms-detail__meta-dot" />
          <ScopeBadge post={post} />
          <span className="cms-detail__meta-dot" />
          <span>{timeAgo(post.created_at)}</span>
        </div>

        {/* Section: 내용 — 읽기/편집 분리 */}
        <div className="cms-detail__section">
          {editingContent ? (
            <>
              <div className="cms-detail__content-card">
                <RichTextEditor value={editContent} onChange={setEditContent} placeholder="내용을 입력하세요." minHeight={150} />
              </div>
              <div className="cms-detail__content-actions" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Button size="sm" intent="primary" onClick={() => { updateMut.mutate({ content: editContent }, { onSuccess: () => setEditingContent(false) }); }} disabled={updateMut.isPending}>
                  {updateMut.isPending ? "저장 중…" : "내용 저장"}
                </Button>
                <Button size="sm" intent="secondary" onClick={() => { setEditContent(post.content ?? ""); setEditingContent(false); }}>취소</Button>
              </div>
            </>
          ) : (
            <>
              <PostReadView html={post.content ?? ""} />
              <div style={{ marginTop: 8 }}>
                <Button size="sm" intent="ghost" onClick={() => setEditingContent(true)}>수정</Button>
              </div>
            </>
          )}
        </div>

        {/* Section: 첨부파일 */}
        <div className="cms-detail__section">
          <AdminAttachmentSection postId={postId} attachments={post.attachments ?? []} />
        </div>

        {/* Comments — keep messenger-style pattern */}
        {(post.replies_count ?? 0) > 0 && (
          <div className="qna-inbox__thread-sep">
            <span className="qna-inbox__thread-sep-label">댓글 {post.replies_count}개</span>
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
  if (isLoading) return <div style={{ padding: "12px 0" }}><p className="qna-inbox__empty-desc">댓글 불러오는 중…</p></div>;
  return <>{replies.map((r) => <CommentBlock key={r.id} postId={postId} reply={r} />)}</>;
}

function CommentBlock({ postId, reply }: { postId: number; reply: Answer }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  // 서버 데이터 갱신 시 편집 중이 아니면 동기화
  const prevReplyContent = useRef(reply.content);
  if (prevReplyContent.current !== reply.content && !editing) {
    prevReplyContent.current = reply.content;
    setEditContent(reply.content);
  }
  const authorName = reply.created_by_display ?? "관리자";

  const invalidatePost = () => {
    qc.invalidateQueries({ queryKey: ["post-replies", postId] });
    qc.invalidateQueries({ queryKey: ["community-post", postId] });
    qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
  };
  const updateMut = useMutation({
    mutationFn: () => updateReplyApi(postId, reply.id, editContent),
    onSuccess: () => { invalidatePost(); setEditing(false); feedback.success("댓글이 수정되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "수정에 실패했습니다."); },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteReplyApi(postId, reply.id),
    onSuccess: () => { invalidatePost(); feedback.success("댓글이 삭제되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."); },
  });

  return (
    <div className="qna-inbox__message-row qna-inbox__message-row--teacher">
      <BoardAvatar name={authorName} size={32} />
      <div className="qna-inbox__message-bubble">
        <div className="qna-inbox__message-meta">
          <span className="qna-inbox__message-author">{authorName}</span>
          <span className="qna-inbox__message-badge">댓글</span>
          <span className="qna-inbox__message-date">{new Date(reply.created_at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
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
            <PostReadView html={reply.content} />
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>수정</Button>
              <Button size="sm" intent="ghost" onClick={async () => { if (await confirm({ title: "댓글 삭제", message: "이 댓글을 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate(); }} disabled={deleteMut.isPending}>삭제</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Admin Attachment Section ──────────────────────── */
function AdminAttachmentSection({
  postId,
  attachments,
}: {
  postId: number;
  attachments: PostAttachment[];
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = { current: null as HTMLInputElement | null };

  const uploadMut = useMutation({
    mutationFn: (files: File[]) => uploadPostAttachments(postId, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      feedback.success("파일이 첨부되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "파일 업로드에 실패했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (attId: number) => deletePostAttachment(postId, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      feedback.success("첨부파일이 삭제되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const handleDownload = async (att: PostAttachment) => {
    try {
      const { url } = await getAttachmentDownloadUrl(postId, att.id);
      const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
      downloadPresignedUrl(url, att.original_name);
    } catch {
      feedback.error("다운로드 URL을 가져오지 못했습니다.");
    }
  };

  const getFileExt = (name: string) => {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toUpperCase() : "FILE";
  };

  const getExtCategory = (ext: string): string => {
    const e = ext.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(e)) return "image";
    if (["pdf"].includes(e)) return "pdf";
    if (["doc", "docx", "hwp", "hwpx", "txt", "rtf"].includes(e)) return "doc";
    if (["xls", "xlsx", "csv"].includes(e)) return "sheet";
    if (["ppt", "pptx"].includes(e)) return "slide";
    if (["zip", "rar", "7z", "tar", "gz"].includes(e)) return "archive";
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(e)) return "video";
    if (["mp3", "wav", "ogg", "flac", "aac"].includes(e)) return "audio";
    return "etc";
  };

  return (
    <div className="cms-attach__section">
      <div className="cms-attach__header">
        <div className="cms-detail__section-label">
          첨부파일 ({attachments.length})
        </div>
        <Button intent="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending || attachments.length >= 10}>
          {uploadMut.isPending ? "업로드 중…" : "+ 파일 추가"}
        </Button>
        <input
          ref={(el) => { fileInputRef.current = el; }}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadMut.mutate(Array.from(e.target.files));
              e.target.value = "";
            }
          }}
        />
      </div>
      {attachments.length > 0 && (
        <div className="cms-attach__list">
          {attachments.map((att) => {
            const ext = getFileExt(att.original_name);
            const category = getExtCategory(ext);
            return (
              <div key={att.id} className="cms-attach__file-card">
                <div className={`cms-attach__file-ext cms-attach__file-ext--${category}`}>
                  {ext.length > 4 ? ext.slice(0, 4) : ext}
                </div>
                <div className="cms-attach__file-info">
                  <span className="cms-attach__file-name" title={att.original_name}>
                    {att.original_name}
                  </span>
                  <span className="cms-attach__file-size">{formatFileSize(att.size_bytes)}</span>
                </div>
                <div className="cms-attach__file-actions">
                  <button type="button" className="cms-attach__download-btn" onClick={() => handleDownload(att)}>
                    다운로드
                  </button>
                  <button
                    type="button"
                    className="cms-attach__item-remove"
                    onClick={async () => {
                      if (await confirm({ title: "첨부파일 삭제", message: `"${att.original_name}" 파일을 삭제할까요?`, confirmText: "삭제", danger: true }))
                        deleteMut.mutate(att.id);
                    }}
                    disabled={deleteMut.isPending}
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommentComposer({ postId }: { postId: number }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
      setContent("");
      feedback.success("댓글이 등록되었습니다.");
    },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "등록에 실패했습니다."); },
  });

  return (
    <div className="qna-inbox__composer">
      <div className="qna-inbox__composer-inner">
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && content.trim() && !createMut.isPending) { e.preventDefault(); createMut.mutate(); } }}
          placeholder="댓글을 작성하세요…" rows={3}
        />
        <div className="qna-inbox__composer-footer">
          <span className="qna-inbox__composer-hint"><kbd>Ctrl</kbd><kbd>Enter</kbd> 빠른 등록</span>
          <Button intent="primary" size="sm" onClick={() => createMut.mutate()} disabled={!content.trim() || createMut.isPending}>
            {createMut.isPending ? "등록 중…" : "댓글 등록"}
          </Button>
        </div>
      </div>
    </div>
  );
}
