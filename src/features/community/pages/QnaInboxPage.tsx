// PATH: src/features/community/pages/QnaInboxPage.tsx
// QnA Inbox/Thread UI — SaaS 표준 (한 화면 좌 목록 | 우 상세·답변), 페이지 이동 없음

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchCommunityQuestions,
  fetchPost,
  fetchPostReplies,
  createAnswer,
  updateReply,
  deleteReply,
  deletePost,
  type Question,
  type Answer,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import PostReadView from "../components/PostReadView";
import "@/features/community/qna-inbox.css";

type FilterKind = "all" | "pending" | "resolved";
const SNIPPET_LEN = 72;

/* ── Avatar helpers ─────────────────────────────── */
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

function getAvatarSlot(name: string): number {
  return [...(name ?? "")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5;
}

function QnaAvatar({
  name,
  role = "student",
  size = 32,
}: {
  name: string;
  role?: "student" | "teacher";
  size?: number;
}) {
  const style = size !== 32 ? { width: size, height: size, fontSize: size * 0.34 } : undefined;
  if (role === "teacher") {
    return (
      <div className="qna-inbox__avatar qna-inbox__avatar--teacher" style={style}>
        {getInitials(name)}
      </div>
    );
  }
  return (
    <div
      className="qna-inbox__avatar"
      data-slot={getAvatarSlot(name)}
      style={style}
    >
      {getInitials(name)}
    </div>
  );
}

export default function QnaInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  const { scope, effectiveLectureId, sessionId } = useCommunityScope();
  const scopeParams = useMemo(
    () => ({
      scope,
      lectureId: effectiveLectureId ?? undefined,
      sessionId: sessionId ?? undefined,
    }),
    [scope, effectiveLectureId, sessionId]
  );

  const [filter, setFilter] = useState<FilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["community-questions", scope, effectiveLectureId, sessionId],
    queryFn: () => fetchCommunityQuestions(scopeParams),
    enabled:
      scope === "all" ||
      (scope === "lecture" && effectiveLectureId != null) ||
      (scope === "session" && sessionId != null),
  });

  const filtered = useMemo(() => {
    let list = questions;
    if (filter === "pending") list = list.filter((q) => !q.is_answered);
    if (filter === "resolved") list = list.filter((q) => q.is_answered);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (x) =>
          (x.student_name ?? "").toLowerCase().includes(q) ||
          x.title.toLowerCase().includes(q) ||
          (x.content || "").toLowerCase().includes(q) ||
          (x.lecture_title ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [questions, filter, searchQuery]);

  const pendingCount = useMemo(() => questions.filter((q) => !q.is_answered).length, [questions]);

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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (filtered.length === 0) return;
      const idx = selectedId != null ? filtered.findIndex((q) => q.id === selectedId) : -1;
      if (e.key === "j" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const nextIdx = idx < filtered.length - 1 ? idx + 1 : 0;
        setSelectedId(filtered[nextIdx].id);
      } else if (e.key === "k" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const nextIdx = idx <= 0 ? filtered.length - 1 : idx - 1;
        setSelectedId(filtered[nextIdx].id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filtered, selectedId, setSelectedId]);

  if (
    (scope === "lecture" && effectiveLectureId == null) ||
    (scope === "session" && (!effectiveLectureId || sessionId == null))
  ) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">
          {scope === "session" ? "강의·차시를 선택하세요" : "강의를 선택하세요"}
        </p>
        <p className="qna-inbox__empty-desc">
          {scope === "session"
            ? "노출 범위를 차시별로 두고 강의와 차시를 선택하면 해당 차시 QnA를 볼 수 있습니다."
            : "노출 범위를 강의별로 두고 위에서 강의를 선택하면 해당 강의의 QnA를 관리할 수 있습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="qna-inbox" style={{ minHeight: "calc(100vh - 180px)" }}>
      <aside className="qna-inbox__list" ref={listRef}>
        <div className="qna-inbox__list-header">
          <h2 className="qna-inbox__list-title">
            질의응답
            {pendingCount > 0 && <span className="ds-badge ds-badge--warning" style={{ marginLeft: 8, verticalAlign: 'middle' }}>답변 대기 {pendingCount}</span>}
          </h2>
          <div className="qna-inbox__filter-group">
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "all" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <span>전체 질문</span>
              <span className="qna-inbox__filter-badge">{questions.length}</span>
            </button>
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "pending" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("pending")}
            >
              <span>답변 필요</span>
              <span className="qna-inbox__filter-badge">{pendingCount}</span>
            </button>
            <button
              type="button"
              className={`qna-inbox__filter-btn ${filter === "resolved" ? "qna-inbox__filter-btn--active" : ""}`}
              onClick={() => setFilter("resolved")}
            >
              <span>답변 완료</span>
              <span className="qna-inbox__filter-badge">{questions.length - pendingCount}</span>
            </button>
          </div>
          <div className="qna-inbox__search">
            <input
              type="search"
              className="ds-input"
              placeholder="학생 이름 · 질문 내용 · 강의"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="검색"
            />
          </div>
        </div>
        <div className="qna-inbox__list-body">
          {isLoading ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">불러오는 중…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="qna-inbox__empty">
              <p className="qna-inbox__empty-title">질문이 없습니다</p>
              <p className="qna-inbox__empty-desc">
                {searchQuery.trim() || filter !== "all" ? "필터를 바꿔 보세요." : "학생 질문이 여기에 표시됩니다."}
              </p>
            </div>
          ) : (
            filtered.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
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
          <div className="qna-inbox__empty">
            <p className="qna-inbox__empty-title">질문을 선택하세요</p>
            <p className="qna-inbox__empty-desc">왼쪽 목록에서 질문을 클릭하면 여기에 내용이 표시됩니다.</p>
            <p className="qna-inbox__keyboard-hint">
              <kbd>j</kbd> 다음 질문 · <kbd>k</kbd> 이전 질문
            </p>
          </div>
        ) : (
          <ThreadView
            postId={selectedId}
            questions={questions}
            onClose={() => setSelectedId(null)}
            onDelete={() => setSelectedId(null)}
            onSelectQuestion={setSelectedId}
          />
        )}
      </main>
    </div>
  );
}

