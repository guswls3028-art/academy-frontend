// PATH: src/app_admin/domains/community/pages/MaterialsBoardPage.tsx
// 자료실 — 3-pane (좌측 강의/차시 트리 | 목록 | 상세·글쓰기)
// 공지사항·게시판과 동일한 카테고리(트리) 디자인

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchAdminPosts,
  fetchScopeNodes,
  resolveNodeIdFromScope,
  fetchPost,
  createPost,
  updatePost,
  deletePost,
  uploadPostAttachments,
  getAttachmentDownloadUrl,
  deletePostAttachment,
  type PostEntity,
  type PostAttachment,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { useScopeFilteredPosts } from "../hooks/useScopeFilteredPosts";
import { useScopeNavigation } from "../hooks/useScopeNavigation";
import { useTreeCounts } from "../hooks/useTreeCounts";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@admin/domains/lectures/api/sessions";
import CmsTreeNav from "../components/CmsTreeNav";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import ScopeBadge, { resolveScopeType } from "../components/ScopeBadge";
import PostReadView from "../components/PostReadView";
import CommunityContextBar from "../components/CommunityContextBar";
import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityAvatar from "../components/CommunityAvatar";
import { stripHtml, timeAgo, formatFileSize } from "../utils/communityHelpers";
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
    queryKey: ["community-materials-posts-all", debouncedQuery],
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

  // j/k keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = selectedId != null ? filtered.findIndex((p) => p.id === selectedId) : -1;
      if (e.key === "j") { e.preventDefault(); setSelectedId(filtered[Math.min(idx + 1, filtered.length - 1)].id); }
      else if (e.key === "k") { e.preventDefault(); const t = idx <= 0 ? filtered.length - 1 : idx - 1; setSelectedId(filtered[Math.max(t, 0)].id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, setSelectedId]);

  return (
    <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
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
                scope={scope as any}
                lectureName={lectures.find((l) => l.id === lectureId)?.title ?? null}
                sessionName={sessionsOfLecture.find((s) => s.id === sessionId)?.title ?? null}
                inline
              />
            </div>
            {canShowList && <Button intent="primary" size="sm" onClick={() => { setShowCreate(true); setSelectedId(null); }}>+ 자료 등록</Button>}
          </div>
          <div className="flex items-center gap-2">
            <input type="search" className="ds-input flex-1 min-w-0" placeholder="제목 · 내용 · 작성자" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="자료실 검색" />
          </div>
          <p style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}>
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
          <MatCreatePane
            scopeNodes={scopeNodes}
            scopeParams={scopeParams}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["community-materials-posts-all"] });
              qc.invalidateQueries({ queryKey: ["community", "materials", "counts"] });
              setShowCreate(false);
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
              qc.invalidateQueries({ queryKey: ["community-materials-posts-all"] });
              qc.invalidateQueries({ queryKey: ["community", "materials", "counts"] });
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ─── Inline Create Pane ──────────────────────────────── */
function MatCreatePane({
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-resolve node_ids from current scope
  // 전체 자료(scope=all)는 매핑 없음(node_ids=[])
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
    return [];
  }, [scopeNodes, scopeParams]);

  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의"
    : "전체 자료";

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await createPost({ post_type: "materials", title: title.trim(), content, node_ids: autoNodeIds });
      if (files.length > 0 && post?.id) {
        await uploadPostAttachments(post.id, files);
      }
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
              <span className="ds-badge ds-badge--primary">게시 대상: {scopeLabel}</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {scopeParams.scope === "all"
                ? "모든 강의의 학생에게 보이는 자료입니다."
                : <>이 자료는 <strong>{scopeLabel}</strong> 학생에게만 보입니다.</>}
            </p>
          </div>
          <div className="qna-inbox__thread-actions"><Button intent="secondary" size="sm" onClick={onCancel}>취소</Button></div>
        </div>
      </header>
      <div className="cms-form__body">
        <div className="cms-form__field">
          <label className="community-field__label community-field__label--required">제목</label>
          <input className="ds-input cms-form__input--full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료 제목을 입력하세요" autoFocus />
        </div>
        <div className="cms-form__field">
          <label className="community-field__label">내용</label>
          <RichTextEditor value={content} onChange={setContent} placeholder="자료 내용을 입력하세요. 이미지를 삽입하거나 파일을 첨부할 수 있습니다." minHeight={250} />
        </div>
        <div className="cms-form__field">
          <div className="cms-attach__header">
            <label className="community-field__label cms-form__label--no-margin">
              첨부파일 {files.length > 0 && `(${files.length}/10)`}
            </label>
            <Button intent="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={files.length >= 10}>
              + 파일 추가
            </Button>
            <input ref={fileInputRef} type="file" multiple className="cms-form__file-input--hidden" onChange={(e) => { if (e.target.files) { setFiles((prev) => [...prev, ...Array.from(e.target.files!)].slice(0, 10)); e.target.value = ""; } }} />
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

  const scopeType = resolveScopeType(post);
  const nd = post.mappings?.[0]?.node_detail;
  const scopePath = scopeType === "global"
    ? "모든 강의 대상"
    : nd?.session_title
    ? `${nd.lecture_title} > ${nd.session_title}`
    : nd?.lecture_title ?? "";

  return (
    <button type="button" onClick={onClick} className={`cms-list-card ${isActive ? "cms-list-card--active" : ""} cms-list-card--${scopeType}`}>
      <div className={`cms-list-card__bar cms-list-card__bar--${scopeType}`} />
      <div className="cms-list-card__inner">
        <div className="cms-list-card__header">
          <span className={`cms-list-card__type cms-list-card__type--${scopeType}`}>
            {scopeType === "global" ? "전체" : scopeType === "session" ? "차시" : "강의"}
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
  const { data: post, isLoading } = useQuery({ queryKey: ["community-post", postId], queryFn: () => fetchPost(postId), enabled: postId != null });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => { setEditingTitle(false); setEditingContent(false); if (post) { setEditTitle(post.title ?? ""); setEditContent(post.content ?? ""); } }, [post?.id]);

  const updateMut = useMutation({
    mutationFn: (data: { title?: string; content?: string }) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-materials-posts-all"] });
      qc.invalidateQueries({ queryKey: ["community", "materials", "counts"] });
      setEditingTitle(false);
      feedback.success("수정되었습니다.");
    },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "수정에 실패했습니다."); },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-post", postId] }); feedback.success("자료가 삭제되었습니다."); onDeleted(); },
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
          <MatAttachmentSection postId={postId} attachments={post.attachments ?? []} />
        </div>

        {/* Section: 내용 */}
        <div className="cms-detail__section">
          <div className="cms-detail__section-label">내용</div>
          <div className="cms-detail__content-card">
            {editingContent ? (
              <>
                <RichTextEditor value={editContent} onChange={setEditContent} placeholder="내용을 입력하세요." minHeight={200} />
                <div className="cms-detail__content-actions">
                  <Button size="sm" intent="primary" onClick={() => updateMut.mutate({ content: editContent })} disabled={updateMut.isPending}>
                    {updateMut.isPending ? "저장 중…" : "저장"}
                  </Button>
                  <Button size="sm" intent="secondary" onClick={() => { setEditContent(post.content ?? ""); setEditingContent(false); }}>취소</Button>
                </div>
              </>
            ) : (
              <>
                <PostReadView html={post.content ?? ""} />
                <div className="cms-detail__content-actions">
                  <Button size="sm" intent="ghost" onClick={() => setEditingContent(true)}>수정</Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 자료실은 일방향 다운로드 정책 — 댓글 비활성화 (백엔드도 차단) */}
      </div>
    </>
  );
}

