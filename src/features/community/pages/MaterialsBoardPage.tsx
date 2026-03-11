// PATH: src/features/community/pages/MaterialsBoardPage.tsx
// 자료실 — 3-pane (좌측 강의/차시 트리 | 목록 | 상세·글쓰기)
// 공지사항·게시판과 동일한 카테고리(트리) 디자인

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  ensureMaterialsBlockType,
  fetchPosts,
  fetchAdminPosts,
  fetchScopeNodes,
  resolveNodeIdFromScope,
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
  type CommunityScopeParams,
} from "../api/community.api";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { isSupplement } from "@/shared/ui/session-block/session-block.constants";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import "@/features/community/qna-inbox.css";
import "@/features/community/notice-tree.css";
import "@/features/community/board-admin.css";

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

  const [expandedParent, setExpandedParent] = useState(false);
  const [expandedLectureId, setExpandedLectureId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  // Auto-provision materials block type
  const { data: materialsTypeId, isLoading: typeLoading, isError: typeError } = useQuery({
    queryKey: ["community-materials-type-ensure"],
    queryFn: ensureMaterialsBlockType,
    staleTime: Infinity,
    retry: 2,
  });

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

  // ── All materials posts for tree counts ──
  const { data: allMatPostsForCount = [] } = useQuery<PostEntity[]>({
    queryKey: ["community-all-materials-posts-for-count", materialsTypeId],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ blockTypeId: materialsTypeId!, pageSize: 500 });
      return results;
    },
    enabled: materialsTypeId != null,
  });

  const treeCounts = useMemo(() => {
    const scopeNodeIds = new Set(scopeNodes.map((n) => n.id));
    const countByNodeId: Record<number, number> = {};
    for (const n of scopeNodes) countByNodeId[n.id] = 0;
    for (const p of allMatPostsForCount) {
      for (const m of p.mappings ?? []) {
        if (scopeNodeIds.has(m.node)) countByNodeId[m.node] = (countByNodeId[m.node] ?? 0) + 1;
      }
    }
    const total = allMatPostsForCount.length;
    const totalUnderScope = allMatPostsForCount.filter((p) =>
      p.mappings?.some((m) => scopeNodeIds.has(m.node))
    ).length;
    const countByLecture: Record<number, number> = {};
    for (const lec of lectures) countByLecture[lec.id] = 0;
    for (const p of allMatPostsForCount) {
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
  }, [allMatPostsForCount, scopeNodes, lectures]);

  // ── Posts for current scope ──
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );

  const hasScopeParam = searchParams.has("scope");
  const canShowList =
    hasScopeParam && (
      scope === "all" ||
      (scope === "lecture" && effectiveLectureId != null) ||
      (scope === "session" && sessionId != null)
    );

  const postsQ = useQuery<PostEntity[]>({
    queryKey: ["community-materials-posts-scoped", materialsTypeId, scope, nodeId],
    queryFn: async () => {
      const all = await fetchPosts({ nodeId: nodeId ?? undefined, pageSize: 500 });
      return materialsTypeId != null ? all.filter((p) => p.block_type === materialsTypeId) : all;
    },
    enabled: canShowList && materialsTypeId != null,
  });
  const posts = postsQ.data ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        stripHtml(p.content ?? "").toLowerCase().includes(q) ||
        (p.created_by_display ?? "").toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

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

  const toggleParent = useCallback(() => {
    setExpandedParent((p) => !p);
    if (expandedParent) setExpandedLectureId(null);
  }, [expandedParent]);

  const toggleLecture = useCallback((lecId: number) => {
    setExpandedLectureId((prev) => (prev === lecId ? null : lecId));
  }, []);

  // j/k keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = selectedId != null ? filtered.findIndex((p) => p.id === selectedId) : -1;
      if (e.key === "j") { e.preventDefault(); setSelectedId(filtered[Math.min(idx + 1, filtered.length - 1)].id); }
      else if (e.key === "k") { e.preventDefault(); setSelectedId(filtered[Math.max(idx <= 0 ? filtered.length : idx - 1, 0)].id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, setSelectedId]);

  if (typeLoading) {
    return (
      <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
        <div className="qna-inbox__empty" style={{ gridColumn: "1 / -1" }}>
          <p className="qna-inbox__empty-title">자료실 준비 중…</p>
        </div>
      </div>
    );
  }
  if (typeError) {
    return (
      <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
        <div className="qna-inbox__empty" style={{ gridColumn: "1 / -1" }}>
          <p className="qna-inbox__empty-title">자료실을 불러오지 못했습니다</p>
          <p className="qna-inbox__empty-desc">네트워크를 확인한 뒤 페이지를 새로고침해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
      {/* ═══ 1st pane: Tree nav ═══ */}
      <nav className="notice-tree__nav">
        <div className="notice-tree__nav-header">
          <h2 className="notice-tree__nav-title">자료실</h2>
        </div>

        <div className="notice-tree__tabs">
          <button
            type="button"
            className={`notice-tree__tab ${scope === "all" ? "notice-tree__tab--active notice-tree__tab--selected" : ""}`}
            onClick={selectAll}
          >
            <span className="notice-tree__tab-icon" aria-hidden>📋</span>
            <span className="notice-tree__tab-label">전체 자료</span>
            {treeCounts.total > 0 && <span className="notice-tree__count">{treeCounts.total}</span>}
            <span className="notice-tree__tab-chevron" aria-hidden />
          </button>
          <button
            type="button"
            className={`notice-tree__tab ${expandedParent ? "notice-tree__tab--active" : ""}`}
            onClick={toggleParent}
            aria-expanded={expandedParent}
          >
            <span className="notice-tree__tab-icon" aria-hidden>📁</span>
            <span className="notice-tree__tab-label">강의목록</span>
            {treeCounts.totalUnderScope > 0 && <span className="notice-tree__count">{treeCounts.totalUnderScope}</span>}
            <span className="notice-tree__tab-chevron">{expandedParent ? "▼" : "▶"}</span>
          </button>
        </div>

        <div className="notice-tree__sub">
          {expandedParent &&
            lectures.map((lec) => (
              <div key={`lec-${lec.id}`} className="notice-tree__branch">
                <button
                  type="button"
                  className={`notice-tree__sub-item notice-tree__sub-item--parent ${expandedLectureId === lec.id ? "notice-tree__sub-item--active" : ""} ${scope === "lecture" && lectureId === lec.id ? "notice-tree__sub-item--selected" : ""}`}
                  onClick={() => { toggleLecture(lec.id); selectLecture(lec.id); }}
                  aria-expanded={expandedLectureId === lec.id}
                >
                  <span className="notice-tree__sub-chevron">{expandedLectureId === lec.id ? "▼" : "▶"}</span>
                  <LectureChip lectureName={lec.title || lec.name || ""} color={lec.color ?? undefined} size={20} />
                  <span className="notice-tree__sub-label">{lec.title || lec.name || `강의 ${lec.id}`}</span>
                  {(treeCounts.countByLecture[lec.id] ?? 0) > 0 && <span className="notice-tree__count">{treeCounts.countByLecture[lec.id]}</span>}
                </button>
                {expandedLectureId === lec.id && (
                  <div className="notice-tree__children">
                    {sessionsLoading ? (
                      <div className="notice-tree__sub-item notice-tree__sub-item--child" style={{ color: "var(--color-text-muted)" }}>불러오는 중…</div>
                    ) : (
                      sessionsOfLecture.map((s) => {
                        const sessionNodeId = scopeNodes.find((n) => n.lecture === lec.id && n.session === s.id)?.id;
                        const sessionCount = sessionNodeId != null ? treeCounts.countByNodeId[sessionNodeId] ?? 0 : 0;
                        const supplement = isSupplement(s.title);
                        return (
                          <button
                            key={s.id} type="button"
                            className={`notice-tree__sub-item notice-tree__sub-item--child ${supplement ? "notice-tree__sub-item--supplement" : "notice-tree__sub-item--n1"} ${scope === "session" && lectureId === lec.id && sessionId === s.id ? "notice-tree__sub-item--active notice-tree__sub-item--selected" : ""}`}
                            onClick={() => selectSession(lec.id, s.id)}
                          >
                            <span className="notice-tree__sub-item-child-icon" aria-hidden>ㄴ</span>
                            <span className="notice-tree__sub-label">{s.title || `${s.order}차시`}</span>
                            {sessionCount > 0 && <span className="notice-tree__count">{sessionCount}</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </nav>

      {/* ═══ 2nd pane: List ═══ */}
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 className="qna-inbox__list-title">자료</h2>
            <Button intent="primary" size="sm" onClick={() => { setShowCreate(true); setSelectedId(null); }}>+ 자료 등록</Button>
          </div>
          <div className="flex items-center gap-2">
            <input type="search" className="ds-input flex-1 min-w-0" placeholder="제목 · 내용 · 작성자" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="자료실 검색" />
          </div>
        </div>

        <div className="qna-inbox__list-body">
          {!canShowList ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">{expandedParent ? "강의 또는 차시를 선택하세요" : "전체 자료 또는 강의를 선택하세요"}</p>
            </div>
          ) : postsQ.isLoading ? (
            <div className="qna-inbox__empty"><p className="qna-inbox__empty-title">불러오는 중…</p></div>
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">{searchQuery.trim() ? "검색 결과가 없습니다" : "등록된 자료가 없습니다"}</p>
              <p className="qna-inbox__empty-desc">{searchQuery.trim() ? "다른 검색어를 입력해 보세요." : "'자료 등록' 버튼으로 첫 자료를 등록하세요."}</p>
            </div>
          ) : (
            filtered.map((p) => (
              <MatPostCard key={p.id} post={p} isActive={p.id === selectedId} onClick={() => setSelectedId(p.id)} />
            ))
          )}
        </div>
      </aside>

      {/* ═══ 3rd pane: Detail / Create ═══ */}
      <main className="qna-inbox__thread">
        {showCreate && materialsTypeId != null ? (
          <MatCreatePane
            materialsTypeId={materialsTypeId}
            scopeNodes={scopeNodes}
            scopeParams={scopeParams}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["community-materials-posts-scoped"] });
              qc.invalidateQueries({ queryKey: ["community-all-materials-posts-for-count"] });
              setShowCreate(false);
              feedback.success("자료가 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
          <div className="qna-inbox__empty">
            <p className="qna-inbox__empty-title">자료를 선택하세요</p>
            <p className="qna-inbox__empty-desc">왼쪽 목록에서 자료를 클릭하면 내용이 표시됩니다.</p>
            <p className="qna-inbox__keyboard-hint"><kbd>j</kbd> 다음 · <kbd>k</kbd> 이전</p>
          </div>
        ) : (
          <MatDetailView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["community-materials-posts-scoped"] });
              qc.invalidateQueries({ queryKey: ["community-all-materials-posts-for-count"] });
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
  scopeNodes,
  scopeParams,
  onCancel,
  onSuccess,
}: {
  materialsTypeId: number;
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return scopeNodes.filter((n) => n.level === "COURSE").map((n) => n.id);
  }, [scopeNodes, scopeParams]);

  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의"
    : "전체 자료";

  const canSubmit = title.trim().length > 0 && autoNodeIds.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({ block_type: materialsTypeId, title: title.trim(), content, node_ids: autoNodeIds });
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? (e as Error)?.message ?? "등록에 실패했습니다.";
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
            <div className="qna-inbox__thread-meta">
              <span>대상: {scopeLabel}</span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions"><Button intent="ghost" size="sm" onClick={onCancel}>취소</Button></div>
        </div>
      </header>
      <div className="qna-inbox__thread-body" style={{ padding: "var(--space-4, 16px) var(--space-5, 20px)" }}>
        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <label className="community-field__label community-field__label--required" style={{ display: "block", marginBottom: 6 }}>제목</label>
          <input className="ds-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료 제목을 입력하세요" style={{ width: "100%" }} autoFocus />
        </div>
        <div style={{ marginBottom: "var(--space-4, 16px)" }}>
          <label className="community-field__label" style={{ display: "block", marginBottom: 6 }}>내용</label>
          <RichTextEditor value={content} onChange={setContent} placeholder="자료 내용을 입력하세요. 이미지를 삽입하거나 파일을 첨부할 수 있습니다." minHeight={250} />
        </div>
        {error && <p className="community-field__error">{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
          <Button intent="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>{submitting ? "등록 중…" : "등록"}</Button>
        </div>
      </div>
    </>
  );
}

/* ─── Post Card ──────────────────────────────────────── */
function MatPostCard({ post, isActive, onClick }: { post: PostEntity; isActive: boolean; onClick: () => void }) {
  const plainText = stripHtml(post.content ?? "");
  const snippet = plainText.length > SNIPPET_LEN ? plainText.slice(0, SNIPPET_LEN).trim() + "…" : plainText;
  const authorName = post.created_by_deleted ? "삭제된 사용자" : (post.created_by_display ?? "관리자");

  return (
    <button type="button" onClick={onClick} className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""}`}>
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-avatar-wrap"><MatAvatar name={authorName} size={30} /></div>
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row"><div className="qna-inbox__card-title">{post.title || "(제목 없음)"}</div></div>
          {snippet && <div className="qna-inbox__card-snippet">{snippet}</div>}
          <div className="qna-inbox__card-meta">
            <span>{authorName}</span><span className="qna-inbox__card-meta-dot" /><span>{timeAgo(post.created_at)}</span>
            {(post.replies_count ?? 0) > 0 && (<><span className="qna-inbox__card-meta-dot" /><span>댓글 {post.replies_count}</span></>)}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─── Detail View ────────────────────────────────────── */
function MatDetailView({ postId, onClose, onDeleted }: { postId: number; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const { data: post, isLoading } = useQuery({ queryKey: ["community-post", postId], queryFn: () => fetchPost(postId), enabled: postId != null });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => { setEditingTitle(false); if (post) { setEditTitle(post.title ?? ""); setEditContent(post.content ?? ""); } }, [post?.id]);

  const updateMut = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-materials-posts-scoped"] });
      qc.invalidateQueries({ queryKey: ["community-all-materials-posts-for-count"] });
      setEditingTitle(false);
      feedback.success("수정되었습니다.");
    },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "수정에 실패했습니다."); },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => { feedback.success("자료가 삭제되었습니다."); onDeleted(); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."); },
  });

  if (isLoading || !post) return <div className="qna-inbox__empty"><p className="qna-inbox__empty-title">{isLoading ? "불러오는 중…" : "자료를 찾을 수 없습니다."}</p></div>;

  const authorName = post.created_by_deleted ? "삭제된 사용자" : (post.created_by_display ?? "관리자");
  const contentDirty = editContent !== (post.content ?? "");

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group" style={{ flex: 1, minWidth: 0 }}>
            {editingTitle ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <input className="ds-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ flex: 1, fontSize: 15, fontWeight: 600 }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") updateMut.mutate({ title: editTitle }); if (e.key === "Escape") setEditingTitle(false); }} />
                <Button size="sm" intent="primary" onClick={() => updateMut.mutate({ title: editTitle })} disabled={updateMut.isPending || !editTitle.trim()}>저장</Button>
                <Button size="sm" intent="secondary" onClick={() => setEditingTitle(false)}>취소</Button>
              </div>
            ) : (
              <h1 className="qna-inbox__thread-title" style={{ cursor: "text" }} title="클릭하여 제목 수정" onClick={() => setEditingTitle(true)}>{post.title}</h1>
            )}
            <div className="qna-inbox__thread-meta">
              <span>{authorName}</span>
              <span className="qna-inbox__thread-meta-dot" />
              <span>{new Date(post.created_at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onClose}>목록</Button>
            <Button intent="danger" size="sm" disabled={deleteMut.isPending} onClick={() => window.confirm("이 자료를 삭제할까요?") && deleteMut.mutate()}>삭제</Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__thread-body">
        <div className="qna-inbox__message-row">
          <MatAvatar name={authorName} size={32} />
          <div className="qna-inbox__message-bubble" style={{ flex: 1, minWidth: 0 }}>
            <div className="qna-inbox__message-meta">
              <span className="qna-inbox__message-author">{authorName}</span>
              <span className="qna-inbox__message-date">{new Date(post.created_at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <RichTextEditor value={editContent} onChange={setEditContent} placeholder="내용을 입력하세요." minHeight={200} />
            {contentDirty && (
              <div style={{ marginTop: 8 }}>
                <Button size="sm" intent="primary" onClick={() => updateMut.mutate({ content: editContent })} disabled={updateMut.isPending}>
                  {updateMut.isPending ? "저장 중…" : "내용 저장"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {(post.replies_count ?? 0) > 0 && (
          <div className="qna-inbox__thread-sep"><span className="qna-inbox__thread-sep-label">댓글 {post.replies_count}개</span></div>
        )}
        <MatCommentThread postId={postId} />
      </div>
      <MatCommentComposer postId={postId} />
    </>
  );
}

/* ─── Comment Thread ─────────────────────────────────── */
function MatCommentThread({ postId }: { postId: number }) {
  const { data: replies = [], isLoading } = useQuery<Answer[]>({ queryKey: ["post-replies", postId], queryFn: () => fetchPostReplies(postId) });
  if (isLoading) return <div style={{ padding: "12px 0" }}><p className="qna-inbox__empty-desc">댓글 불러오는 중…</p></div>;
  return <>{replies.map((r) => <MatCommentBlock key={r.id} postId={postId} reply={r} />)}</>;
}

function MatCommentBlock({ postId, reply }: { postId: number; reply: Answer }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const authorName = reply.created_by_display ?? "관리자";

  const updateMut = useMutation({
    mutationFn: () => updateReplyApi(postId, reply.id, editContent),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["post-replies", postId] }); setEditing(false); feedback.success("댓글이 수정되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "수정에 실패했습니다."); },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteReplyApi(postId, reply.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["post-replies", postId] }); feedback.success("댓글이 삭제되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."); },
  });

  return (
    <div className="qna-inbox__message-row qna-inbox__message-row--teacher">
      <MatAvatar name={authorName} size={32} />
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
            <div className="qna-inbox__message-body">{reply.content}</div>
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>수정</Button>
              <Button size="sm" intent="ghost" onClick={() => window.confirm("이 댓글을 삭제할까요?") && deleteMut.mutate()} disabled={deleteMut.isPending}>삭제</Button>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["post-replies", postId] }); qc.invalidateQueries({ queryKey: ["community-materials-posts-scoped"] }); setContent(""); feedback.success("댓글이 등록되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "등록에 실패했습니다."); },
  });

  return (
    <div className="qna-inbox__composer">
      <div className="qna-inbox__composer-inner">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && content.trim() && !createMut.isPending) { e.preventDefault(); createMut.mutate(); } }} placeholder="댓글을 작성하세요…" rows={3} />
        <div className="qna-inbox__composer-footer">
          <span className="qna-inbox__composer-hint"><kbd>⌘</kbd><kbd>Enter</kbd> 빠른 등록</span>
          <Button intent="primary" size="sm" onClick={() => createMut.mutate()} disabled={!content.trim() || createMut.isPending}>{createMut.isPending ? "등록 중…" : "댓글 등록"}</Button>
        </div>
      </div>
    </div>
  );
}