function QuestionCard({
  question,
  isActive,
  isUnread,
  onClick,
}: {
  question: Question;
  isActive: boolean;
  isUnread: boolean;
  onClick: () => void;
}) {
  const snippet =
    question.content && question.content.length > SNIPPET_LEN
      ? question.content.slice(0, SNIPPET_LEN).trim() + "…"
      : question.content || "";

  const timeAgo = (() => {
    const d = new Date(question.created_at);
    const now = Date.now();
    const diff = (now - d.getTime()) / 60000;
    if (diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  })();

  const statusClass = question.is_answered ? "qna-inbox__status--resolved" : "qna-inbox__status--pending";
  const statusLabel = question.is_answered ? "답변 완료" : "답변 대기";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""} ${isUnread ? "qna-inbox__card--unread" : ""}`}
    >
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-avatar-wrap">
          <QnaAvatar name={question.created_by_deleted ? "삭제된 학생입니다." : (question.student_name ?? "?")} role="student" size={30} />
        </div>
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{question.title}</div>
            <span className={`qna-inbox__status ${statusClass}`}>{statusLabel}</span>
          </div>
          {snippet && <div className="qna-inbox__card-snippet">{snippet}</div>}
          <div className="qna-inbox__card-meta">
            <span>{question.created_by_deleted ? "삭제된 학생입니다." : (question.student_name ?? "—")}</span>
            <span className="qna-inbox__card-meta-dot" />
            <span>{timeAgo}</span>
            {question.lecture_title && (
              <>
                <span className="qna-inbox__card-meta-dot" />
                <span>{question.lecture_title}</span>
              </>
            )}
            {question.category_label && (
              <>
                <span className="qna-inbox__card-meta-dot" />
                <span style={{ color: "var(--color-primary)" }}>{question.category_label}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ThreadView({
  postId,
  questions,
  onClose,
  onDelete,
  onSelectQuestion,
}: {
  postId: number;
  questions: Question[];
  onClose: () => void;
  onDelete: () => void;
  onSelectQuestion: (id: number) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
  });

  const questionHistory = useMemo(() => {
    if (!post?.created_by) return [];
    return questions
      .filter((q) => q.id !== post.id && q.created_by === post.created_by)
      .slice(0, 15)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [post, questions]);

  const deletePostMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      feedback.success("질문이 삭제되었습니다.");
      onDelete();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  if (postId == null) return null;

  if (isLoading || !post) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">{isLoading ? "불러오는 중…" : "질문을 찾을 수 없습니다."}</p>
      </div>
    );
  }

  const lectureLabel = post.mappings?.[0]?.node_detail?.lecture_title ?? "—";

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">{post.title}</h1>
            <div className="qna-inbox__thread-meta">
              <span>{post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "—")}</span>
              <span className="qna-inbox__thread-meta-dot" />
              <span>{lectureLabel}</span>
              {post.category_label && (
                <>
                  <span className="qna-inbox__thread-meta-dot" />
                  <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{post.category_label}</span>
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
              {post.replies_count != null && post.replies_count > 0 ? (
                <>
                  <span className="qna-inbox__thread-meta-dot" />
                  <span className="qna-inbox__status qna-inbox__status--resolved">답변 완료</span>
                </>
              ) : (
                <>
                  <span className="qna-inbox__thread-meta-dot" />
                  <span className="qna-inbox__status qna-inbox__status--pending">답변 대기</span>
                </>
              )}
            </div>
          </div>
          <div className="qna-inbox__thread-actions">
            <Button intent="ghost" size="sm" onClick={onClose}>
              목록
            </Button>
            <Button
              intent="danger"
              size="sm"
              onClick={async () => { if (await confirm({ title: "질문 삭제", message: "이 질문을 삭제할까요?", confirmText: "삭제", danger: true })) deletePostMut.mutate(); }}
              disabled={deletePostMut.isPending}
            >
              삭제
            </Button>
          </div>
        </div>
      </header>

      <div className="qna-inbox__student-panel">
        <QnaAvatar name={post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "?")} role="student" size={28} />
        <div className="qna-inbox__student-info">
          <div className="qna-inbox__student-panel-label">학생</div>
          <div className="qna-inbox__student-name">{post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "—")}</div>
          <div className="qna-inbox__student-course">{lectureLabel}</div>
        </div>
        {questionHistory.length > 0 && (
          <div className="qna-inbox__student-history">이전 질문 {questionHistory.length}건</div>
        )}
      </div>

      <div className="qna-inbox__thread-body">
        {/* Student question */}
        <div className="qna-inbox__message-row">
          <QnaAvatar name={post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "?")} role="student" />
          <div className="qna-inbox__message-bubble">
            <div className="qna-inbox__message-meta">
              <span className="qna-inbox__message-author">{post.created_by_deleted ? "삭제된 학생입니다." : (post.created_by_display ?? "학생")}</span>
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

        {post.replies_count != null && post.replies_count > 0 && (
          <div className="qna-inbox__thread-sep">
            <span className="qna-inbox__thread-sep-label">선생님 답변</span>
          </div>
        )}

        <AnswerThread postId={postId} />

        {questionHistory.length > 0 && (
          <div className="qna-inbox__timeline">
            <div className="qna-inbox__timeline-title">질문 기록</div>
            {questionHistory.map((q) => (
              <div key={q.id} className="qna-inbox__timeline-item">
                <span className="qna-inbox__timeline-dot" />
                <button type="button" onClick={() => onSelectQuestion(q.id)}>
                  {new Date(q.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}{" "}
                  {q.title}
                </button>
                <span className={`qna-inbox__status ${q.is_answered ? "qna-inbox__status--resolved" : "qna-inbox__status--pending"}`}>{q.is_answered ? "답변 완료" : "답변 대기"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Composer postId={postId} allowReply={!post.created_by_deleted} />
    </>
  );
}

function AnswerThread({ postId }: { postId: number }) {
  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["post-replies", postId],
    queryFn: () => fetchPostReplies(postId),
  });

  if (isLoading) {
    return (
      <div className="qna-inbox__message">
        <p className="qna-inbox__empty-desc">답변 불러오는 중…</p>
      </div>
    );
  }

  return (
    <>
      {replies.map((answer) => (
        <ReplyBlock key={answer.id} postId={postId} answer={answer} />
      ))}
    </>
  );
}

function ReplyBlock({ postId, answer }: { postId: number; answer: Answer }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(answer.content);
  // 서버 데이터 갱신 시 편집 중이 아니면 동기화
  const prevContent = useRef(answer.content);
  if (prevContent.current !== answer.content && !editing) {
    prevContent.current = answer.content;
    setEditContent(answer.content);
  }

  const updateMut = useMutation({
    mutationFn: () => updateReply(postId, answer.id, editContent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      setEditing(false);
      feedback.success("답변이 수정되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "수정에 실패했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteReply(postId, answer.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      feedback.success("답변이 삭제되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  const teacherName = answer.created_by_display ?? "선생님";

  return (
    <div className="qna-inbox__message-row qna-inbox__message-row--teacher">
      <QnaAvatar name={teacherName} role="teacher" />
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
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
            />
            <div className="qna-inbox__edit-actions">
              <Button size="sm" intent="primary" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                저장
              </Button>
              <Button size="sm" intent="secondary" onClick={() => setEditing(false)}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="qna-inbox__message-body"><PostReadView html={answer.content} /></div>
            <div className="qna-inbox__message-actions">
              <Button size="sm" intent="ghost" onClick={() => setEditing(true)}>
                수정
              </Button>
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

function Composer({ postId, allowReply = true }: { postId: number; allowReply?: boolean }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: () => createAnswer(postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      qc.invalidateQueries({ queryKey: ["post-replies", postId] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setContent("");
      feedback.success("답변이 등록되었습니다. 자동발송이 설정되어 있으면 알림이 발송됩니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "등록에 실패했습니다.");
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && content.trim() && !createMut.isPending) {
      e.preventDefault();
      createMut.mutate();
    }
  };

  return (
    <div className="qna-inbox__composer">
      {allowReply ? (
      <div className="qna-inbox__composer-inner">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="학생에게 답변을 작성하세요…"
          rows={3}
        />
        <div className="qna-inbox__composer-footer">
          <span className="qna-inbox__composer-hint">
            <kbd>Ctrl</kbd><kbd>Enter</kbd> 빠른 등록
          </span>
          <Button
            intent="primary"
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={!content.trim() || createMut.isPending}
          >
            {createMut.isPending ? "등록 중…" : "답변 등록"}
          </Button>
        </div>
      </div>
      ) : (
        <p className="qna-inbox__empty-desc" style={{ margin: 0 }}>
          삭제된 학생의 질문에는 추가 답변을 등록할 수 없습니다.
        </p>
      )}
    </div>
  );
}
