// PATH: src/app_admin/domains/community/pages/MaterialsBoardPage.tsx
// 자료실 — 3-pane (좌측 강의/차시 트리 | 목록 | 상세·글쓰기)
// 공지사항·게시판과 동일한 카테고리(트리) 디자인

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/useCommunityScope";
import {
  fetchAdminPosts,
  fetchScopeNodes,
  resolveNodeIdFromScope,
  fetchPost,
  updatePost,
  deletePost,
  type PostEntity,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { useScopeFilteredPosts } from "../hooks/useScopeFilteredPosts";
import { useScopeNavigation } from "../hooks/useScopeNavigation";
import { useTreeCounts } from "../hooks/useTreeCounts";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { adminCommunityQueryKeys } from "../queryKeys";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/shared/api/contracts/sessions";
import { getCommunityStorageCleanupNotice } from "@/shared/api/contracts/community";
import CmsTreeNav from "../components/CmsTreeNav";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import ScopeBadge from "../components/ScopeBadge";
import { resolveScopeType } from "../utils/scopeBadge";
import PostCreatePane from "../components/PostCreatePane";
import PostContentEditor from "../components/PostContentEditor";
import PostAttachmentManager from "../components/PostAttachmentManager";
import CommunityContextBar from "../components/CommunityContextBar";
import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityAvatar from "../components/CommunityAvatar";
import { stripHtml, timeAgo } from "../utils/communityHelpers";
import "@admin/domains/community/qna-inbox.css";
import "@admin/domains/community/notice-tree.css";
import "@admin/domains/community/board-admin.css";

const SNIPPET_LEN = 80;

/* ─── helpers ─────────────────────────────────────────── */

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

  const [expandedLectureId, setExpandedLectureId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const scopeNodesQ = useQuery<ScopeNodeMinimal[]>({
    queryKey: adminCommunityQueryKeys.scopeNodes,
    queryFn: fetchScopeNodes,
  });
  const scopeNodes = useMemo(() => scopeNodesQ.data ?? [], [scopeNodesQ.data]);

  const lecturesQ = useQuery<Lecture[]>({
    queryKey: adminCommunityQueryKeys.lecturesList,
    queryFn: () => fetchLectures({ is_active: true }),
  });
  const lectures = lecturesQ.data ?? [];

  const sessionsQ = useQuery<Session[]>({
    queryKey: adminCommunityQueryKeys.lectureSessions(expandedLectureId),
    queryFn: () => fetchSessions(expandedLectureId!),
    enabled: expandedLectureId != null && Number.isFinite(expandedLectureId),
  });
  const sessionsOfLecture = sessionsQ.data ?? [];
  const sessionsLoading = sessionsQ.isLoading;

  // 트리 노드별 자료실 개수 — 백엔드 단일 집계
  const { counts: treeCounts } = useTreeCounts("materials");

  // ── Posts for current scope ──
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );

  const canShowList = true;

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  // 자료실 전체 목록 (post_type 기반, scope는 클라이언트 필터, q는 서버 검색)
  const postsQ = useQuery<PostEntity[]>({
    queryKey: adminCommunityQueryKeys.materialsPostsList(debouncedQuery),
    queryFn: async () => {
      const { results } = await fetchAdminPosts({
        postType: "materials",
        q: debouncedQuery.trim() || null,
        pageSize: 500,
      });
      return results;
    },
  });
  const allMaterialsPosts = useMemo(() => postsQ.data ?? [], [postsQ.data]);

  // ✅ V1.1.1: 강의/차시 scope에서 전체글(GLOBAL)을 제외 (공통 훅)
  const scopedPosts = useScopeFilteredPosts({
    posts: allMaterialsPosts,
    scopeNodes,
    scope,
    nodeId,
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return scopedPosts;
    const q = searchQuery.trim().toLowerCase();
    return scopedPosts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        stripHtml(p.content ?? "").toLowerCase().includes(q) ||
        (p.created_by_display ?? "").toLowerCase().includes(q)
    );
  }, [scopedPosts, searchQuery]);

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

  // 트리 선택 콜백 (공통 훅)
  const { selectAll, selectLecture, selectSession } = useScopeNavigation({
    onChange: () => setShowCreate(false),
  });

  useEffect(() => {
    if (selectedId == null || showCreate || postsQ.isFetching) return;
    if (!filtered.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId, showCreate, postsQ.isFetching, setSelectedId]);

  // j/k keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const element = e.target as HTMLElement;
      if (["TEXTAREA", "INPUT", "SELECT"].includes(element.tagName) || element.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = selectedId != null ? filtered.findIndex((p) => p.id === selectedId) : -1;
      if (e.key === "j") { e.preventDefault(); setSelectedId(filtered[Math.min(idx + 1, filtered.length - 1)].id); }
      else if (e.key === "k") { e.preventDefault(); const t = idx <= 0 ? filtered.length - 1 : idx - 1; setSelectedId(filtered[Math.max(t, 0)].id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, setSelectedId]);

  if (scopeNodesQ.isError || lecturesQ.isError || sessionsQ.isError) {
    return (
      <CommunityEmptyState
        variant="error"
        postType="materials"
        title="자료 범위를 불러오지 못했습니다"
        description="잘못된 강의·차시에 자료를 게시하지 않도록 범위를 복구한 뒤 작성할 수 있습니다."
        action={
          <Button intent="secondary" size="sm" onClick={() => {
            void scopeNodesQ.refetch();
            void lecturesQ.refetch();
            if (expandedLectureId != null) void sessionsQ.refetch();
          }}>다시 시도</Button>
        }
      />
    );
  }

  return (
    <div className={`notice-tree notice-tree--viewport${selectedId != null || showCreate ? " notice-tree--has-detail" : ""}`}>
      <CmsTreeNav
        title="자료실"
        allLabel="전체 보기"
        counts={{
          totalCount: treeCounts.totalCount,
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
        <div className="qna-inbox__list-header">
          <div className="qna-inbox__list-title-row">
            <div className="qna-inbox__list-title-group">
              <h2 className="qna-inbox__list-title">자료</h2>
              <CommunityContextBar
                scope={scope}
                lectureName={lectures.find((l) => l.id === lectureId)?.title ?? null}
                sessionName={sessionsOfLecture.find((s) => s.id === sessionId)?.title ?? null}
              />
            </div>
            {canShowList && <Button intent="primary" size="sm" onClick={() => { setShowCreate(true); setSelectedId(null); }}>+ 자료 등록</Button>}
          </div>
          <div className="flex items-center gap-2">
            <input type="search" className="ds-input flex-1 min-w-0" placeholder="제목 · 내용 · 작성자" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="자료실 검색" />
          </div>
          <p className="materials-board__hint">
            💡 자료실은 강의 자료 다운로드 전용입니다. 댓글·질문은 게시판/QnA에서.
          </p>
        </div>

        <div className="qna-inbox__list-body">
          {!canShowList ? (
            <CommunityEmptyState variant="no-scope" postType="materials" />
          ) : postsQ.isError ? (
            <CommunityEmptyState variant="error" postType="materials" />
          ) : postsQ.isLoading ? (
            <CommunityEmptyState variant="loading" postType="materials" />
          ) : filtered.length === 0 ? (
            <CommunityEmptyState
              variant={searchQuery.trim() ? "no-results" : "no-posts"}
              postType="materials"
              description={searchQuery.trim() ? undefined : "'+ 자료 등록' 버튼으로 첫 자료를 등록하세요."}
            />
          ) : (
            filtered.map((p) => (
              <MatPostCard key={p.id} post={p} isActive={p.id === selectedId} onClick={() => setSelectedId(p.id)} />
            ))
          )}
        </div>
      </aside>

      {/* ═══ 3rd pane: Detail / Create ═══ */}
      <main className="qna-inbox__thread">
        {showCreate ? (
          <PostCreatePane postType="materials"
            scopeNodes={scopeNodes}
            scopeParams={scopeParams}
            onCancel={() => setShowCreate(false)}
            onSuccess={(postId) => {
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.materialsPosts });
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("materials") });
              setShowCreate(false);
              setSelectedId(postId);
              feedback.success("자료가 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
          <CommunityEmptyState variant="no-selection" postType="materials" showKeyboardHint />
        ) : (
          <MatDetailView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.materialsPosts });
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("materials") });
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ─── Post Card ──────────────────────────────────────── */
function MatPostCard({ post, isActive, onClick }: { post: PostEntity; isActive: boolean; onClick: () => void }) {
  const plainText = stripHtml(post.content ?? "");
  const snippet = plainText.length > SNIPPET_LEN ? plainText.slice(0, SNIPPET_LEN).trim() + "…" : plainText;
  const authorName = post.created_by_deleted ? "삭제된 사용자" : (post.created_by_display ?? "관리자");

  const scopeType = resolveScopeType(post);
  const nd = post.mappings?.[0]?.node_detail;
  const scopePath = scopeType === "global"
    ? "전체 대상"
    : nd?.session_title
    ? `${nd.lecture_title} > ${nd.session_title}`
    : nd?.lecture_title ?? "";

  return (
    <button type="button" onClick={onClick} className={`cms-list-card ${isActive ? "cms-list-card--active" : ""} cms-list-card--${scopeType}`}>
      <div className={`cms-list-card__bar cms-list-card__bar--${scopeType}`} />
      <div className="cms-list-card__inner">
        <div className="cms-list-card__header">
          <span className={`cms-list-card__type cms-list-card__type--${scopeType}`}>
            {scopeType === "global" ? "전체 대상" : scopeType === "session" ? "차시" : "강의"}
          </span>
          <span className="cms-list-card__scope">{scopePath}</span>
          <span className="cms-list-card__date">{timeAgo(post.created_at)}</span>
        </div>
        <div className="cms-list-card__title">{post.title || "(제목 없음)"}</div>
        {snippet && <div className="cms-list-card__snippet">{snippet}</div>}
        <div className="cms-list-card__meta">
          <span>{authorName}</span>
          {(post.attachments?.length ?? 0) > 0 && <span className="cms-list-card__meta-tag">파일 {post.attachments!.length}개</span>}
        </div>
      </div>
    </button>
  );
}

/* ─── Detail View ────────────────────────────────────── */
function MatDetailView({ postId, onClose, onDeleted }: { postId: number; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: post, isLoading } = useQuery({ queryKey: adminCommunityQueryKeys.post(postId), queryFn: () => fetchPost(postId), enabled: postId != null });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    setEditingTitle(false);
    if (post) {
      setEditTitle(post.title ?? "");
    }
    // Reset only on a different post; attachment refresh must preserve title edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const updateMut = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.materialsPosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("materials") });
      setEditingTitle(false);
      feedback.success("수정되었습니다.");
    },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "수정에 실패했습니다."); },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.materialsPosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("materials") });
      const cleanupNotice = getCommunityStorageCleanupNotice(result);
      if (cleanupNotice) feedback.warning(cleanupNotice);
      else feedback.success("자료가 삭제되었습니다.");
      onDeleted();
    },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."); },
  });

  if (isLoading || !post) return <div className="qna-inbox__empty"><p className="qna-inbox__empty-title">{isLoading ? "불러오는 중…" : "자료를 찾을 수 없습니다."}</p></div>;

  const authorName = post.created_by_deleted ? "삭제된 사용자" : (post.created_by_display ?? "관리자");

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group cms-detail__title-group">
            {editingTitle ? (
              <div className="cms-detail__title-edit-row">
                <input className="ds-input cms-detail__title-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && editTitle.trim() && !updateMut.isPending) updateMut.mutate({ title: editTitle }); if (e.key === "Escape") setEditingTitle(false); }} />
                <Button size="sm" intent="primary" onClick={() => updateMut.mutate({ title: editTitle })} disabled={updateMut.isPending || !editTitle.trim()}>저장</Button>
                <Button size="sm" intent="secondary" onClick={() => setEditingTitle(false)}>취소</Button>
              </div>
            ) : (
              <h1 className="qna-inbox__thread-title cms-detail__title-clickable" title="클릭하여 제목 수정" onClick={() => setEditingTitle(true)}>{post.title}</h1>
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
            <Button intent="danger" size="sm" disabled={deleteMut.isPending} onClick={async () => { if (await confirm({ title: "자료 삭제", message: "이 자료를 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate(); }}>삭제</Button>
          </div>
        </div>
      </header>

      <div className="cms-detail__body">
        {/* Author/date meta row */}
        <div className="cms-detail__meta-row">
          <CommunityAvatar name={authorName} size={32} />
          <span className="cms-detail__meta-author">{authorName}</span>
          <span className="cms-detail__meta-dot" />
          <ScopeBadge post={post} />
          <span className="cms-detail__meta-dot" />
          <span>{timeAgo(post.created_at)}</span>
        </div>

        {/* Section: 첨부파일 (파일 우선 노출) */}
        <div className="cms-detail__section">
          <PostAttachmentManager key={postId} postId={postId} attachments={post.attachments ?? []} nativePicker />
        </div>

        {/* Section: 내용 */}
        <div className="cms-detail__section">
          <div className="cms-detail__section-label">내용</div>
          <div className="cms-detail__content-card">
            <PostContentEditor key={post.id} post={post} />
          </div>
        </div>

        {/* 자료실은 일방향 다운로드 정책 — 댓글 비활성화 (백엔드도 차단) */}
      </div>
    </>
  );
}
