// PATH: src/features/community/pages/NoticeAdminPage.tsx
// 공지사항 관리 — QnA 탭 참고: 좌측 폴더 트리(전체/강의/차시 공지) + 우측 목록·상세

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchScopeNodes,
  fetchAdminPosts,
  fetchPost,
  updatePost,
  deletePost,
  createPost,
  fetchAllNoticePostsForCount,
  resolveNodeIdFromScope,
  type PostEntity,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
} from "../api/community.api";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import CmsTreeNav from "../components/CmsTreeNav";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import ScopeBadge, { resolveScopeType } from "../components/ScopeBadge";
import PostReadView from "../components/PostReadView";
import CommunityContextBar from "../components/CommunityContextBar";
import CommunityEmptyState from "../components/CommunityEmptyState";
import { stripHtml } from "../utils/communityHelpers";
import "@/features/community/qna-inbox.css";
import "@/features/community/notice-tree.css";
import "@/features/community/board-admin.css";

const SNIPPET_LEN = 72;

export default function NoticeAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

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

  /** 펼쳐진 강의(해당 강의의 차시 목록 표시) */
  const [expandedLectureId, setExpandedLectureId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: scopeNodes = [] } = useQuery<ScopeNodeMinimal[]>({
    queryKey: ["community-scope-nodes"],
    queryFn: () => fetchScopeNodes(),
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

  /** 트리 노드별 공지 개수 집계용: 공지 전체 목록(매핑 포함) */
  const { data: allNoticePostsForCount = [] } = useQuery({
    queryKey: ["community-all-notice-posts-for-count"],
    queryFn: () => fetchAllNoticePostsForCount(),
  });

  const noticeCounts = useMemo(() => {
    const scopeNodeIds = new Set(scopeNodes.map((n) => n.id));
    const countByNodeId: Record<number, number> = {};
    for (const n of scopeNodes) countByNodeId[n.id] = 0;
    for (const p of allNoticePostsForCount) {
      for (const m of p.mappings ?? []) {
        if (scopeNodeIds.has(m.node)) countByNodeId[m.node] = (countByNodeId[m.node] ?? 0) + 1;
      }
    }
    const totalNoticeCount = allNoticePostsForCount.length;
    const totalUnderScope = allNoticePostsForCount.filter((p) =>
      p.mappings?.some((m) => scopeNodeIds.has(m.node))
    ).length;
    const countByLecture: Record<number, number> = {};
    for (const lec of lectures) countByLecture[lec.id] = 0;
    for (const p of allNoticePostsForCount) {
      const seen = new Set<number>();
      for (const m of p.mappings ?? []) {
        const lid = m.node_detail?.lecture;
        if (lid != null && !seen.has(lid)) {
          seen.add(lid);
          countByLecture[lid] = (countByLecture[lid] ?? 0) + 1;
        }
      }
    }
    return {
      totalNoticeCount,
      totalUnderScope,
      countByNodeId,
      countByLecture,
    };
  }, [allNoticePostsForCount, scopeNodes, lectures]);

  const { data: allNotices = [], isLoading, isError, error } = useQuery<PostEntity[]>({
    queryKey: ["community-notice-posts"],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ postType: "notice", pageSize: 500 });
      return results;
    },
    retry: 1,
    staleTime: 30_000,
  });

  // scope 필터: 전체=모든 글, 강의=해당 강의+하위 차시, 차시=해당 차시+상위 강의
  // ✅ V1.1.1 fix: 강의/차시 scope에서 전체공지(GLOBAL)를 제외
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams]
  );
  const visibleNodeIds = useMemo(() => {
    if (scope === "all" || nodeId == null) return null;
    const ids = new Set<number>();
    ids.add(nodeId);
    // 선택된 노드 찾기
    const selected = scopeNodes.find((n) => n.id === nodeId);
    if (selected) {
      if (selected.level === "COURSE") {
        // 강의 scope: 하위 SESSION 노드도 포함
        for (const n of scopeNodes) {
          if (n.lecture === selected.lecture && n.level === "SESSION") {
            ids.add(n.id);
          }
        }
      } else if (selected.level === "SESSION") {
        // 차시 scope: 상위 COURSE 노드도 포함
        for (const n of scopeNodes) {
          if (n.lecture === selected.lecture && n.level === "COURSE") {
            ids.add(n.id);
          }
        }
      }
    }
    return ids;
  }, [scope, nodeId, scopeNodes]);

  const posts = useMemo(() => {
    if (scope === "all") return allNotices;
    if (!visibleNodeIds) return allNotices;
    return allNotices.filter((p) => {
      // 매핑 없는 글(전체공지)은 강의/차시 scope에서 제외
      if (!p.mappings || p.mappings.length === 0) return false;
      return p.mappings.some((m) => visibleNodeIds.has(m.node));
    });
  }, [allNotices, scope, visibleNodeIds]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.content ?? "").toLowerCase().includes(q)
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
    },
    [setSearchParams]
  );

  /** 트리 선택 시 URL에 반영 → Context가 동기화되어 목록/공지추가 버튼 표시 */
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

  const hasScopeParam = searchParams.has("scope");
  const canShowList =
    hasScopeParam && (
      scope === "all" ||
      (scope === "lecture" && effectiveLectureId != null) ||
      (scope === "session" && sessionId != null)
    );

  return (
    <div className="notice-tree" style={{ minHeight: "calc(100vh - 180px)" }}>
      <CmsTreeNav
        title="공지"
        allLabel="전체 보기"
        counts={{
          totalCount: noticeCounts.totalNoticeCount,
          totalUnderScope: noticeCounts.totalUnderScope,
          countByNodeId: noticeCounts.countByNodeId,
          countByLecture: noticeCounts.countByLecture,
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

      {/* 2번 영역: 공지 목록 */}
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          <div className="qna-inbox__list-title-row">
            <div className="qna-inbox__list-title-group">
              <h2 className="qna-inbox__list-title">공지사항</h2>
              <CommunityContextBar
                scope={scope as any}
                lectureName={lectures.find((l) => l.id === lectureId)?.title ?? null}
                sessionName={sessionsOfLecture.find((s) => s.id === sessionId)?.title ?? null}
                inline
              />
            </div>
            <Button intent="primary" size="sm" onClick={() => { setShowCreate(true); setSelectedId(null); }}>+ 추가</Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              className="ds-input flex-1 min-w-0"
              placeholder="제목 · 내용 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="검색"
            />
          </div>
        </div>
        <div className="qna-inbox__list-body">
          {!canShowList ? (
            <CommunityEmptyState variant="no-scope" postType="notice" />
          ) : isLoading ? (
            <CommunityEmptyState variant="loading" postType="notice" />
          ) : isError ? (
            <CommunityEmptyState variant="error" postType="notice" description={(error as Error)?.message} />
          ) : filtered.length === 0 ? (
            <CommunityEmptyState
              variant={searchQuery.trim() ? "no-results" : "no-posts"}
              postType="notice"
              description={searchQuery.trim() ? undefined : "'+ 추가' 버튼으로 이 범위에 공지를 등록할 수 있습니다."}
            />
          ) : (
            filtered.map((p) => (
              <NoticeCard
                key={p.id}
                post={p}
                isActive={p.id === selectedId}
                onClick={() => setSelectedId(p.id)}
              />
            ))
          )}
        </div>
      </aside>

      <main className="qna-inbox__thread">
        {showCreate ? (
          <NoticeCreatePane
            scopeNodes={scopeNodes}
            scopeParams={scopeParams}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
              qc.invalidateQueries({ queryKey: ["community-board-posts"] });
              qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
              setShowCreate(false);
              feedback.success("공지가 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
          <CommunityEmptyState variant="no-selection" postType="notice" />
        ) : (
          <NoticeDetailView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        )}
      </main>
    </div>
  );
}

function NoticeCard({
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
  const dateLabel = post.created_at
    ? new Date(post.created_at).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
      })
    : "—";

  // scope 해석
  const scopeType = resolveScopeType(post);
  const isGlobal = scopeType === "global";
  const nd = post.mappings?.[0]?.node_detail;
  const scopePath = isGlobal
    ? "모든 강의 대상"
    : nd?.session_title
    ? `${nd.lecture_title} > ${nd.session_title}`
    : nd?.lecture_title ?? "";
  const typeLabel = isGlobal ? "전체 공지" : nd?.session_title ? "차시 공지" : "강의 공지";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`cms-list-card ${isActive ? "cms-list-card--active" : ""} cms-list-card--${scopeType}`}
    >
      {/* 좌측 유형 컬러 바 */}
      <div className={`cms-list-card__bar cms-list-card__bar--${scopeType}`} />

      <div className="cms-list-card__inner">
        {/* 1층: 유형 헤더 — 공지 종류 + 대상 + 날짜 */}
        <div className="cms-list-card__header">
          <span className={`cms-list-card__type cms-list-card__type--${scopeType}`}>
            {typeLabel}
          </span>
          <span className="cms-list-card__scope">{scopePath}</span>
          <span className="cms-list-card__date">{dateLabel}</span>
        </div>

        {/* 2층: 제목 */}
        <div className="cms-list-card__title">{post.title || "(제목 없음)"}</div>

        {/* 3층: 본문 미리보기 */}
        {snippet && <div className="cms-list-card__snippet">{snippet}</div>}

        {/* 4층: 플래그 (고정/중요) — 있을 때만 */}
        {(post.is_pinned || post.is_urgent) && (
          <div className="cms-list-card__flags">
            {post.is_pinned && <span className="cms-list-card__flag cms-list-card__flag--pinned">고정</span>}
            {post.is_urgent && <span className="cms-list-card__flag cms-list-card__flag--urgent">중요</span>}
          </div>
        )}
      </div>
    </button>
  );
}

