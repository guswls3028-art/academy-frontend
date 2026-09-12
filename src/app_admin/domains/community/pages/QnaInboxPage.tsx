// PATH: src/app_admin/domains/community/pages/QnaInboxPage.tsx
// QnA Inbox/Thread UI — SaaS 표준 (한 화면 좌 목록 | 우 상세·답변), 페이지 이동 없음

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCommunityQuestions,
  fetchPost,
  deletePost,
  getAttachmentDownloadUrl,
  fetchPostAuthorContext,
  type PostAttachment,
  type Question,
} from "../api/community.api";
import { ExternalLink, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button, EmptyState, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import type { OperationalNotificationCountsResult } from "@/shared/api/contracts/notifications";
import { getCommunityStorageCleanupNotice } from "@/shared/api/contracts/community";
import PostReadView from "../components/PostReadView";
import PostThreadView from "../components/PostThreadView";
import PostHistoryTimeline from "../components/PostHistoryTimeline";
import CommunityEmptyState from "../components/CommunityEmptyState";
import QnaMatchupResults from "../components/QnaMatchupResults";
import { adminCommunityQueryKeys } from "../queryKeys";
import {
  communityAuthorContextQueryKey,
  normalizeStudentName,
  formatFileSize,
  timeAgo,
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
  const operationalNotifications = useOperationalNotificationCounts();

  const {
    data: questions = [],
    isLoading,
    isError,
    refetch: refetchQuestions,
  } = useQuery<Question[]>({
    queryKey: adminCommunityQueryKeys.questionsAll,
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

  const pendingCount = operationalNotifications.counts.qnaPending;
  const answeredCount = useMemo(() => questions.filter((q) => q.is_answered).length, [questions]);

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
    <div className={`qna-inbox qna-inbox--viewport${selectedId != null ? " qna-inbox--has-selection" : ""}`}>
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
              <span className="qna-inbox__filter-badge">{answeredCount}</span>
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
          ) : isError ? (
            <EmptyState
              mode="embedded"
              scope="panel"
              tone="error"
              title="질문 목록을 불러오지 못했습니다"
              actions={
                <Button intent="secondary" size="sm" onClick={() => void refetchQuestions()}>
                  다시 시도
                </Button>
              }
            />
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
            <span>{timeAgo(question.created_at)}</span>
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
  const answeredOptimisticallyRef = useRef<number | null>(null);
  const [mobilePane, setMobilePane] = useState<"reference" | "answer">("reference");
  const {
    data: post,
    isLoading,
    isError,
    refetch: refetchPost,
  } = useQuery({
    queryKey: adminCommunityQueryKeys.post(postId),
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

  useEffect(() => {
    setMobilePane("reference");
    answeredOptimisticallyRef.current = null;
  }, [postId]);

  const markQuestionAnswered = useCallback(() => {
    if ((post?.replies_count ?? 0) > 0 || answeredOptimisticallyRef.current === postId) return;
    answeredOptimisticallyRef.current = postId;

    qc.setQueriesData<Question[]>({ queryKey: adminCommunityQueryKeys.questions }, (current) => (
      current?.map((question) => (
        question.id === postId ? { ...question, is_answered: true } : question
      ))
    ));
    qc.setQueriesData<OperationalNotificationCountsResult>(
      { queryKey: notificationQueryKeys.operationalCounts },
      (current) => {
        if (!current || current.counts.qnaPending <= 0) return current;
        return {
          ...current,
          counts: {
            ...current.counts,
            qnaPending: current.counts.qnaPending - 1,
            total: Math.max(0, current.counts.total - 1),
          },
        };
      },
    );
  }, [post?.replies_count, postId, qc]);

  const deletePostMut = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.questions });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: adminCommunityQueryKeys.adminNotificationCounts });
      const cleanupNotice = getCommunityStorageCleanupNotice(result);
      if (cleanupNotice) feedback.warning(cleanupNotice);
      else feedback.success("질문이 삭제되었습니다.");
      onDelete();
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "삭제에 실패했습니다.");
    },
  });

  if (postId == null) return null;

  if (isLoading) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">불러오는 중…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        mode="embedded"
        scope="panel"
        tone="error"
        title="질문을 불러오지 못했습니다"
        actions={
          <Button intent="secondary" size="sm" onClick={() => void refetchPost()}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (!post) {
    return (
      <div className="qna-inbox__empty">
        <p className="qna-inbox__empty-title">질문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const studentName = post.created_by_deleted ? "삭제된 학생입니다." : normalizeStudentName(post.created_by_display);
  const mappedLectureLabel = post.mappings?.[0]?.node_detail?.lecture_title ?? "";
  const contextLectures = toLectureChips(studentDetail?.enrollments);
  const studentLectures = contextLectures?.length ? contextLectures : lectureInfosFromTitle(mappedLectureLabel);
  const imageAttachments = (post.attachments ?? []).filter(
    (attachment) => (attachment.content_type || "").startsWith("image/"),
  );
  const fileAttachments = (post.attachments ?? []).filter(
    (attachment) => !(attachment.content_type || "").startsWith("image/"),
  );
  const attachmentCount = imageAttachments.length + fileAttachments.length;
  const matchupResults = Array.isArray(post.meta?.matchup_results)
    ? post.meta.matchup_results as MatchupResultItem[]
    : [];
  const matchupPending = imageAttachments.length > 0
    && matchupResults.length === 0
    && Date.now() - new Date(post.created_at).getTime() < 5 * 60 * 1000;

  const focusComposer = () => {
    setMobilePane("answer");
    window.setTimeout(() => {
      const editor = composerRef.current?.querySelector<HTMLElement>(".ProseMirror");
      editor?.focus();
    }, 120);
  };

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
                onClick={focusComposer}
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

      <div className="qna-inbox__mobile-workbench-tabs" role="tablist" aria-label="질문 답변 작업 영역">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "reference"}
          className={mobilePane === "reference" ? "is-active" : ""}
          onClick={() => setMobilePane("reference")}
        >
          질문 자료
          {attachmentCount > 0 && <span>{attachmentCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "answer"}
          className={mobilePane === "answer" ? "is-active" : ""}
          onClick={() => setMobilePane("answer")}
        >
          답변 작성
        </button>
      </div>

      <div className="qna-inbox__workbench">
        <section
          className={`qna-inbox__reference-pane${mobilePane === "reference" ? " is-mobile-active" : ""}`}
          aria-label="학생 질문 자료"
        >
          <div className="qna-inbox__pane-heading">
            <div>
              <span className="qna-inbox__pane-eyebrow">QUESTION</span>
              <h2>질문 자료</h2>
            </div>
            <span className="qna-inbox__pane-caption">
              {attachmentCount > 0
                ? [
                    imageAttachments.length > 0 ? `이미지 ${imageAttachments.length}장` : null,
                    fileAttachments.length > 0 ? `파일 ${fileAttachments.length}개` : null,
                  ].filter(Boolean).join(" · ")
                : "텍스트 질문"}
            </span>
          </div>
          <div className="qna-inbox__reference-scroll">
            <div className="qna-inbox__question-copy">
              <PostReadView html={post.content} />
            </div>

            {imageAttachments.length > 0 ? (
              <QnaAttachmentViewer postId={post.id} attachments={imageAttachments} />
            ) : attachmentCount === 0 ? (
              <div className="qna-inbox__attachment-empty">
                첨부된 문제 사진이 없습니다. 위 질문 내용을 확인해 주세요.
              </div>
            ) : null}

            {fileAttachments.length > 0 && (
              <QnaFileAttachmentList postId={post.id} attachments={fileAttachments} />
            )}

            {matchupResults.length > 0 && <QnaMatchupResults results={matchupResults} />}
            {matchupPending && (
              <div className="qna-matchup-results__pending">
                <span className="qna-matchup-results__pending-dot" aria-hidden />
                AI 매치업 분석 중… (이미지 첨부 자동 탐색)
              </div>
            )}

            <PostHistoryTimeline
              label="이전 질문"
              history={questionHistory.map((question) => ({
                id: question.id,
                title: question.title,
                created_at: question.created_at,
                is_answered: !!question.is_answered,
              }))}
              onSelect={onSelectQuestion}
            />
          </div>
        </section>

        <section
          ref={composerRef}
          className={`qna-inbox__answer-pane${mobilePane === "answer" ? " is-mobile-active" : ""}`}
          aria-label="선생님 답변 작성"
        >
          <div className="qna-inbox__pane-heading qna-inbox__pane-heading--answer">
            <div>
              <span className="qna-inbox__pane-eyebrow">ANSWER</span>
              <h2>{(post.replies_count ?? 0) > 0 ? "선생님 답변" : "답변 작성"}</h2>
            </div>
            <span className={`qna-inbox__status ${(post.replies_count ?? 0) > 0 ? "qna-inbox__status--resolved" : "qna-inbox__status--pending"}`}>
              {(post.replies_count ?? 0) > 0 ? "답변 완료" : "답변 필요"}
            </span>
          </div>
          <PostThreadView
            postId={postId}
            mode="answer"
            allowReply={!post.created_by_deleted}
            invalidateKeys={[adminCommunityQueryKeys.questions, notificationQueryKeys.operationalCounts]}
            placeholder="학생에게 답변을 작성하세요…"
            onReplyCreated={markQuestionAnswered}
          />
        </section>
      </div>
    </>
  );
}

function QnaFileAttachmentList({
  postId,
  attachments,
  previewRecovery = false,
}: {
  postId: number;
  attachments: PostAttachment[];
  previewRecovery?: boolean;
}) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = async (attachment: PostAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const { url } = await getAttachmentDownloadUrl(postId, attachment.id);
      const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
      downloadPresignedUrl(url, attachment.original_name);
    } catch {
      feedback.error("다운로드 URL을 가져오지 못했습니다.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section
      className="qna-inbox__file-section"
      aria-label={previewRecovery ? "미리보기를 준비하지 못한 이미지" : "질문 첨부파일"}
    >
      <div className="qna-inbox__file-heading">
        {previewRecovery ? "이미지 원본" : "첨부파일"} ({attachments.length})
      </div>
      {previewRecovery && (
        <p className="qna-inbox__file-recovery-note">
          이미지 미리보기를 준비하지 못했습니다. 첨부 정보는 남아 있으며 원본 파일을 다시 요청할 수 있습니다.
        </p>
      )}
      <div className="qna-inbox__file-list">
        {attachments.map((attachment) => {
          const extension = attachment.original_name.includes(".")
            ? attachment.original_name.split(".").pop()?.toUpperCase() || "FILE"
            : "FILE";
          const downloading = downloadingId === attachment.id;
          const actionLabel = previewRecovery ? "원본 다시 요청" : "다운로드";
          return (
            <button
              key={attachment.id}
              type="button"
              className="qna-inbox__file-card"
              aria-label={`${attachment.original_name} ${actionLabel}`}
              disabled={downloading}
              onClick={() => void handleDownload(attachment)}
            >
              <span className="qna-inbox__file-ext" aria-hidden>
                {extension.slice(0, 4)}
              </span>
              <span className="qna-inbox__file-info">
                <strong title={attachment.original_name}>{attachment.original_name}</strong>
                <span>{attachment.content_type || "파일"} · {formatFileSize(attachment.size_bytes)}</span>
              </span>
              <span className="qna-inbox__file-action">{downloading ? "준비 중…" : actionLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QnaAttachmentViewer({
  postId,
  attachments,
}: {
  postId: number;
  attachments: PostAttachment[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<number>>(() => new Set());
  const attachmentKey = [
    String(postId),
    ...attachments.map((attachment) => `${attachment.id}:${attachment.download_url ?? ""}`),
  ].join("|");
  const availableAttachments = attachments.filter(
    (attachment): attachment is PostAttachment & { download_url: string } => (
      Boolean(attachment.download_url) && !failedPreviewIds.has(attachment.id)
    ),
  );
  const unavailableAttachments = attachments.filter(
    (attachment) => !attachment.download_url || failedPreviewIds.has(attachment.id),
  );
  const resolvedActiveIndex = Math.min(activeIndex, availableAttachments.length - 1);
  const active = availableAttachments[resolvedActiveIndex];

  useEffect(() => {
    setActiveIndex(0);
    setRotation(0);
    setZoom(1);
    setFailedPreviewIds(new Set());
  }, [attachmentKey]);

  const selectAttachment = (index: number) => {
    setActiveIndex(index);
    setRotation(0);
    setZoom(1);
  };

  const markPreviewFailed = (attachmentId: number) => {
    setFailedPreviewIds((current) => {
      if (current.has(attachmentId)) return current;
      const next = new Set(current);
      next.add(attachmentId);
      return next;
    });
  };

  if (!active) {
    return (
      <QnaFileAttachmentList postId={postId} attachments={unavailableAttachments} previewRecovery />
    );
  }

  return (
    <>
      <div className="qna-inbox__image-viewer">
        <div className="qna-inbox__viewer-toolbar" aria-label="문제 이미지 보기 도구">
          <div className="qna-inbox__viewer-file">
            <strong>{active.original_name}</strong>
            <span>{resolvedActiveIndex + 1} / {availableAttachments.length}</span>
          </div>
          <div className="qna-inbox__viewer-actions">
            <button type="button" onClick={() => setRotation((value) => value - 90)} aria-label="왼쪽으로 90도 회전" title="왼쪽 90도 회전">
              <RotateCcw size={ICON_FOR_BUTTON.sm} aria-hidden />
            </button>
            <button type="button" onClick={() => setRotation((value) => value + 90)} aria-label="오른쪽으로 90도 회전" title="오른쪽 90도 회전">
              <RotateCw size={ICON_FOR_BUTTON.sm} aria-hidden />
            </button>
            <span className="qna-inbox__viewer-divider" aria-hidden />
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} disabled={zoom <= 0.5} aria-label="이미지 축소" title="축소">
              <ZoomOut size={ICON_FOR_BUTTON.sm} aria-hidden />
            </button>
            <span className="qna-inbox__viewer-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))} disabled={zoom >= 2.5} aria-label="이미지 확대" title="확대">
              <ZoomIn size={ICON_FOR_BUTTON.sm} aria-hidden />
            </button>
            <a href={active.download_url} target="_blank" rel="noopener noreferrer" aria-label="문제 이미지 원본 열기" title="원본 열기">
              <ExternalLink size={ICON_FOR_BUTTON.sm} aria-hidden />
              <span>원본</span>
            </a>
          </div>
        </div>
        <div className="qna-inbox__image-stage">
          <img
            src={active.download_url}
            alt={active.original_name}
            onError={() => markPreviewFailed(active.id)}
            // Rotation and zoom are continuous viewer state, so a runtime transform is required.
            // eslint-disable-next-line no-restricted-syntax
            style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
          />
        </div>
        {availableAttachments.length > 1 && (
          <div className="qna-inbox__image-strip" aria-label="첨부 이미지 선택">
            {availableAttachments.map((attachment, index) => (
              <button
                key={attachment.id}
                type="button"
                className={index === resolvedActiveIndex ? "is-active" : ""}
                onClick={() => selectAttachment(index)}
                aria-label={`${index + 1}번째 이미지 ${attachment.original_name}`}
                aria-pressed={index === resolvedActiveIndex}
              >
                <img
                  src={attachment.download_url}
                  alt=""
                  onError={() => markPreviewFailed(attachment.id)}
                />
              </button>
            ))}
          </div>
        )}
      </div>
      {unavailableAttachments.length > 0 && (
        <QnaFileAttachmentList
          postId={postId}
          attachments={unavailableAttachments}
          previewRecovery
        />
      )}
    </>
  );
}
