// PATH: src/app_admin/domains/community/pages/QnaInboxPage.tsx
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
import {
  fetchCommunityQuestions,
  fetchPost,
  deletePost,
  fetchPostAuthorContext,
  type Question,
} from "../api/community.api";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import PostReadView from "../components/PostReadView";
import PostThreadView from "../components/PostThreadView";
import PostHistoryTimeline from "../components/PostHistoryTimeline";
import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityAvatar from "../components/CommunityAvatar";
import QnaMatchupResults from "../components/QnaMatchupResults";
import {
  communityAuthorContextQueryKey,
  normalizeStudentName,
  toLectureChips,
} from "../utils/communityHelpers";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import "@admin/domains/community/qna-inbox.css";

type MatchupResultItem = {
  problem_id: number; similarity: number; text: string; number: number;
  source_type: string; source_lecture_title: string;
  source_session_title: string; source_exam_title: string;
};

type FilterKind = "all" | "pending" | "resolved";

function lectureInfosFromTitle(title?: string | null) {
  const lectureName = title?.trim();
  return lectureName && lectureName !== "—" ? [{ lectureName }] : undefined;
}

export default function QnaInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam && /^\d+$/.test(selectedIdParam) ? Number(selectedIdParam) : null;

  // QnA는 항상 전체 질문을 표시 — scope 필터 불필요
  const allScopeParams = useMemo(() => ({ scope: "all" as const }), []);

  const [filter, setFilter] = useState<FilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["community-questions", "all"],
    queryFn: () => fetchCommunityQuestions(allScopeParams),
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

  useEffect(() => {
    if (selectedId == null || isLoading) return;
    if (!filtered.some((q) => q.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId, isLoading, setSelectedId]);

  return (
    <div className="qna-inbox qna-inbox--viewport">
      <aside className="qna-inbox__list" ref={listRef}>
        <div className="qna-inbox__list-header">
          <h2 className="qna-inbox__list-title">질의응답</h2>
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
            <CommunityEmptyState variant="loading" postType="qna" />
          ) : filtered.length === 0 ? (
            <CommunityEmptyState
              variant={searchQuery.trim() || filter !== "all" ? "no-results" : "no-posts"}
              postType="qna"
              description={searchQuery.trim() || filter !== "all" ? "필터를 바꾸거나 다른 검색어를 입력해 보세요." : "학생이 질문을 등록하면 여기에 표시됩니다."}
            />
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
          <CommunityEmptyState variant="no-selection" postType="qna" showKeyboardHint />
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
  const studentName = question.created_by_deleted ? "삭제된 학생" : normalizeStudentName(question.student_name);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`qna-inbox__card ${isActive ? "qna-inbox__card--active" : ""} ${isUnread ? "qna-inbox__card--unread" : ""}`}
    >
      <div className="qna-inbox__card-top">
        <div className="qna-inbox__card-body">
          <div className="qna-inbox__card-title-row">
            <div className="qna-inbox__card-title">{question.title}</div>
            <span className={`qna-inbox__status ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="qna-inbox__card-meta">
            <StudentNameWithLectureChip
              name={studentName}
              avatarSize={20}
              chipSize={16}
              density="compact"
              maxLectureChips={1}
              lectures={question.lecture_title ? [{ lectureName: question.lecture_title }] : undefined}
            />
            <span className="qna-inbox__card-meta-dot" />
            <span>{timeAgo}</span>
          </div>
          {question.category_label && (
            <div className="qna-inbox__card-meta qna-inbox__card-meta--sub">
              <span>{question.category_label}</span>
            </div>
          )}
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
  const composerRef = useRef<HTMLDivElement>(null);
  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId != null,
    // AI 매치업 결과는 비동기 워커에서 채워짐 — 결과 도착 전까지 5초 간격 polling.
    // 글 작성 후 5분 이내(MAX_POLL_AGE_MS)이고, 이미지 첨부가 있고, 아직 matchup_results가
    // 비어 있을 때만 활성화 (이미 결과 있으면 polling 정지).
    refetchInterval: (q) => {
      const data = q.state.data as { post_type?: string; meta?: { matchup_results?: unknown[] }; attachments?: { content_type: string }[]; created_at?: string } | undefined;
      if (!data) return false;
      if (data.post_type !== "qna") return false;
      const hasImage = (data.attachments ?? []).some((a) => (a.content_type || "").startsWith("image/"));
      if (!hasImage) return false;
      const results = data.meta?.matchup_results;
      if (Array.isArray(results) && results.length > 0) return false; // 이미 도착
      const createdAt = data.created_at ? new Date(data.created_at).getTime() : 0;
      const MAX_POLL_AGE_MS = 5 * 60 * 1000;
      if (Date.now() - createdAt > MAX_POLL_AGE_MS) return false; // 너무 오래된 글
      return 5000;
    },
  });

  const { data: studentDetail } = useQuery({
    queryKey: communityAuthorContextQueryKey(post?.created_by),
    queryFn: () => fetchPostAuthorContext(post!.created_by!),
    enabled: post?.created_by != null && !post?.created_by_deleted,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const questionHistory = useMemo(() => {
    if (!post?.created_by) return [];
    return questions
      .filter((q) => q.id !== post.id && q.created_by === post.created_by)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);
  }, [post?.id, post?.created_by, questions]);

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

  const studentName = post.created_by_deleted ? "삭제된 학생입니다." : normalizeStudentName(post.created_by_display);
  const mappedLectureLabel = post.mappings?.[0]?.node_detail?.lecture_title ?? "";
  const contextLectures = toLectureChips(studentDetail?.enrollments);
  const studentLectures = contextLectures?.length ? contextLectures : lectureInfosFromTitle(mappedLectureLabel);

  return (
    <>
      <header className="qna-inbox__thread-header">
        <div className="qna-inbox__thread-title-row">
          <div className="qna-inbox__thread-title-group">
            <h1 className="qna-inbox__thread-title">{post.title}</h1>
            <div className="qna-inbox__thread-meta">
              <StudentNameWithLectureChip
                name={studentName}
                avatarSize={20}
                chipSize={16}
                maxLectureChips={1}
                lectures={studentLectures}
              />
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
            {!post.created_by_deleted && (
              <Button
                intent="primary"
                size="sm"
                onClick={() => {
                  composerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                  setTimeout(() => {
                    const editor = composerRef.current?.querySelector<HTMLElement>(".ProseMirror");
                    editor?.focus();
                  }, 400);
                }}
              >
                답변하기
              </Button>
            )}
            <Button intent="ghost" size="sm" onClick={onClose}>
              목록
            </Button>
            <Button
              intent="danger"
              size="sm"
              onClick={async () => {
                if (await confirm({
                  title: "질문 삭제",
                  message: "이 질문과 답변을 모두 삭제합니다. 학생 화면에서도 사라지며 복구할 수 없어요.",
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
        <div className="qna-inbox__student-info">
          <div className="qna-inbox__student-panel-label">학생</div>
          <div className="qna-inbox__student-name">
            <StudentNameWithLectureChip
              name={studentName}
              avatarSize={28}
              chipSize={20}
              maxLectureChips={1}
              lectures={studentLectures}
            />
          </div>
        </div>
        {questionHistory.length > 0 && (
          <div className="qna-inbox__student-history">이전 질문 {questionHistory.length}건</div>
        )}
      </div>

      <div className="qna-inbox__thread-body">
        {/* Student question */}
        <div className="qna-inbox__message-row">
          <CommunityAvatar name={studentName} role="student" />
          <div className="qna-inbox__message-bubble">
            <div className="qna-inbox__message-meta">
              <StudentNameWithLectureChip
                name={studentName}
                chipSize={16}
                maxLectureChips={1}
                lectures={studentLectures}
              />
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

            {/* 첨부 이미지 즉시 노출 — AI 매치업 분석 PENDING 과 무관하게 학원장이
                바로 답변할 수 있게 한다. 2026-05-30 박철과학 학원장 신고 반영. */}
            {(() => {
              const images = (post.attachments ?? []).filter(
                (a) => (a.content_type || "").startsWith("image/") && a.download_url,
              );
              if (images.length === 0) return null;
              return (
                <div className="qna-inbox__attachments">
                  {images.map((att) => (
                    <a
                      key={att.id}
                      href={att.download_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="qna-inbox__attachment-link"
                      title={att.original_name}
                    >
                      <img
                        src={att.download_url ?? ""}
                        alt={att.original_name}
                        className="qna-inbox__attachment-image"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              );
            })()}

            {/* AI 매치업 결과 (선생님 전용) */}
            {(() => {
              const mr = post.meta?.matchup_results;
              const hasImage = (post.attachments ?? []).some((a) => (a.content_type || "").startsWith("image/"));
              if (Array.isArray(mr) && mr.length > 0) {
                return <QnaMatchupResults results={mr as MatchupResultItem[]} />;
              }
              // 이미지 첨부가 있고 5분 이내인데 결과가 아직 없으면 진행 중 표시
              const createdAt = post.created_at ? new Date(post.created_at).getTime() : 0;
              const isPolling = hasImage && Date.now() - createdAt < 5 * 60 * 1000;
              if (isPolling) {
                return (
                  <div className="qna-matchup-results__pending">
                    <span className="qna-matchup-results__pending-dot" aria-hidden />
                    AI 매치업 분석 중… (이미지 첨부 자동 탐색)
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <div className="qna-inbox__thread-sep">
          <span className="qna-inbox__thread-sep-label">
            {(post.replies_count ?? 0) > 0 ? "선생님 답변" : "아직 답변이 없습니다"}
          </span>
        </div>

        {(post.replies_count ?? 0) === 0 && (
          <div className="qna-inbox__answer-cta">
            <p>아래 입력란에서 답변을 작성해 주세요.</p>
          </div>
        )}

        <PostHistoryTimeline
          label="이전 질문"
          history={questionHistory.map((q) => ({
            id: q.id,
            title: q.title,
            created_at: q.created_at,
            is_answered: !!q.is_answered,
          }))}
          onSelect={onSelectQuestion}
        />
      </div>

      <div ref={composerRef}>
        <PostThreadView
          postId={postId}
          mode="answer"
          allowReply={!post.created_by_deleted}
          invalidateKeys={[["community-questions"], ["admin", "notification-counts"]]}
          placeholder="학생에게 답변을 작성하세요…"
        />
      </div>
    </>
  );
}
