// PATH: src/app_admin/domains/community/pages/NoticeAdminPage.tsx
// 공지사항 관리 — QnA 탭 참고: 좌측 폴더 트리(전체/강의/차시 공지) + 우측 목록·상세

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/useCommunityScope";
import {
  fetchScopeNodes,
  fetchAdminPosts,
  fetchPost,
  updatePost,
  deletePost,
  createPost,
  uploadPostAttachments,
  resolveNodeIdFromScope,
  resolvePostNodeIdsForCreate,
  type PostEntity,
  type ScopeNodeMinimal,
  type CommunityScopeParams,
  type PostUpdatePayload,
} from "../api/community.api";
import { useScopeFilteredPosts } from "../hooks/useScopeFilteredPosts";
import { useScopeNavigation } from "../hooks/useScopeNavigation";
import { useTreeCounts } from "../hooks/useTreeCounts";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { adminCommunityQueryKeys } from "../queryKeys";
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
import { stripHtml } from "../utils/communityHelpers";
import { selectNoticeFiles } from "../utils/noticeFiles";
import NoticeAttachments, { NoticeDraftFiles } from "../components/NoticeAttachments";
import { createClientRequestKey, getCommunityStorageCleanupNotice } from "@/shared/api/contracts/community";
import "@admin/domains/community/qna-inbox.css";
import "@admin/domains/community/notice-tree.css";
import "@admin/domains/community/board-admin.css";

const SNIPPET_LEN = 72;

type NoticeAdminPageProps = {
  embedded?: boolean;
};

