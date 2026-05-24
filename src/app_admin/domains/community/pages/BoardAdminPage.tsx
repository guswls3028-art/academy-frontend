// PATH: src/app_admin/domains/community/pages/BoardAdminPage.tsx
// 게시판 — 3-pane (좌측 강의/차시 트리 | 목록 | 상세·글쓰기)
// 공지사항과 동일한 카테고리(트리) 디자인
//
// inline style baseline 면제 — 3-pane 동적 width/scoping + bulk action bar 동적 색.
/* eslint-disable no-restricted-syntax */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/useCommunityScope";
import {
  fetchAdminPosts,
  fetchScopeNodes,
  resolveNodeIdFromScope,
  resolvePostNodeIdsForCreate,
  fetchPost,
  createPost,
  deletePost,
  updatePost,
  uploadPostAttachments,
  getAttachmentDownloadUrl,
  deletePostAttachment,
  bulkUpdatePostStatus,
  type PostEntity,
  type PostAttachment,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
  type BulkStatusValue,
} from "../api/community.api";
import { useScopeFilteredPosts } from "../hooks/useScopeFilteredPosts";
import { useScopeNavigation } from "../hooks/useScopeNavigation";
import { useTreeCounts } from "../hooks/useTreeCounts";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/shared/api/contracts/sessions";
import CmsTreeNav from "../components/CmsTreeNav";
import { Button, Badge } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import ScopeBadge from "../components/ScopeBadge";
import { resolveScopeType } from "../utils/scopeBadge";
import PostReadView from "../components/PostReadView";
import CommunityContextBar from "../components/CommunityContextBar";
import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityAvatar from "../components/CommunityAvatar";
import PostThreadView from "../components/PostThreadView";
import { stripHtml, timeAgo, formatFileSize } from "../utils/communityHelpers";
import "@admin/domains/community/qna-inbox.css";
import "@admin/domains/community/notice-tree.css";
import "@admin/domains/community/board-admin.css";