/* ─── Attachment Section ─────────────────────────────── */
function MatAttachmentSection({ postId, attachments }: { postId: number; attachments: PostAttachment[] }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: (files: File[]) => uploadPostAttachments(postId, files),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-post", postId] }); feedback.success("파일이 첨부되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "파일 업로드에 실패했습니다."); },
  });

  const deleteMut = useMutation({
    mutationFn: (attId: number) => deletePostAttachment(postId, attId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-post", postId] }); feedback.success("첨부파일이 삭제되었습니다."); },
    onError: (e: unknown) => { feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."); },
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

  return (
    <div className="cms-attach__section">
      <div className="cms-attach__header">
        <div className="cms-detail__section-label">
          첨부파일{attachments.length > 0 ? ` (${attachments.length}개)` : ""}
        </div>
        <Button intent="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending || attachments.length >= 10}>
          {uploadMut.isPending ? "업로드 중…" : "+ 파일 추가"}
        </Button>
        <input
          ref={fileInputRef}
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
        <div className="cms-attach__inline-list">
          {attachments.map((att) => (
            <div key={att.id} className="cms-attach__inline-item">
              <span className="cms-attach__inline-icon" aria-hidden="true">📎</span>
              <span className="cms-attach__inline-name">{att.original_name}</span>
              <span className="cms-attach__inline-size">{formatFileSize(att.size_bytes)}</span>
              <Button intent="ghost" size="sm" className="cms-attach__inline-actions" onClick={() => handleDownload(att)}>다운로드</Button>
              <button type="button" className="cms-attach__item-remove" onClick={async () => { if (await confirm({ title: "첨부파일 삭제", message: "이 파일을 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate(att.id); }} disabled={deleteMut.isPending}>&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// MatCommentThread / MatCommentBlock / MatCommentComposer → PostThreadView로 통합
