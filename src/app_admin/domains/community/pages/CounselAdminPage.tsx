// PATH: src/app_admin/domains/community/pages/CounselAdminPage.tsx
// 상담 신청 관리 — QnA와 동일한 2-pane inbox 패턴 (목록 | 상세·답변)
// counsel 블록 유형이 없으면 자동 생성 → 사용자에게 설정 요구 없음

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminPosts,
  fetchPost,
  fetchPostReplies,
  createAnswer,
  updateReply,
  deleteReply,
  deletePost,
  type PostEntity,
  type Answer,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import PostReadView from "../components/PostReadView";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import CommunityContextBar from "../components/CommunityContextBar";
import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityAvatar from "../components/CommunityAvatar";
import "@admin/domains/community/qna-inbox.css";

type FilterKind = "all" | "pending" | "resolved";

export default function CounselAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const [filter, setFilter] = useState<FilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const qc = useQueryClient();

  // Fetch counsel posts
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["community-counsel-posts"],
    queryFn: () => fetchAdminPosts({ postType: "counsel", pageSize: 500 }),
    enabled: true,
  });
  const posts = postsData?.results ?? [];

  const isLoading = postsLoading;

  // Derive answered status from replies_count
  const withStatus = useMemo(
    () => posts.map((p) => ({ ...p, is_answered: (p.replies_count ?? 0) > 0 })),
    [posts],
  );

  const filtered = useMemo(() => {
    let list = withStatus;
    if (filter === "pending") list = list.filter((q) => !q.is_answered);
    if (filter === "resolved") list = list.filter((q) => q.is_answered);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (x) =>
          (x.created_by_display ?? "").toLowerCase().includes(q) ||
          x.title.toLowerCase().includes(q) ||
          (x.content || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [withStatus, filter, searchQuery]);

  const pendingCount = useMemo(() => withStatus.filter((q) => !q.is_answered).length, [withStatus]);

  const setSelectedId = useCallback(
    (id: number | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id != null) next.set("id", String(id));
        else next.delete("id");
        return next;
      });
    },
    [setSearchParams],
  );

  // j/k keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = selectedId != null ? filtered.findIndex((q) => q.id === selectedId) : -1;
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
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filtered, selectedId, setSelectedId]);

  return (
    <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
      <aside className="qna-inbox__list">
        <CommunityContextBar
          scope="all"
          extra={pendingCount > 0 ? `답변 대기 ${pendingCount}건` : undefined}
        />
        <div className="qna-inbox__list-header">
          <h2 className="qna-inbox__list-title">상담 신청</h2>
          <div className="qna-inbox__filter-group">
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "all" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <span>전체</span>
              <span className="qna-inbox__filter-badge">{withStatus.length}</span>
            </button>
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "pending" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("pending")}
            >
              <span>대기 중</span>
              <span className="qna-inbox__filter-badge">{pendingCount}</span>
            </button>
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "resolved" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("resolved")}
            >
              <span>상담 완료</span>
              <span className="qna-inbox__filter-badge">{withStatus.length - pendingCount}</span>
            </button>
          </div>
          <div className="qna-inbox__search">
            <input
              type="search"
              className="ds-input"
              placeholder="학생 이름 · 상담 내용"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="검색"
            />
          </div>
        </div>
        <div className="qna-inbox__list-body">
          {isLoading ? (
            <CommunityEmptyState variant="loading" postType="counsel" />
          ) : filtered.length === 0 ? (
            <CommunityEmptyState
              variant={searchQuery.trim() || filter !== "all" ? "no-results" : "no-posts"}
              postType="counsel"
              description={searchQuery.trim() || filter !== "all" ? "필터를 바꾸거나 다른 검색어를 입력해 보세요." : "학생이 상담을 신청하면 여기에 표시됩니다."}
            />
          ) : (
            filtered.map((q) => (
              <CounselCard
                key={q.id}
                post={q}
                isActive={q.id === selectedId}
                isUnread={!q.is_answered}
                onClick={() => setSelectedId(q.id)}
              />
            ))
          )}
        </div>
      </aside>

      <main className="qna-inbox__thread">
        {selectedId == null ? (
          <CommunityEmptyState variant="no-selection" postType="counsel" showKeyboardHint />
        ) : (
          <CounselThreadView
            postId={selectedId}
            onClose={() => setSelectedId(null)}
            onDelete={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["community-counsel-posts"] });
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ── Counsel Card ── */
function CounselCard({
  post,
  isActive,
  isUnread,
  onClick,
}: {
  post: PostEntity & { is_answered: boolean };
  isActive: boolean;
  isUnread: boolean;
  onClick: () => void;
}) {
  const timeAgo = (() => {
    const d = new Date(post.created_at);
    const diff = (Date.now() - d.getTime()) / 60000;
    if (diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  })();

  const statusClass = post.is_answered ? "qna-inbox__status--resolved" : "qna-inbox__status--pending";
  const statusLabel = post.is_answered ? "상담 완료" : "대기 중";
  const studentName = post.created_by_deleted ? "삭제된 학생" : (post.created_by_display ?? "학생");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""} ${isUnread ? "qna-inbox__card--unread" : ""}`}
    >
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{post.title}</div>
            <span className={`qna-inbox__status ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="qna-inbox__card-meta">
            <span className="qna-inbox__card-meta-name">{studentName}</span>
            <span className="qna-inbox__card-meta-dot" />
            <span>{timeAgo}</span>
            {post.category_label && (
              <>
                <span className="qna-inbox__card-meta-dot" />
                <span>{post.category_label}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── Thread View ── */
function CounselThreadView({
  postId,
  onClose,
  onDelete,
}: {
  postId: number;
  onClose: () => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const deletePostMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-counsel-posts"] });
      feedback.success("상담 신청이 삭제되었습니다.");
      onDelete();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  if (isLoading || !post) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">{isLoading ? "불러오는 중…" : "상담 신청을 찾을 수 없습니다."}</p>
      </div>
    );
  }

  const studentName = post.created_by_deleted ? "삭제된 학생" : (post.created_by_display ?? "학생");

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">{post.title}</h1>
            <div className="qna-inbox__thread-meta">
              <span>{studentName}</span>
              {post.category_label && (
                <>
                  <span className="qna-inbox__thread-meta-dot" />
                  <span className="cms-category-label--bold">{post.category_label}</span>
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
              <span className="qna-inbox__thread-meta-dot" />
              {(post.replies_count ?? 0) > 0 ? (
                <span className="qna-inbox__status qna-inbox__status--resolved">답변 완료</span>
              ) : (
                <span className="qna-inbox__status qna-inbox__status--pending">답변 대기</span>
              )}
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onClose}>목록</Button>
            <Button
              intent="danger"
              size="sm"
              onClick={async () => { if (await confirm({ title: "상담 삭제", message: "이 상담 신청을 삭제할까요?", confirmText: "삭제", danger: true })) deletePostMut.mutate(); }}
              disabled={deletePostMut.isPending}
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__student-panel">
        <CommunityAvatar name={studentName} role="student" size={28} />
        <div className="qna-inbox__student-info">
          <div className="qna-inbox__student-panel-label">학생</div>
          <div className="qna-inbox__student-name">{studentName}</div>
        </div>
      </div>

      <div className="qna-inbox__thread-body">
        <div className="qna-inbox__message-row">
          <CommunityAvatar name={studentName} role="student" />
          <div className="qna-inbox__message-bubble">
            <div className="qna-inbox__message-meta">
              <span className="qna-inbox__message-author">{studentName}</span>
              <span className="qna-inbox__message-badge">학생</span>
              <span className="qna-inbox__message-date">
                {new Date(post.created_at).toLocaleString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="qna-inbox__message-body"><PostReadView html={post.content} /></div>
          </div>
        </div>

        <div className="qna-inbox__thread-sep">
          <span className="qna-inbox__thread-sep-label">
            {(post.replies_count ?? 0) > 0 ? "선생님 답변" : "아직 답변이 없습니다"}
          </span>
        </div>

        <CounselAnswerThread postId={postId} />

        {(post.replies_count ?? 0) === 0 && (
          <div className="qna-inbox__answer-cta">
            <p>아래 입력란에서 상담 답변을 작성해 주세요.</p>
          </div>
        )}
      </div>

      <CounselComposer postId={postId} allowReply={!post.created_by_deleted} />
    </>
  );
}

/* ── Answer Thread ── */
function CounselAnswerThread({ postId }: { postId: number }) {
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["post-replies", postId],
    queryFn: () => fetchPostReplies(postId),
  });

  if (isLoading) {
    return <div className="cms-detail__comment-thread"><p className="qna-inbox__empty-desc">답변 불러오는 중…</p></div>;
  }

  return (
    <>
      {replies.map((reply) => (
        <CounselReplyBlock key={reply.id} postId={postId} answer={reply} />
      ))}
    </>
  );
}

/* ── Single Reply ── */
function CounselReplyBlock({ postId, answer }: { postId: number; answer: Answer }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(answer.content);

  const updateMut = useMutation({
    mutationFn: () => updateReply(postId, answer.id, editContent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-counsel-posts"] });
      setEditing(false);
      feedback.success("답변이 수정되었습니다.");
    },
    onError: (e: unknown) => feedback.error((e as Error)?.message ?? "수정에 실패했습니다."),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteReply(postId, answer.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-counsel-posts"] });
      feedback.success("답변이 삭제되었습니다.");
    },
    onError: (e: unknown) => feedback.error((e as Error)?.message ?? "삭제에 실패했습니다."),
  });

  const teacherName = answer.created_by_display ?? "선생님";

  return (
    <div className="qna-inbox__message-row qna-inbox__message-row--teacher">
      <CommunityAvatar name={teacherName} role="teacher" />
      <div className="qna-inbox__message-bubble">
        <div className="qna-inbox__message-meta">
          <span className="qna-inbox__message-author">{teacherName}</span>
          <span className="qna-inbox__message-badge">선생님</span>
          <span className="qna-inbox__message-date">
            {new Date(answer.created_at).toLocaleString("ko-KR", {
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {editing ? (
          <div className="qna-inbox__edit-form">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} />
            <div className="qna-inbox__edit-actions">
              <Button size="sm" intent="primary" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>저장</Button>
              <Button size="sm" intent="secondary" onClick={() => setEditing(false)}>취소</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="qna-inbox__message-body"><PostReadView html={answer.content} /></div>
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>수정</Button>
              <Button
                size="sm"
                intent="ghost"
                onClick={async () => { if (await confirm({ title: "답변 삭제", message: "이 답변을 삭제할까요?", confirmText: "삭제", danger: true })) deleteMut.mutate(); }}
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

/* ── Composer ── */
function CounselComposer({ postId, allowReply = true }: { postId: number; allowReply?: boolean }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-counsel-posts"] });
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-post", postId] });
      setContent("");
      feedback.success("답변이 등록되었습니다. 자동발송이 설정되어 있으면 알림이 발송됩니다.");
    },
    onError: (e: unknown) => feedback.error((e as Error)?.message ?? "등록에 실패했습니다."),
  });

  const isEmpty = !content.trim() || content.trim() === "<p></p>";

  return (
    <div className="qna-inbox__composer">
      {allowReply ? (
        <div className="qna-inbox__composer-inner">
          <div className="qna-inbox__composer-editor">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="학생에게 상담 답변을 작성하세요…"
              minHeight={80}
            />
          </div>
          <div className="qna-inbox__composer-footer">
            <span className="qna-inbox__composer-hint">
              서식 지원 · 이미지 첨부 가능
            </span>
            <Button
              intent="primary"
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={isEmpty || createMut.isPending}
            >
              {createMut.isPending ? "등록 중…" : "답변 등록"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="qna-inbox__empty-desc" style={{ margin: 0 }}>
          삭제된 학생의 상담 신청에는 답변을 등록할 수 없습니다.
        </p>
      )}
    </div>
  );
}
