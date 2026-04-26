// PATH: src/app_admin/domains/community/pages/CounselAdminPage.tsx
// 상담 신청 관리 — QnA와 동일한 2-pane inbox 패턴 (목록 | 상세·답변)
// counsel 블록 유형이 없으면 자동 생성 → 사용자에게 설정 요구 없음

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminPosts,
  fetchPost,
  deletePost,
  fetchPostAuthorContext,
  type PostEntity,
} from "../api/community.api";
import { formatPhone } from "@/shared/utils/formatPhone";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import PostReadView from "../components/PostReadView";
import PostThreadView from "../components/PostThreadView";
import PostHistoryTimeline from "../components/PostHistoryTimeline";
import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityAvatar from "../components/CommunityAvatar";
import { normalizeStudentName } from "../utils/communityHelpers";
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
  const isLoading = postsLoading;

  // Derive answered status from replies_count
  const withStatus = useMemo(
    () => (postsData?.results ?? []).map((p) => ({ ...p, is_answered: (p.replies_count ?? 0) > 0 })),
    [postsData?.results],
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
    <div className="qna-inbox" style={{ height: "calc(100vh - 180px)" }}>
      <aside className="qna-inbox__list">
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
              <span>답변 대기</span>
              <span className="qna-inbox__filter-badge">{pendingCount}</span>
            </button>
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "resolved" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("resolved")}
            >
              <span>답변 완료</span>
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
            allPosts={withStatus}
            onClose={() => setSelectedId(null)}
            onSelectPost={(id) => setSelectedId(id)}
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
  const statusLabel = post.is_answered ? "답변 완료" : "답변 대기";
  const studentName = post.created_by_deleted ? "삭제된 학생" : normalizeStudentName(post.created_by_display);

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
  allPosts,
  onClose,
  onSelectPost,
  onDelete,
}: {
  postId: number;
  allPosts: (PostEntity & { is_answered: boolean })[];
  onClose: () => void;
  onSelectPost: (id: number) => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const composerRef = useRef<HTMLDivElement>(null);
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const counselHistory = useMemo(() => {
    if (!post?.created_by) return [];
    return allPosts
      .filter((p) => p.id !== post.id && p.created_by === post.created_by)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);
  }, [post?.id, post?.created_by, allPosts]);

  const { data: studentDetail } = useQuery({
    queryKey: ["community-author-context", post?.created_by],
    queryFn: () => fetchPostAuthorContext(post!.created_by!),
    enabled: post?.created_by != null && !post?.created_by_deleted,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const deletePostMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-counsel-posts"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
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

  const studentName = post.created_by_deleted ? "삭제된 학생" : normalizeStudentName(post.created_by_display);

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 className="qna-inbox__thread-title" style={{ margin: 0 }}>{post.title}</h1>
              <span className="counsel-type-badge">상담</span>
            </div>
            <div className="qna-inbox__thread-meta">
              <span>{studentName}</span>
              <span className="qna-inbox__thread-meta-dot" />
              <span>
                신청 {new Date(post.created_at).toLocaleString("ko-KR", {
                  year: "numeric",
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
            {!post.created_by_deleted && (
              <Button
                intent="primary"
                size="sm"
                onClick={() => {
                  composerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                  setTimeout(() => {
                    const editor = composerRef.current?.querySelector<HTMLElement>(".ql-editor");
                    editor?.focus();
                  }, 400);
                }}
              >
                답변하기
              </Button>
            )}
            <Button intent="ghost" size="sm" onClick={onClose}>목록</Button>
            <Button
              intent="danger"
              size="sm"
              onClick={async () => {
                if (await confirm({
                  title: "상담 삭제",
                  message: "이 상담 신청과 답변을 모두 삭제합니다. 학생 화면에서도 사라지며 복구할 수 없어요.",
                  confirmText: "삭제",
                  danger: true,
                })) deletePostMut.mutate();
              }}
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
          <div className="qna-inbox__student-panel-label">상담 신청 학생</div>
          <div className="qna-inbox__student-name">
            {studentName}
            {studentDetail?.school && (
              <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-muted)", marginLeft: 6 }}>
                {studentDetail.school}{studentDetail.grade ? ` ${studentDetail.grade}학년` : ""}
              </span>
            )}
          </div>
          <div className="qna-inbox__student-course">
            신청일 {new Date(post.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
            {post.category_label && ` · ${post.category_label}`}
          </div>
          {studentDetail && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
              {studentDetail.studentPhone && (
                <a href={`tel:${studentDetail.studentPhone}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>
                  📱 학생 {formatPhone(studentDetail.studentPhone)}
                </a>
              )}
              {studentDetail.parentPhone && (
                <a href={`tel:${studentDetail.parentPhone}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>
                  👨‍👩‍👧 학부모 {formatPhone(studentDetail.parentPhone)}
                </a>
              )}
            </div>
          )}
          {studentDetail && studentDetail.enrollments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {studentDetail.enrollments.slice(0, 6).map((en) => (
                <span
                  key={en.id}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: en.lectureColor ? `${en.lectureColor}1a` : "var(--color-bg-surface-soft)",
                    color: en.lectureColor || "var(--color-text-secondary)",
                    border: `1px solid ${en.lectureColor ? `${en.lectureColor}55` : "var(--color-border-divider)"}`,
                  }}
                >
                  {en.lectureChipLabel || en.lectureName || "강의"}
                </span>
              ))}
              {studentDetail.enrollments.length > 6 && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>+{studentDetail.enrollments.length - 6}</span>
              )}
            </div>
          )}
        </div>
        {counselHistory.length > 0 && (
          <div className="qna-inbox__student-history">이전 상담 {counselHistory.length}건</div>
        )}
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

        {(post.replies_count ?? 0) === 0 && (
          <div className="qna-inbox__answer-cta">
            <p>아래 입력란에서 상담 답변을 작성해 주세요.</p>
          </div>
        )}

        <PostHistoryTimeline label="이전 상담" history={counselHistory} onSelect={onSelectPost} />
      </div>

      <div ref={composerRef}>
        <PostThreadView
          postId={postId}
          mode="answer"
          allowReply={!post.created_by_deleted}
          invalidateKeys={[["community-counsel-posts"], ["admin", "notification-counts"]]}
          placeholder="학생에게 상담 답변을 작성하세요…"
        />
      </div>
    </>
  );
}