export default function NoticeAdminPage({ embedded = false }: NoticeAdminPageProps) {
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

  const scopeNodesQ = useQuery<ScopeNodeMinimal[]>({
    queryKey: adminCommunityQueryKeys.scopeNodes,
    queryFn: () => fetchScopeNodes(),
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

  // 트리 노드별 공지 개수 — 백엔드 단일 집계 (이전: 2000건 풀 페치)
  const { counts: noticeCounts } = useTreeCounts("notice");

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const { data: allNotices = [], isLoading, isError, error } = useQuery<PostEntity[]>({
    queryKey: adminCommunityQueryKeys.noticePostsList(debouncedQuery),
    queryFn: async () => {
      const { results } = await fetchAdminPosts({
        postType: "notice",
        q: debouncedQuery.trim() || null,
        pageSize: 500,
      });
      return results;
    },
    retry: 1,
    staleTime: 30_000,
  });

  // scope 필터: 전체=모든 글, 강의=해당 강의+하위 차시, 차시=해당 차시+상위 강의
  // ✅ V1.1.1: 강의/차시 scope에서 전체공지(GLOBAL)를 제외
  const nodeId = useMemo(
    () => resolveNodeIdFromScope(scopeNodes, scopeParams),
    [scopeNodes, scopeParams],
  );
  const posts = useScopeFilteredPosts({ posts: allNotices, scopeNodes, scope, nodeId });

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

  // 트리 선택 시 URL에 반영 (공통 훅)
  const { selectAll, selectLecture, selectSession } = useScopeNavigation({
    onChange: () => setShowCreate(false),
  });

  useEffect(() => {
    if (selectedId == null || showCreate || isLoading) return;
    if (!filtered.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId, showCreate, isLoading, setSelectedId]);

  const canShowList =
    scope === "all" ||
    (scope === "lecture" && effectiveLectureId != null) ||
    (scope === "session" && sessionId != null);

  if (scopeNodesQ.isError || lecturesQ.isError || sessionsQ.isError) {
    return (
      <CommunityEmptyState
        variant="error"
        postType="notice"
        title="공지 범위를 불러오지 못했습니다"
        description="잘못된 강의·차시에 공지하지 않도록 범위를 복구한 뒤 작성할 수 있습니다."
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
    <div className={`notice-tree notice-tree--viewport${embedded ? " notice-tree--embedded" : ""}${selectedId != null || showCreate ? " notice-tree--has-detail" : ""}`}>
      {!embedded && (
        <CmsTreeNav
          title="공지"
          allLabel="전체 보기"
          counts={{
            totalCount: noticeCounts.totalCount,
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
      )}

      {/* 2번 영역: 공지 목록 */}
      <aside className="qna-inbox__list">
        <div className="qna-inbox__list-header">
          <div className="qna-inbox__list-title-row">
            <div className="qna-inbox__list-title-group">
              <h2 className="qna-inbox__list-title">공지사항</h2>
              <CommunityContextBar
                scope={scope}
                lectureName={lectures.find((l) => l.id === lectureId)?.title ?? null}
                sessionName={sessionsOfLecture.find((s) => s.id === sessionId)?.title ?? null}
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
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.noticePosts });
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.boardPosts });
              qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("notice") });
              setShowCreate(false);
              feedback.success("공지가 등록되었습니다.");
            }}
          />
        ) : selectedId == null ? (
          <CommunityEmptyState variant="no-selection" postType="notice" />
        ) : (
          <NoticeDetailView
            key={selectedId}
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
    ? "전체 대상"
    : nd?.session_title
    ? `${nd.lecture_title} > ${nd.session_title}`
    : nd?.lecture_title ?? "";
  const typeLabel = isGlobal ? "전체 대상" : nd?.session_title ? "차시 공지" : "강의 공지";

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
  const { data: post, isLoading, isError, refetch } = useQuery({
    queryKey: adminCommunityQueryKeys.post(postId),
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saveError, setSaveError] = useState("");
  const [pendingUpload, setPendingUpload] = useState(false);
  const savedContent = useRef("");
  const uploadKey = useRef<string | null>(null);
  const saving = useRef(false);

  const [editingTitle, setEditingTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    if (!isEditing) setEditingContent(post?.content ?? "");
  }, [post?.content, isEditing]);
  useEffect(() => {
    if (!isEditingTitle) setEditingTitle(post?.title ?? "");
  }, [post?.title, isEditingTitle]);

  useEffect(() => {
    if (!isEditing && !isEditingTitle) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isEditing, isEditingTitle]);

  const deleteMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.noticePosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.boardPosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("notice") });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      const cleanupNotice = getCommunityStorageCleanupNotice(result);
      if (cleanupNotice) feedback.warning(cleanupNotice);
      else feedback.success("공지가 삭제되었습니다.");
      onDeleted();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<PostUpdatePayload>) => updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.noticePosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("notice") });
      feedback.success("수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "수정에 실패했습니다.");
    },
  });

  const updateTitleMut = useMutation({
    mutationFn: (title: string) => updatePost(postId, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.noticePosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.counts("notice") });
      feedback.success("제목이 수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "제목 수정에 실패했습니다.");
    },
  });

  const updateContentMut = useMutation({
    mutationFn: async () => {
      saving.current = true;
      setSaveError("");
      try {
        if (editingContent !== savedContent.current) {
          await updatePost(postId, { content: editingContent });
          savedContent.current = editingContent;
        }
        if (files.length) {
          uploadKey.current ??= createClientRequestKey();
          setPendingUpload(true);
          try {
            await uploadPostAttachments(postId, files, uploadKey.current);
          } catch (error) {
            // A validation rejection occurs before storage; only then may the
            // user replace the batch instead of retrying the exact same files.
            if ((error as { response?: { status?: number } }).response?.status === 400) {
              uploadKey.current = null;
              setPendingUpload(false);
            }
            throw error;
          }
        }
      } finally {
        saving.current = false;
      }
    },
    onSuccess: async () => {
      setFiles([]);
      setPendingUpload(false);
      uploadKey.current = null;
      await qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.noticePosts });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.boardPosts });
      setIsEditing(false);
      feedback.success("내용이 저장되었습니다.");
    },
    onError: (e: unknown) => {
      const message = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "저장에 실패했습니다. 다시 시도해 주세요.";
      setSaveError(savedContent.current === editingContent && files.length
        ? `본문은 저장되어 있습니다. 첨부파일을 저장하지 못했습니다. 선택한 파일은 유지됩니다. ${message}`
        : message);
    },
  });

  const attachmentsLocked = updateContentMut.isPending || pendingUpload;
  const addFiles = (selected: File[]) => {
    if (attachmentsLocked) return;
    setFiles(selectNoticeFiles(files, selected, post?.attachments?.length ?? 0));
    setSaveError("");
  };

  if (isError) return <CommunityEmptyState variant="error" postType="notice" title="공지를 불러오지 못했습니다" action={<Button intent="secondary" onClick={() => void refetch()}>다시 시도</Button>} />;

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
            {isEditingTitle ? (
              <div className="cms-detail__title-edit-row cms-detail__title-edit-row--full">
                <input
                  className="ds-input cms-detail__title-input cms-detail__title-input--lg"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || updateTitleMut.isPending) return;
                    const val = (e.currentTarget as HTMLInputElement).value.trim();
                    if (e.key === "Enter" && val && val !== post.title) {
                      updateTitleMut.mutate(val, { onSuccess: () => setIsEditingTitle(false) });
                    }
                    if (e.key === "Escape") {
                      setEditingTitle(post.title ?? "");
                      setIsEditingTitle(false);
                    }
                  }}
                />
                <Button
                  intent="primary"
                  size="sm"
                  onClick={() => {
                    if (editingTitle.trim() && editingTitle.trim() !== post.title) {
                      updateTitleMut.mutate(editingTitle.trim(), { onSuccess: () => setIsEditingTitle(false) });
                    }
                  }}
                  disabled={updateTitleMut.isPending || !editingTitle.trim() || editingTitle.trim() === post.title}
                >
                  {updateTitleMut.isPending ? "저장 중…" : "저장"}
                </Button>
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={() => { setEditingTitle(post.title ?? ""); setIsEditingTitle(false); }}
                  disabled={updateTitleMut.isPending}
                >
                  취소
                </Button>
              </div>
            ) : (
              <h1 className="qna-inbox__thread-title">
                <button type="button" className="notice-title-edit"
                onClick={() => { setEditingTitle(post.title ?? ""); setIsEditingTitle(true); }}
                title="클릭하여 제목 수정"
              >
                {post.title}
                <span className="qna-inbox__thread-title-edit-mark">✎</span>
                </button>
              </h1>
            )}
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
              {post.is_urgent ? "🔴 중요 해제" : "🔴 중요"}
            </Button>
            <Button intent="ghost" size="sm" disabled={updateContentMut.isPending} onClick={async () => {
              if ((isEditing || isEditingTitle) && !await confirm({ title: "수정 종료", message: "저장하지 않은 내용과 선택한 파일을 버리고 목록으로 돌아갈까요?", confirmText: "돌아가기" })) return;
              onClose();
            }}>
              목록
            </Button>
            <Button
              intent="danger"
              size="sm"
              onClick={async () => {
                if (await confirm({ title: "공지 삭제", message: "이 공지를 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending || updateContentMut.isPending}
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="cms-detail__body">
        <div className="cms-detail__section">
          <div className="cms-detail__section-label cms-detail__section-label--actions">
            <span>내용</span>
            {!isEditing && (
              <Button intent="ghost" size="sm" onClick={() => { savedContent.current = post.content ?? ""; setEditingContent(post.content ?? ""); setSaveError(""); setIsEditing(true); }}>
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
                onFileAttach={addFiles}
                readOnly={attachmentsLocked}
              />
            ) : (
              <PostReadView html={post.content ?? ""} />
            )}
          </div>
          {isEditing && (
            <NoticeDraftFiles files={files} disabled={attachmentsLocked} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} />
          )}
          {saveError && <p role="alert" className="community-field__error">{saveError}</p>}
          {pendingUpload && <p className="cms-attach__hint">같은 파일로 첨부만 다시 시도합니다. 재시도가 끝날 때까지 선택한 파일을 유지해 주세요.</p>}
          {isEditing && (
            <div className="cms-detail__content-actions">
              <Button
                intent="primary"
                size="sm"
                onClick={() => {
                  if (!saving.current && !updateContentMut.isPending) updateContentMut.mutate();
                }}
                disabled={updateContentMut.isPending || (!files.length && editingContent === (post.content ?? ""))}
              >
                {updateContentMut.isPending ? "저장 중…" : pendingUpload ? "첨부 다시 시도" : "저장"}
              </Button>
              <Button
                intent="ghost"
                size="sm"
                onClick={async () => {
                  if (pendingUpload && !await confirm({ title: "첨부 재시도 종료", message: "본문은 저장되어 있습니다. 첨부 결과를 다시 확인하고 수정을 종료할까요?", confirmText: "확인 후 종료" })) return;
                  setFiles([]); setPendingUpload(false); uploadKey.current = null; setSaveError("");
                  await qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
                  setIsEditing(false);
                }}
                disabled={updateContentMut.isPending}
              >
                취소
              </Button>
            </div>
          )}
        </div>

        <NoticeAttachments postId={postId} attachments={post.attachments ?? []} disabled={attachmentsLocked} />
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
  const [files, setFiles] = useState<File[]>([]);
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachmentUploadKeyRef = useRef<string | null>(null);

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
  const attachmentsLocked = submitting || createdPostId != null;

  const addFiles = useCallback((selectedFiles: File[]) => {
    if (attachmentsLocked || selectedFiles.length === 0) return;
    attachmentUploadKeyRef.current = null;
    setFiles(selectNoticeFiles(files, selectedFiles));
  }, [attachmentsLocked, files]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    let postId = createdPostId;
    try {
      if (postId == null) {
        const post = await createPost({
          post_type: "notice",
          title: title.trim(),
          content,
          node_ids: resolvedScope.nodeIds,
          is_urgent: isUrgent || undefined,
        });
        postId = post.id;
        setCreatedPostId(post.id);
      }
      if (files.length > 0) {
        const uploadKey = attachmentUploadKeyRef.current ?? createClientRequestKey();
        attachmentUploadKeyRef.current = uploadKey;
        await uploadPostAttachments(postId, files, uploadKey);
      }
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? (e as Error)?.message ?? "등록에 실패했습니다.";
      setError(postId == null
        ? msg
        : `공지는 저장됐지만 첨부파일 등록에 실패했습니다. 선택한 파일은 유지됩니다. ${msg}`);
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
              <Badge tone="primary">대상: {scopeLabel}</Badge>
              <span className="cms-form__scope-help">
                {scopeParams.scope === "all"
                  ? "이 공지는 전체 학생에게 보입니다."
                  : scopeParams.scope === "lecture"
                  ? `${scopeLabel} 수강생에게만 보입니다.`
                  : `${scopeLabel} 학생에게만 보입니다.`}
              </span>
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
          </div>
        </div>
      </header>

      <div className="cms-form__body cms-form__body--scrollable">
        <div className="cms-form__field">
          <label className="community-field__label community-field__label--required">제목</label>
          <input className="ds-input cms-form__input--full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목을 입력하세요" readOnly={attachmentsLocked} autoFocus />
        </div>

        <div className="cms-form__field">
          <label className="community-field__label">내용</label>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="공지 내용을 입력하세요..."
            minHeight={250}
            onFileAttach={addFiles}
            readOnly={attachmentsLocked}
          />
        </div>

        {files.length > 0 && (
          <div className="cms-form__field">
            <div className="cms-attach__header">
              <label className="community-field__label cms-form__label--no-margin">
                첨부파일 ({files.length}/10)
              </label>
            </div>
            <NoticeDraftFiles files={files} disabled={attachmentsLocked} onRemove={(index) => {
              attachmentUploadKeyRef.current = null;
              setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
            }} />
            {attachmentsLocked && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                공지가 이미 저장되어 첨부파일을 변경할 수 없습니다. 같은 파일로 다시 시도해 주세요.
              </p>
            )}
          </div>
        )}

        <div className="cms-form__field--inline">
          <label className={`cms-form__checkbox-label ${isUrgent ? "cms-form__checkbox-label--urgent" : ""}`}>
            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} disabled={attachmentsLocked} />
            긴급 공지
          </label>
          {isUrgent && <span className="cms-detail__saved-msg">학생 앱에서 강조 표시됩니다</span>}
        </div>

        {error && <p className="community-field__error">{error}</p>}

        <div className="cms-form__actions">
          <Button intent="secondary" size="sm" onClick={onCancel}>취소</Button>
          <Button intent="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? createdPostId != null ? "첨부 재시도 중…" : "등록 중…"
              : createdPostId != null ? "첨부 다시 시도" : "등록"}
          </Button>
        </div>
      </div>
    </>
  );
}