function NoticeDetailView({
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

  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);

  useEffect(() => {
    setEditingContent(post?.content ?? "");
    setIsEditing(false);
  }, [post?.id, post?.content]);

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-board-posts"] });
      qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      feedback.success("공지가 삭제되었습니다.");
      onDeleted();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updatePost(postId, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-all-notice-posts-for-count"] });
      feedback.success("수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "수정에 실패했습니다.");
    },
  });

  const updateContentMut = useMutation({
    mutationFn: (content: string) => updatePost(postId, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      qc.invalidateQueries({ queryKey: ["community-notice-posts"] });
      qc.invalidateQueries({ queryKey: ["community-board-posts"] });
      setContentSaved(true);
      feedback.success("내용이 저장되었습니다.");
      setTimeout(() => setContentSaved(false), 2000);
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "저장에 실패했습니다.");
    },
  });

  if (isLoading || !post) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">
          {isLoading ? "불러오는 중…" : "공지를 찾을 수 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">{post.title}</h1>
            <div className="qna-inbox__thread-meta">
              <ScopeBadge post={post} />
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
            <Button
              intent={post.is_pinned ? "primary" : "ghost"}
              size="sm"
              onClick={() => updateMut.mutate({ is_pinned: !post.is_pinned })}
              disabled={updateMut.isPending}
              title={post.is_pinned ? "고정 해제" : "상단 고정"}
            >
              {post.is_pinned ? "📌 고정됨" : "📌 고정"}
            </Button>
            <Button
              intent={post.is_urgent ? "danger" : "ghost"}
              size="sm"
              onClick={() => updateMut.mutate({ is_urgent: !post.is_urgent })}
              disabled={updateMut.isPending}
              title={post.is_urgent ? "중요 해제" : "중요 표시"}
            >
              {post.is_urgent ? "🔴 중요" : "중요"}
            </Button>
            <Button intent="ghost" size="sm" onClick={onClose}>
              목록
            </Button>
            <Button
              intent="danger"
              size="sm"
              onClick={async () => {
                if (await confirm({ title: "공지 삭제", message: "이 공지를 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="cms-detail__body">
        <div className="cms-detail__section">
          <div className="cms-detail__section-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>내용</span>
            {!isEditing && (
              <Button intent="ghost" size="sm" onClick={() => { setEditingContent(post.content ?? ""); setIsEditing(true); }}>
                수정
              </Button>
            )}
          </div>
          <div className="cms-detail__content-card">
            {isEditing ? (
              <RichTextEditor
                value={editingContent}
                onChange={setEditingContent}
                placeholder="공지 내용을 입력하세요."
                minHeight={200}
              />
            ) : (
              <PostReadView html={post.content ?? ""} />
            )}
          </div>
          {isEditing && (
            <div className="cms-detail__content-actions">
              <Button
                intent="primary"
                size="sm"
                onClick={() => {
                  updateContentMut.mutate(editingContent, {
                    onSuccess: () => setIsEditing(false),
                  });
                }}
                disabled={updateContentMut.isPending || editingContent === (post.content ?? "")}
              >
                {updateContentMut.isPending ? "저장 중…" : "저장"}
              </Button>
              <Button
                intent="ghost"
                size="sm"
                onClick={() => { setEditingContent(post.content ?? ""); setIsEditing(false); }}
                disabled={updateContentMut.isPending}
              >
                취소
              </Button>
              {contentSaved && (
                <span className="cms-detail__saved-msg">저장되었습니다.</span>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

/* ─── Inline Notice Create Pane ──────────────────────── */
function NoticeCreatePane({
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
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-resolve node_ids from current scope
  // 전체공지(scope=all)는 매핑 없음(node_ids=[]) — 모든 학생에게 노출
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
    // scope="all" → 전체 공지: 매핑 없음
    return [];
  }, [scopeNodes, scopeParams]);

  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId && n.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
    ? scopeNodes.find((n) => n.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의"
    : "전체 공지";

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        post_type: "notice",
        title: title.trim(),
        content,
        node_ids: autoNodeIds,
        is_urgent: isUrgent || undefined,
      });
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
            <h1 className="qna-inbox__thread-title">새 공지 작성</h1>
            <div className="qna-inbox__thread-meta">
              <span className="ds-badge ds-badge--primary">대상: {scopeLabel}</span>
              <span className="text-xs text-[var(--color-text-muted)]" style={{ marginLeft: 8 }}>
                {scopeParams.scope === "all"
                  ? "모든 강의의 학생에게 보이는 공지입니다."
                  : scopeParams.scope === "lecture"
                  ? `${scopeLabel} 수강생에게만 보입니다.`
                  : `${scopeLabel} 학생에게만 보입니다.`}
              </span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onCancel}>취소</Button>
          </div>
        </div>
      </header>

      <div className="cms-form__body">
        <div className="cms-form__field">
          <label className="community-field__label community-field__label--required">제목</label>
          <input className="ds-input cms-form__input--full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목을 입력하세요" autoFocus />
        </div>

        <div className="cms-form__field">
          <label className="community-field__label">내용</label>
          <RichTextEditor value={content} onChange={setContent} placeholder="공지 내용을 입력하세요..." minHeight={250} />
        </div>

        <div className="cms-form__field--inline">
          <label className="cms-form__checkbox-label" style={{ color: isUrgent ? "var(--color-error)" : undefined }}>
            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
            긴급 공지
          </label>
          {isUrgent && <span className="cms-detail__saved-msg">학생 앱에서 강조 표시됩니다</span>}
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