const SNIPPET_LEN = 80;

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

  // 다중 선택 일괄 status 변경 (#50 G1, 2026-05-12) — 학원장 운영 도구.
  // 오래된 글 일괄 archive, draft 일괄 게시. backend `/community/admin/posts/bulk-status/`.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState<BulkStatusValue | null>(null);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => { setSelectedIds(new Set()); }, []);

  const handleBulkStatus = useCallback(async (newStatus: BulkStatusValue) => {
    if (selectedIds.size === 0 || bulkSubmitting != null) return;
    const labelMap: Record<BulkStatusValue, string> = {
      published: "게시", archived: "보관", draft: "임시저장",
    };
    const ok = await confirm({
      title: `${labelMap[newStatus]} 처리`,
      message: `선택한 ${selectedIds.size}건의 게시물을 "${labelMap[newStatus]}" 상태로 변경합니다. 진행할까요?`,
      confirmText: labelMap[newStatus],
    });
    if (!ok) return;
    setBulkSubmitting(newStatus);
    try {
      const res = await bulkUpdatePostStatus(Array.from(selectedIds), newStatus);
      feedback.success(`${res.updated}건 ${labelMap[newStatus]} 완료`);
      qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
      qc.invalidateQueries({ queryKey: ["community", "board", "counts"] });
      clearSelection();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "일괄 변경 실패");
    } finally {
      setBulkSubmitting(null);
    }
  }, [selectedIds, bulkSubmitting, clearSelection, confirm, qc]);

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

  // 트리 노드별 게시판 개수 — 백엔드 단일 집계
  const { counts: treeCounts } = useTreeCounts("board");

  // ── Posts for current scope ──
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );

  const canShowList = true;

  // 검색어 디바운스 (서버사이드 검색)
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  // 게시판 전체 목록 (post_type 기반, scope는 클라이언트 필터, q는 서버 검색)
  const postsQ = useQuery<PostEntity[]>({
    queryKey: ["community-board-posts-all", debouncedQuery],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({
        postType: "board",
        q: debouncedQuery.trim() || null,
        pageSize: 500,
      });
      return results;
    },
  });
  const allBoardPosts = useMemo(() => postsQ.data ?? [], [postsQ.data]);

  // scope 기반 클라이언트 필터 (전체 → 모든 글, 강의/차시 → 해당 노드 + 상하위 + GLOBAL 제외)
  const boardPosts = useScopeFilteredPosts({ posts: allBoardPosts, scopeNodes, scope, nodeId });

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

  // 전체 선택 + Esc 해제 (#50 후속 — 운영 편의).
  const allChecked = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someChecked = !allChecked && filtered.some((p) => selectedIds.has(p.id));
  const toggleSelectAll = useCallback(() => {
    if (allChecked) {
      // 현재 visible 항목만 해제 (다른 scope 선택은 유지)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of filtered) next.delete(p.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of filtered) next.add(p.id);
        return next;
      });
    }
  }, [allChecked, filtered]);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && bulkSubmitting == null) {
        // 글쓰기 모달이 열린 경우 그 ESC가 우선이라 stop X. 단순히 우리 selection만 clear.
        setSelectedIds(new Set());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedIds.size, bulkSubmitting]);

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
    if (selectedId == null || showCreate || postsQ.isLoading) return;
    if (!filtered.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId, showCreate, postsQ.isLoading, setSelectedId]);

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
              <h2 className="qna-inbox__list-title">게시물</h2>
              <CommunityContextBar
                scope={scope}
                lectureName={lectures.find((l) => l.id === lectureId)?.title ?? null}
                sessionName={sessionsOfLecture.find((s) => s.id === sessionId)?.title ?? null}
              />
            </div>
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
          {filtered.length > 0 && (
            <label
              data-testid="board-select-all"
              style={{
                marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, color: "var(--color-text-muted)", cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleSelectAll}
                style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--color-brand-primary, #2563EB)" }}
              />
              현재 목록 전체 선택 ({filtered.length}건)
            </label>
          )}
          {selectedIds.size > 0 && (
            <div
              data-testid="board-bulk-bar"
              style={{
                marginTop: 8, padding: "8px 10px", borderRadius: 8,
                background: "var(--color-bg-accent-soft, rgba(37,99,235,0.06))",
                border: "1px solid var(--color-border-accent, rgba(37,99,235,0.18))",
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                {selectedIds.size}건 선택
              </span>
              <span style={{ flex: 1 }} />
              <Button
                intent="primary" size="sm"
                onClick={() => handleBulkStatus("published")}
                disabled={bulkSubmitting != null}
              >게시</Button>
              <Button
                intent="ghost" size="sm"
                onClick={() => handleBulkStatus("draft")}
                disabled={bulkSubmitting != null}
              >임시저장</Button>
              <Button
                intent="ghost" size="sm"
                onClick={() => handleBulkStatus("archived")}
                disabled={bulkSubmitting != null}
              >보관</Button>
              <Button intent="ghost" size="sm" onClick={clearSelection} disabled={bulkSubmitting != null}>
                선택 해제 (Esc)
              </Button>
            </div>
          )}
        </div>

        <div className="qna-inbox__list-body">
          {!canShowList ? (
            <CommunityEmptyState variant="no-scope" postType="board" />
          ) : postsQ.isError ? (
            <CommunityEmptyState variant="error" postType="board" />
          ) : postsQ.isLoading ? (
            <CommunityEmptyState variant="loading" postType="board" />
          ) : filtered.length === 0 ? (
            <CommunityEmptyState
              variant={searchQuery.trim() ? "no-results" : "no-posts"}
              postType="board"
              description={searchQuery.trim() ? undefined : "'+ 글쓰기' 버튼으로 첫 게시물을 등록하세요."}
            />
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "stretch", gap: 6 }}
              >
                <label
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    paddingLeft: 4, paddingRight: 4, cursor: "pointer",
                    flexShrink: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title="다중 선택 (학원장 일괄 처리)"
                >
                  <input
                    type="checkbox"
                    data-testid="board-post-checkbox"
                    data-post-id={p.id}
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--color-brand-primary, #2563EB)" }}
                  />
                </label>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BoardPostCard
                    post={p}
                    isActive={p.id === selectedId}
                    onClick={() => setSelectedId(p.id)}
                  />
                </div>
              </div>
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
              qc.invalidateQueries({ queryKey: ["community", "board", "counts"] });
              setShowCreate(false);
              feedback.success("게시물이 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
          <CommunityEmptyState variant="no-selection" postType="board" showKeyboardHint />
        ) : (
          <PostDetailView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
              qc.invalidateQueries({ queryKey: ["community", "board", "counts"] });
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedScope = useMemo(
    () => resolvePostNodeIdsForCreate(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );

  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의"
    : "전체 대상";

  const canSubmit = title.trim().length > 0 && resolvedScope.kind !== "invalid" && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await createPost({
        post_type: "board",
        title: title.trim(),
        content,
        node_ids: resolvedScope.nodeIds,
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
              <Badge tone="primary">게시 대상: {scopeLabel}</Badge>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {scopeParams.scope === "all"
                ? "이 글은 전체 학생에게 보입니다."
                : <>이 글은 <strong>{scopeLabel}</strong> 학생에게만 보입니다.</>}
            </p>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
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
            <label className="community-field__label cms-form__label--no-margin">
              첨부파일 {files.length > 0 && `(${files.length}/10)`}
            </label>
            <Button intent="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={files.length >= 10}>
              + 파일 추가
            </Button>
            <input
              ref={(el) => { fileInputRef.current = el; }}
              type="file"
              multiple
              className="cms-form__file-input--hidden"
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
          {(post.replies_count ?? 0) > 0 && <span className="cms-list-card__meta-tag">댓글 {post.replies_count}</span>}
          {(post.attachments?.length ?? 0) > 0 && <span className="cms-list-card__meta-tag">파일 {post.attachments!.length}</span>}
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

  // post?.id 변경 시에만 편집 상태 리셋 — post 객체 전체를 dep로 넣으면
  // 뮤테이션 후 refetch마다 편집 중 상태가 초기화됨
  useEffect(() => {
    setEditingTitle(false);
    setEditingContent(false);
    if (post) {
      setEditTitle(post.title ?? "");
      setEditContent(post.content ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const updateMut = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-board-posts-all"] });
      qc.invalidateQueries({ queryKey: ["community", "board", "counts"] });
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

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group cms-detail__title-group">
            {editingTitle ? (
              <div className="cms-detail__title-edit-row">
                <input
                  className="ds-input cms-detail__title-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateMut.mutate({ title: editTitle });
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
                <Button size="sm" intent="primary" onClick={() => updateMut.mutate({ title: editTitle })} disabled={updateMut.isPending || !editTitle.trim()}>저장</Button>
                <Button size="sm" intent="secondary" onClick={() => setEditingTitle(false)}>취소</Button>
              </div>
            ) : (
              <h1 className="qna-inbox__thread-title cms-detail__title-clickable" title="클릭하여 제목 수정" onClick={() => setEditingTitle(true)}>
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
          <CommunityAvatar name={authorName} size={32} />
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

        {/* Comments — 공통 PostThreadView 사용 */}
        {(post.replies_count ?? 0) > 0 && (
          <div className="qna-inbox__thread-sep">
            <span className="qna-inbox__thread-sep-label">댓글 {post.replies_count}개</span>
          </div>
        )}
        <PostThreadView
          postId={postId}
          mode="comment"
          invalidateKeys={[["community-board-posts-all"]]}
        />
      </div>
    </>
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          className="cms-form__file-input--hidden"
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

// CommentThread / CommentBlock / CommentComposer → PostThreadView로 통합
