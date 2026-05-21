/**
 * PATH: src/app_student/domains/community/pages/CommunityPage.tsx
 * 학생 커뮤니티 — QnA | 게시판 | 자료실
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import { IconPlus, IconChevronRight, IconBoard } from "@student/shared/ui/icons/Icons";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import DOMPurify from "dompurify";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { fetchVideoMe } from "@student/domains/video/api/video.api";
import { useMarkNotificationsSeen } from "@student/domains/notifications/hooks/useSeenNotifications";
import {
  fetchMyQuestions,
  fetchQuestionDetail,
  fetchNoticePosts,
  fetchBoardPosts,
  fetchMaterialsPosts,
  fetchPostDetail,
  fetchReplies,
  submitQuestion,
  isAnswered,
  fetchMyCounselRequests,
  submitCounselRequest,
  uploadPostAttachments,
  getAttachmentDownloadUrl,
  type PostEntity,
  type PostAttachment,
  type Answer,
} from "../api/community.api";
import "./CommunityPage.css";

// ─── Types ───
type Tab = "notice" | "board" | "materials" | "qna" | "counsel";
type QnaFilter = "all" | "pending" | "resolved";

// 상담 분야 표시 사전 — 백엔드 category_label은 free-text. 학생 폼 select 옵션 전용.
const COUNSEL_CATEGORIES = ["진로 상담", "학습 방법", "성적 상담", "출결·생활", "결제·수강", "기타"] as const;
type View =
  | { kind: "tabs" }
  | { kind: "notice-detail"; id: number }
  | { kind: "qna-form" }
  | { kind: "qna-detail"; id: number; cached?: PostEntity }
  | { kind: "board-detail"; id: number }
  | { kind: "materials-detail"; id: number }
  | { kind: "counsel-form" }
  | { kind: "counsel-detail"; id: number; cached?: PostEntity };

const TABS: { key: Tab; label: string }[] = [
  { key: "notice", label: "공지사항" },
  { key: "board", label: "게시판" },
  { key: "materials", label: "자료실" },
  { key: "qna", label: "QnA" },
  { key: "counsel", label: "상담" },
];

// ─── Shared tab bar ───
function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="community-segmented-tabs">
      {items.map(({ key, label, count }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`community-segmented-tabs__button${active ? " community-segmented-tabs__button--active" : ""}`}
          >
            <span>{label}</span>
            {count != null && count > 0 && (
              <span
                className={`community-segmented-tabs__count${active ? " community-segmented-tabs__count--active" : ""}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Parent author badge ───
function ParentAuthorBadge() {
  return (
    <span
      className="community-parent-badge"
      title="학부모가 작성한 글입니다"
    >
      학부모 작성
    </span>
  );
}

// ─── Status chip ───
function StatusChip({ answered }: { answered: boolean }) {
  return (
    <span
      className={`community-status-chip ${answered ? "community-status-chip--done" : "community-status-chip--pending"}`}
      role="status"
    >
      <span className="community-status-chip__dot" aria-hidden="true" />
      {answered ? "답변 완료" : "답변 대기"}
    </span>
  );
}

// ═══════════════════════════════════════════
// My Activity Summary (#40) — 학생 본인 활동 카드.
// SSOT: backend GET /community/posts/my-activity/
// ═══════════════════════════════════════════
function MyActivitySummary() {
  const q = useQuery({
    queryKey: ["student", "community", "my-activity", 30],
    // dynamic import to avoid circular if needed
    queryFn: () => import("../api/community.api").then((m) => m.fetchMyActivity(30)),
    staleTime: 60 * 1000,
  });
  const data = q.data;
  if (!data || !data.is_student) return null;
  const hasActivity = (data.score || 0) > 0;
  return (
    <div className="student-activity-summary">
      <div className="community-activity-main">
        <div className="student-activity-summary__mark" aria-hidden="true">
          <IconBoard className="community-icon-board" />
        </div>
        <div className="community-activity-copy">
          <div className="student-activity-summary__label">이번 달 내 활동</div>
          <div className="student-activity-summary__text">
            {hasActivity
              ? <>글 {data.post_count}개 · 댓글 {data.reply_count}개 · 받은 좋아요 {data.received_likes}개</>
              : <span className="community-activity-muted">첫 글을 올려보세요. 학원 친구들이 함께 읽어요.</span>}
          </div>
        </div>
      </div>
      {data.rank !== null && data.total_active_students > 0 && (
        <div className="community-activity-rank">
          <div className="community-activity-rank__label">활동 학생 중</div>
          <div className="community-activity-rank__value">
            {data.rank}<span className="community-activity-rank__total"> / {data.total_active_students}</span>
          </div>
        </div>
      )}
      {data.badges && data.badges.length > 0 && (
        <div className="community-activity-badges">
          {data.badges.map((b) => (
            <span key={b.key} title={b.label} className="community-activity-badge">{b.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════
export default function CommunityPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("notice");
  const [view, setView] = useState<View>({ kind: "tabs" });

  // 알림에서 질문/상담 상세 직접 진입 + dashboard "새 답변" tab prefill
  useEffect(() => {
    const state = location.state as
      | { openQuestionId?: number; openCounselId?: number; tab?: Tab }
      | null;
    if (state?.openQuestionId != null) {
      setTab("qna");
      setView({ kind: "qna-detail", id: state.openQuestionId });
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.openCounselId != null) {
      setTab("counsel");
      setView({ kind: "counsel-detail", id: state.openCounselId });
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.tab) {
      setTab(state.tab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const back = () => setView({ kind: "tabs" });

  // ─── Sub-views ───
  if (view.kind === "notice-detail") return <NoticeDetail id={view.id} onBack={back} />;
  if (view.kind === "qna-form") return <QnaForm onBack={back} onSuccess={back} />;
  if (view.kind === "qna-detail") return <QnaDetail id={view.id} cached={view.cached} onBack={back} />;
  if (view.kind === "board-detail") return <BoardDetail id={view.id} onBack={back} />;
  if (view.kind === "materials-detail") return <MaterialsDetail id={view.id} onBack={back} />;
  if (view.kind === "counsel-form") return <CounselForm onBack={back} onSuccess={back} />;
  if (view.kind === "counsel-detail") return <CounselDetail id={view.id} cached={view.cached} onBack={back} />;

  // ─── Tab view ───
  return (
    <StudentPageShell title="커뮤니티">
      <MyActivitySummary />
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} />
      <div className="community-tab-panel">
        {tab === "notice" && (
          <NoticeTab onDetail={(id) => setView({ kind: "notice-detail", id })} />
        )}
        {tab === "board" && (
          <BoardTab onDetail={(id) => setView({ kind: "board-detail", id })} />
        )}
        {tab === "materials" && (
          <MaterialsTab onDetail={(id) => setView({ kind: "materials-detail", id })} />
        )}
        {tab === "qna" && (
          <QnaTab
            onForm={() => setView({ kind: "qna-form" })}
            onDetail={(id, cached) => setView({ kind: "qna-detail", id, cached })}
          />
        )}
        {tab === "counsel" && (
          <CounselTab
            onForm={() => setView({ kind: "counsel-form" })}
            onDetail={(id, cached) => setView({ kind: "counsel-detail", id, cached })}
          />
        )}
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Notice Tab (공지사항)
// ═══════════════════════════════════════════
function NoticeTab({ onDetail }: { onDetail: (id: number) => void }) {
  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ["student", "notice", "posts"],
    queryFn: () => fetchNoticePosts(),
  });

  if (isLoading) return <SkeletonList />;
  if (isError) return <EmptyState title="공지사항을 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />;
  if (posts.length === 0) {
    return <EmptyState title="등록된 공지사항이 없습니다" description="공지사항이 등록되면 여기에 표시됩니다." />;
  }

  return (
    <PostList>
      {posts.map((p) => {
        const lecture = getScopeLabel(p);
        return (
          <PostRow
            key={p.id}
            post={p}
            onClick={() => onDetail(p.id)}
            subtitle={lecture || undefined}
          />
        );
      })}
    </PostList>
  );
}

function NoticeDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ["student", "notice", "post", id],
    queryFn: () => fetchPostDetail(id),
    enabled: Number.isFinite(id),
  });

  if (isLoading) return <StudentPageShell title="공지사항" onBack={onBack}><Loading /></StudentPageShell>;
  if (!post) return <StudentPageShell title="공지사항" onBack={onBack}><EmptyState title="공지사항을 찾을 수 없습니다" /></StudentPageShell>;

  const node = post.mappings?.[0]?.node_detail;
  const scopeVariant = node?.session_title ? "session" : node?.lecture_title ? "primary" : "default";

  return (
    <StudentPageShell title="공지사항" onBack={onBack}>
      <div className="stu-section stu-section--nested community-detail-card">
        <div>
          <h1 className="community-detail-title">{post.title}</h1>
          <div className="community-meta-row">
            <Tag variant={scopeVariant}>{getScopeLabel(post)}</Tag>
            <span className="stu-muted community-meta-text">{formatYmd(post.created_at)}</span>
            {post.created_by_display && <span className="stu-muted community-meta-text">· {post.created_by_display}</span>}
          </div>
        </div>
        <div className="community-content-divider">
          <HtmlContent html={post.content} />
        </div>
        <AttachmentList postId={post.id} attachments={post.attachments} />
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// QnA Tab
// ═══════════════════════════════════════════
function QnaTab({
  onForm,
  onDetail,
}: {
  onForm: () => void;
  onDetail: (id: number, cached?: PostEntity) => void;
}) {
  const [filter, setFilter] = useState<QnaFilter>("all");

  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["student", "qna", "questions"],
    queryFn: () => fetchMyQuestions(profile!.id),
    enabled: profile?.id != null,
  });

  const pending = useMemo(() => questions.filter((q) => !isAnswered(q)), [questions]);
  const resolved = useMemo(() => questions.filter(isAnswered), [questions]);
  const filtered = filter === "pending" ? pending : filter === "resolved" ? resolved : questions;

  return (
    <div className="community-stack">
      {!profile?.isParentReadOnly && (
        <button
          type="button"
          className="stu-btn stu-btn--primary community-primary-action"
          onClick={onForm}
        >
          <IconPlus className="community-icon-sm" />
          질문하기
        </button>
      )}

      <SegmentedTabs
        items={[
          { key: "all" as const, label: "전체", count: questions.length },
          { key: "pending" as const, label: "답변 대기", count: pending.length },
          { key: "resolved" as const, label: "답변 완료", count: resolved.length },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {isLoading || !profile ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter !== "all" ? "해당하는 질문이 없습니다" : "작성한 질문이 없습니다"}
          description={filter !== "all" ? "다른 필터를 선택해 보세요." : "질문하기 버튼을 눌러 선생님께 질문을 보내보세요."}
        />
      ) : (
        <PostList>
          {filtered.map((q) => (
            <PostRow key={q.id} post={q} onClick={() => onDetail(q.id, q)} right={<StatusChip answered={isAnswered(q)} />} />
          ))}
        </PostList>
      )}
    </div>
  );
}

// ─── QnA Detail ───
function QnaDetail({ id, cached, onBack }: { id: number; cached?: PostEntity; onBack: () => void }) {
  const { data: fetched, isLoading } = useQuery({
    queryKey: ["student", "qna", "question", id],
    queryFn: () => fetchQuestionDetail(id),
    initialData: cached,
  });
  const question = fetched ?? cached;

  if (isLoading && !question) {
    return <StudentPageShell title="질문 상세" onBack={onBack}><Loading /></StudentPageShell>;
  }
  if (!question) {
    return (
      <StudentPageShell title="질문 상세" onBack={onBack}>
        <EmptyState title="질문을 찾을 수 없습니다" />
      </StudentPageShell>
    );
  }

  return <QnaDetailContent question={question} onBack={onBack} />;
}

function QnaDetailContent({ question, onBack }: { question: PostEntity; onBack: () => void }) {
  const answered = isAnswered(question);
  const markSeen = useMarkNotificationsSeen();
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", question.id],
    queryFn: () => fetchReplies(question.id),
    enabled: answered,
  });

  useEffect(() => {
    if (answered) markSeen([{ type: "qna", id: question.id }]);
  }, [answered, question.id, markSeen]);

  return (
    <StudentPageShell title="질문 상세" onBack={onBack}>
      <div className="community-stack community-stack--loose">
        {/* 질문 */}
        <div className="stu-section stu-section--nested">
          <div className="community-question-head">
            <div className="community-question-title">{question.title}</div>
            <StatusChip answered={answered} />
          </div>
          <div className="stu-muted community-meta-row community-meta-row--compact">
            <span>{formatYmd(question.created_at)}</span>
            {question.author_role === "parent" && <ParentAuthorBadge />}
          </div>
          <HtmlContent html={question.content} />
          <AttachmentList postId={question.id} attachments={question.attachments} />
        </div>

        {/* 답변 */}
        <div className="stu-section stu-section--nested">
          {answered ? (
            <>
              <div className="community-answer-title">
                선생님 답변{replies.length > 0 && ` (${replies.length}개)`}
              </div>
              {isLoading ? (
                <Loading />
              ) : replies.length > 0 ? (
                <div className="community-answer-list">
                  {replies.map((r) => (
                    <div
                      key={r.id}
                      className="stu-panel community-answer-card"
                    >
                      <HtmlContent html={r.content} />
                      <div className="stu-muted community-answer-date">{formatYmd(r.created_at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stu-muted community-muted-center">
                  답변이 등록되었습니다.
                </div>
              )}
            </>
          ) : (
            <div className="stu-muted community-muted-center">
              아직 답변이 등록되지 않았습니다.<br />선생님이 확인 후 답변해 주실 거예요.
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}

// ─── QnA Form ───
const QNA_DRAFT_KEY = "student.community.qna.draft";

function QnaForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  // sessionStorage draft: 탭 전환·뒤로가기로 unmount되어도 입력 보존.
  const initialDraft = (() => {
    try {
      const raw = sessionStorage.getItem(QNA_DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const [title, setTitle] = useState<string>(initialDraft?.title ?? "");
  const [content, setContent] = useState<string>(initialDraft?.content ?? "");
  const [files, setFiles] = useState<File[]>([]); // 파일 객체는 직렬화 불가 — 보존 안 함
  const [categoryLabel, setCategoryLabel] = useState<string>(initialDraft?.categoryLabel ?? "");

  // 입력 변경 시 draft 갱신
  useEffect(() => {
    try {
      sessionStorage.setItem(QNA_DRAFT_KEY, JSON.stringify({ title, content, categoryLabel }));
    } catch { /* quota exceeded */ }
  }, [title, content, categoryLabel]);

  const { data: profile } = useQuery({ queryKey: ["student", "me"], queryFn: fetchMyProfile });
  const { data: videoMe } = useQuery({ queryKey: ["student", "video", "me"], queryFn: fetchVideoMe, staleTime: 60_000 });
  const lectureOptions = useMemo(() => (videoMe?.lectures ?? []).map((l) => l.title), [videoMe]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("로그인 정보를 불러오는 중입니다.");
      const post = await submitQuestion(title.trim(), content.trim(), profile.id, categoryLabel || null);
      if (files.length > 0) {
        try {
          await uploadPostAttachments(post.id, files);
        } catch {
          // 게시글은 생성됨 — 첨부파일만 실패. 목록 갱신 후 사용자에게 알림.
          qc.invalidateQueries({ queryKey: ["student", "qna", "questions"] });
          const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
          studentToast.info("질문은 등록되었으나 첨부파일 업로드에 실패했습니다.");
          onSuccess();
          return post;
        }
      }
      return post;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["student", "qna", "questions"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
      studentToast.success("질문이 등록되었습니다.");
      // 등록 성공 시 draft 비움
      try { sessionStorage.removeItem(QNA_DRAFT_KEY); } catch { /* noop */ }
      onSuccess();
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "profile_required") qc.invalidateQueries({ queryKey: ["student", "me"] });
    },
  });

  const errorMsg = mutation.error
    ? ((e: unknown) => {
        const ax = e as { response?: { data?: { detail?: string } }; message?: string };
        return ax?.response?.data?.detail ?? (e instanceof Error ? e.message : "전송에 실패했습니다.");
      })(mutation.error)
    : null;

  const contentText = content.replace(/<[^>]*>/g, "").trim();
  const canSubmit = title.trim().length > 0 && contentText.length > 0 && profile?.id != null;

  if (profile?.isParentReadOnly) {
    return (
      <StudentPageShell title="질문 보내기" onBack={onBack}>
        <EmptyState title="학부모 계정은 질문 작성이 제한됩니다" description="학생 계정으로 로그인하면 질문을 등록할 수 있습니다." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      title="질문 보내기"
      description="궁금한 점을 적어 보내면 선생님이 확인해 주세요."
      onBack={onBack}
    >
      <div className="stu-section stu-section--nested community-form-card">
        {errorMsg && (
          <div role="alert" className="community-alert">
            {errorMsg}
          </div>
        )}
        <label className="community-field">
          <span className="community-label">
            제목 <span className="community-required" aria-hidden>*</span>
          </span>
          <input type="text" placeholder="질문 제목" value={title} onChange={(e) => setTitle(e.target.value)} className="stu-input community-input-full" required />
        </label>
        {lectureOptions.length > 0 && (
          <label className="community-field">
            <span className="community-label">강의 (선택)</span>
            <select value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} className="stu-input community-input-full">
              <option value="">선택 안 함</option>
              {lectureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <div className="community-field community-field--grow">
          <span className="community-label">
            내용 <span className="community-required" aria-hidden>*</span>
          </span>
          <RichTextEditor value={content} onChange={setContent} placeholder="질문 내용을 적어 주세요." minHeight={200} compact />
        </div>
        <FilePickerSection files={files} onChange={setFiles} />
        <button
          type="button"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => { if (canSubmit && !mutation.isPending) mutation.mutate(); }}
          className="stu-btn stu-btn--primary community-submit"
        >
          {mutation.isPending ? "보내는 중…" : "질문 보내기"}
        </button>
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Board Tab
// ═══════════════════════════════════════════
function BoardTab({ onDetail }: { onDetail: (id: number) => void }) {
  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ["student", "board", "posts"],
    queryFn: () => fetchBoardPosts(),
  });

  if (isLoading) return <SkeletonList />;
  if (isError) return <EmptyState title="게시물을 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />;
  if (posts.length === 0) {
    return <EmptyState title="등록된 게시물이 없습니다" description="선생님이 게시물을 등록하면 여기에 표시됩니다." />;
  }

  return (
    <PostList>
      {posts.map((p) => {
        const lecture = getScopeLabel(p);
        return (
          <PostRow
            key={p.id}
            post={p}
            onClick={() => onDetail(p.id)}
            subtitle={[lecture, p.created_by_display].filter(Boolean).join(" · ")}
          />
        );
      })}
    </PostList>
  );
}

function BoardDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ["student", "board", "post", id],
    queryFn: () => fetchPostDetail(id),
    enabled: Number.isFinite(id),
  });

  if (isLoading) return <StudentPageShell title="게시물" onBack={onBack}><Loading /></StudentPageShell>;
  if (!post) return <StudentPageShell title="게시물" onBack={onBack}><EmptyState title="게시물을 찾을 수 없습니다" /></StudentPageShell>;

  const node = post.mappings?.[0]?.node_detail;
  const scopeVariant = node?.session_title ? "session" as const : node?.lecture_title ? "primary" as const : "default" as const;

  return (
    <StudentPageShell title="게시물" onBack={onBack}>
      <div className="stu-section stu-section--nested community-detail-card">
        <div>
          <h1 className="community-detail-title">{post.title}</h1>
          <div className="community-meta-row">
            <Tag variant={scopeVariant}>{getScopeLabel(post)}</Tag>
            <span className="stu-muted community-meta-text">{formatYmd(post.created_at)}</span>
            {post.created_by_display && <span className="stu-muted community-meta-text">· {post.created_by_display}</span>}
          </div>
        </div>
        <div className="community-content-divider">
          <HtmlContent html={post.content} />
        </div>
        <AttachmentList postId={post.id} attachments={post.attachments} />
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Counsel Tab (상담 신청)
// ═══════════════════════════════════════════
function CounselTab({
  onForm,
  onDetail,
}: {
  onForm: () => void;
  onDetail: (id: number, cached?: PostEntity) => void;
}) {
  const [filter, setFilter] = useState<QnaFilter>("all");

  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["student", "counsel", "requests"],
    queryFn: () => fetchMyCounselRequests(profile!.id),
    enabled: profile?.id != null,
  });

  const pending = useMemo(() => requests.filter((q) => !isAnswered(q)), [requests]);
  const resolved = useMemo(() => requests.filter(isAnswered), [requests]);
  const filtered = filter === "pending" ? pending : filter === "resolved" ? resolved : requests;

  return (
    <div className="community-stack">
      {!profile?.isParentReadOnly && (
        <button
          type="button"
          className="stu-btn stu-btn--primary community-primary-action"
          onClick={onForm}
        >
          <IconPlus className="community-icon-sm" />
          상담 신청하기
        </button>
      )}

      <SegmentedTabs
        items={[
          { key: "all" as const, label: "전체", count: requests.length },
          { key: "pending" as const, label: "답변 대기", count: pending.length },
          { key: "resolved" as const, label: "답변 완료", count: resolved.length },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {isLoading || !profile ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter !== "all" ? "해당하는 상담 신청이 없습니다" : "상담 신청 내역이 없습니다"}
          description={filter !== "all" ? "다른 필터를 선택해 보세요." : "상담 신청하기 버튼을 눌러 선생님께 상담을 요청해 보세요."}
        />
      ) : (
        <PostList>
          {filtered.map((q) => (
            <PostRow key={q.id} post={q} onClick={() => onDetail(q.id, q)} right={<StatusChip answered={isAnswered(q)} />} />
          ))}
        </PostList>
      )}
    </div>
  );
}

// ─── Counsel Detail ───
function CounselDetail({ id, cached, onBack }: { id: number; cached?: PostEntity; onBack: () => void }) {
  const { data: fetched, isLoading } = useQuery({
    queryKey: ["student", "counsel", "request", id],
    queryFn: () => fetchPostDetail(id),
    initialData: cached,
  });
  const request = fetched ?? cached;

  if (isLoading && !request) {
    return <StudentPageShell title="상담 신청 상세" onBack={onBack}><Loading /></StudentPageShell>;
  }
  if (!request) {
    return (
      <StudentPageShell title="상담 신청 상세" onBack={onBack}>
        <EmptyState title="상담 신청을 찾을 수 없습니다" />
      </StudentPageShell>
    );
  }

  return <CounselDetailContent request={request} onBack={onBack} />;
}

function CounselDetailContent({ request, onBack }: { request: PostEntity; onBack: () => void }) {
  const answered = isAnswered(request);
  const markSeen = useMarkNotificationsSeen();
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["student", "counsel", "replies", request.id],
    queryFn: () => fetchReplies(request.id),
    enabled: answered,
  });

  useEffect(() => {
    if (answered) markSeen([{ type: "counsel", id: request.id }]);
  }, [answered, request.id, markSeen]);

  return (
    <StudentPageShell title="상담 신청 상세" onBack={onBack}>
      <div className="community-stack community-stack--loose">
        {/* 상담 신청 내용 */}
        <div className="stu-section stu-section--nested">
          <div className="community-question-head">
            <div className="community-question-title">{request.title}</div>
            <StatusChip answered={answered} />
          </div>
          <div className="stu-muted community-meta-row community-meta-row--compact">
            <span>{formatYmd(request.created_at)}</span>
            {request.author_role === "parent" && <ParentAuthorBadge />}
          </div>
          <HtmlContent html={request.content} />
          <AttachmentList postId={request.id} attachments={request.attachments} />
        </div>

        {/* 관리자 답변 */}
        <div className="stu-section stu-section--nested">
          {answered ? (
            <>
              <div className="community-answer-title">
                선생님 답변{replies.length > 0 && ` (${replies.length}개)`}
              </div>
              {isLoading ? (
                <Loading />
              ) : replies.length > 0 ? (
                <div className="community-answer-list">
                  {replies.map((r) => (
                    <div
                      key={r.id}
                      className="stu-panel community-answer-card"
                    >
                      <HtmlContent html={r.content} />
                      <div className="stu-muted community-answer-date">{formatYmd(r.created_at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stu-muted community-muted-center">
                  답변이 등록되었습니다.
                </div>
              )}
            </>
          ) : (
            <div className="stu-muted community-muted-center">
              아직 답변이 등록되지 않았습니다.<br />선생님이 확인 후 답변해 주실 거예요.
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}

// ─── Counsel Form ───
function CounselForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [categoryLabel, setCategoryLabel] = useState("");

  const { data: profile } = useQuery({ queryKey: ["student", "me"], queryFn: fetchMyProfile });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("로그인 정보를 불러오는 중입니다.");
      const post = await submitCounselRequest(title.trim(), content.trim(), profile.id, categoryLabel || null);
      if (files.length > 0) {
        try {
          await uploadPostAttachments(post.id, files);
        } catch {
          qc.invalidateQueries({ queryKey: ["student", "counsel", "requests"] });
          const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
          studentToast.info("상담 요청은 등록되었으나 첨부파일 업로드에 실패했습니다.");
          onSuccess();
          return post;
        }
      }
      return post;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["student", "counsel", "requests"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
      studentToast.success("상담 요청이 등록되었습니다.");
      onSuccess();
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "profile_required") qc.invalidateQueries({ queryKey: ["student", "me"] });
    },
  });

  const errorMsg = mutation.error
    ? ((e: unknown) => {
        const ax = e as { response?: { data?: { detail?: string } }; message?: string };
        return ax?.response?.data?.detail ?? (e instanceof Error ? e.message : "전송에 실패했습니다.");
      })(mutation.error)
    : null;

  const counselContentText = content.replace(/<[^>]*>/g, "").trim();
  const canSubmit = title.trim().length > 0 && counselContentText.length > 0 && profile?.id != null;

  if (profile?.isParentReadOnly) {
    return (
      <StudentPageShell title="상담 신청" onBack={onBack}>
        <EmptyState title="학부모 계정은 상담 작성이 제한됩니다" description="학생 계정으로 로그인하면 상담을 신청할 수 있습니다." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      title="상담 신청"
      description="상담받고 싶은 내용을 적어 보내면 선생님이 확인해 드립니다."
      onBack={onBack}
    >
      <div className="stu-section stu-section--nested community-form-card">
        {errorMsg && (
          <div role="alert" className="community-alert">
            {errorMsg}
          </div>
        )}
        <label className="community-field">
          <span className="community-label">
            상담 제목 <span className="community-required" aria-hidden>*</span>
          </span>
          <input type="text" placeholder="예: 진로 상담, 학습 방법 상담" value={title} onChange={(e) => setTitle(e.target.value)} className="stu-input community-input-full" required />
        </label>
        <label className="community-field">
          <span className="community-label">상담 분야 (선택)</span>
          <select value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} className="stu-input community-input-full">
            <option value="">선택 안 함</option>
            {COUNSEL_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className="community-field community-field--grow">
          <span className="community-label">
            상담 내용 <span className="community-required" aria-hidden>*</span>
          </span>
          <RichTextEditor value={content} onChange={setContent} placeholder="상담받고 싶은 내용을 자세히 적어 주세요." minHeight={200} compact />
        </div>
        <FilePickerSection files={files} onChange={setFiles} />
        <button
          type="button"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => { if (canSubmit && !mutation.isPending) mutation.mutate(); }}
          className="stu-btn stu-btn--primary community-submit"
        >
          {mutation.isPending ? "신청 중…" : "상담 신청하기"}
        </button>
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Materials Tab (자료실)
// ═══════════════════════════════════════════
function MaterialsTab({ onDetail }: { onDetail: (id: number) => void }) {
  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ["student", "materials", "posts"],
    queryFn: () => fetchMaterialsPosts(),
  });

  if (isLoading) return <SkeletonList />;
  if (isError) return <EmptyState title="자료를 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />;
  if (posts.length === 0) {
    return <EmptyState title="등록된 자료가 없습니다" description="선생님이 자료를 등록하면 여기에서 확인할 수 있습니다." />;
  }

  return (
    <PostList>
      {posts.map((p) => {
        const lecture = getScopeLabel(p);
        return (
          <PostRow
            key={p.id}
            post={p}
            onClick={() => onDetail(p.id)}
            subtitle={lecture || undefined}
          />
        );
      })}
    </PostList>
  );
}

function MaterialsDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ["student", "materials", "post", id],
    queryFn: () => fetchPostDetail(id),
    enabled: Number.isFinite(id),
  });

  if (isLoading) return <StudentPageShell title="자료실" onBack={onBack}><Loading /></StudentPageShell>;
  if (!post) return <StudentPageShell title="자료실" onBack={onBack}><EmptyState title="자료를 찾을 수 없습니다" /></StudentPageShell>;

  const node = post.mappings?.[0]?.node_detail;
  const scopeVariant = node?.session_title ? "session" as const : node?.lecture_title ? "primary" as const : "default" as const;

  return (
    <StudentPageShell title="자료실" onBack={onBack}>
      <div className="stu-section stu-section--nested community-detail-card">
        <div>
          <h1 className="community-detail-title">{post.title}</h1>
          <div className="community-meta-row">
            <Tag variant={scopeVariant}>{getScopeLabel(post)}</Tag>
            <span className="stu-muted community-meta-text">{formatYmd(post.created_at)}</span>
            {post.created_by_display && <span className="stu-muted community-meta-text">· {post.created_by_display}</span>}
          </div>
        </div>
        <div className="community-content-divider">
          <HtmlContent html={post.content} />
        </div>
        <AttachmentList postId={post.id} attachments={post.attachments} />
        <p className="community-materials-note">
          💡 자료실은 다운로드 전용입니다. 질문은 QnA 탭에서 등록해 주세요.
        </p>
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Attachments — display + download
// ═══════════════════════════════════════════
function AttachmentList({ postId, attachments }: { postId: number; attachments?: PostAttachment[] }) {
  const isImage = (ct: string) => ct.startsWith("image/");

  // 이미지 URL 캐시 — 병렬 fetch (이전: 직렬 for…of, N round-trip)
  const [imgUrls, setImgUrls] = useState<Record<number, string>>({});
  // lightbox: 전체화면 이미지 뷰어
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  useEffect(() => {
    if (lightboxId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxId(null);
    };
    window.addEventListener("keydown", onKey);
    // body scroll lock
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightboxId]);
  useEffect(() => {
    if (!attachments || attachments.length === 0) return;
    const images = attachments.filter((a) => isImage(a.content_type));
    if (images.length === 0) return;
    let cancelled = false;
    (async () => {
      const settled = await Promise.allSettled(
        images.map((img) =>
          getAttachmentDownloadUrl(postId, img.id).then((res) => ({ id: img.id, url: res.url }))
        )
      );
      if (cancelled) return;
      const urls: Record<number, string> = {};
      for (const r of settled) {
        if (r.status === "fulfilled") urls[r.value.id] = r.value.url;
      }
      setImgUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [attachments, postId]);

  if (!attachments || attachments.length === 0) return null;

  const handleDownload = async (att: PostAttachment) => {
    try {
      const { url } = await getAttachmentDownloadUrl(postId, att.id);
      const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
      downloadPresignedUrl(url, att.original_name);
    } catch {
      const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
      studentToast.error("파일을 다운로드하지 못했습니다.");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="community-attachments">
      {/* 이미지 미리보기 — 클릭 시 lightbox */}
      {attachments.filter((a) => isImage(a.content_type)).map((att) => (
        <button
          key={`img-${att.id}`}
          type="button"
          onClick={() => imgUrls[att.id] && setLightboxId(att.id)}
          className={`community-image-preview${imgUrls[att.id] ? " community-image-preview--loaded" : ""}`}
          aria-label={`${att.original_name} 크게 보기`}
        >
          {imgUrls[att.id] ? (
            <img src={imgUrls[att.id]} alt={att.original_name} className="community-image" />
          ) : (
            <div className="community-image-placeholder">이미지 로딩 중…</div>
          )}
        </button>
      ))}

      {/* Lightbox 모달 */}
      {lightboxId != null && imgUrls[lightboxId] && (
        <div
          onClick={() => setLightboxId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          className="community-lightbox"
        >
          <img
            src={imgUrls[lightboxId]}
            alt={attachments.find((a) => a.id === lightboxId)?.original_name ?? ""}
            onClick={(e) => e.stopPropagation()}
            className="community-lightbox__image"
          />
          <button
            type="button"
            onClick={() => setLightboxId(null)}
            aria-label="닫기"
            className="community-lightbox__close"
          >
            ✕
          </button>
        </div>
      )}

      {/* 파일 목록 */}
      {attachments.filter((a) => !isImage(a.content_type)).length > 0 && (
        <div className="community-file-heading">
          첨부파일 ({attachments.filter((a) => !isImage(a.content_type)).length})
        </div>
      )}
      {attachments.filter((a) => !isImage(a.content_type)).map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => handleDownload(att)}
          className="stu-panel stu-panel--pressable community-file-button"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="community-file-icon">
            <path d="M10 1H4.5A1.5 1.5 0 003 2.5v13A1.5 1.5 0 004.5 17h9a1.5 1.5 0 001.5-1.5V6L10 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 1v5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="community-file-body">
            <div className="community-file-name">
              {att.original_name}
            </div>
            <div className="stu-muted community-file-size">{formatSize(att.size_bytes)}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="community-file-download-icon">
            <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// FilePickerSection — file picker for forms
// ═══════════════════════════════════════════
// 백엔드 SSOT: backend/.../community/_common.py MAX_ATTACHMENT_SIZE / MAX_ATTACHMENTS_PER_POST
const MAX_FILE_SIZE_MB = 50;
const MAX_FILES = 10;

function FilePickerSection({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const warnTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (warnTimerRef.current != null) window.clearTimeout(warnTimerRef.current);
  }, []);

  const showWarn = (msg: string) => {
    setWarn(msg);
    if (warnTimerRef.current != null) window.clearTimeout(warnTimerRef.current);
    warnTimerRef.current = window.setTimeout(() => {
      setWarn(null);
      warnTimerRef.current = null;
    }, 4000);
  };

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;
    const incoming = Array.from(newFiles);
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    const valid = incoming.filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);
    const merged = [...files, ...valid].slice(0, MAX_FILES);
    onChange(merged);
    if (oversized.length > 0) {
      showWarn(`${MAX_FILE_SIZE_MB}MB를 초과한 파일은 제외했어요 (${oversized.length}개)`);
    } else if ([...files, ...incoming].length > MAX_FILES) {
      showWarn(`첨부는 최대 ${MAX_FILES}개까지 가능해요`);
    }
    e.target.value = "";
  };

  const handleRemove = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="community-file-picker">
      <div className="community-file-picker__head">
        <div className="community-file-picker__copy">
          <span className="community-file-picker__title">
            첨부파일 {files.length > 0 && `(${files.length}/${MAX_FILES})`}
          </span>
          <span className="community-file-picker__hint">
            최대 {MAX_FILES}개 · 파일당 {MAX_FILE_SIZE_MB}MB 이하
          </span>
        </div>
        <button
          type="button"
          className="stu-btn stu-btn--ghost stu-btn--sm"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_FILES}
        >
          + 파일 추가
        </button>
        <input
          ref={(el) => { inputRef.current = el; }}
          type="file"
          multiple
          className="community-file-picker__input"
          onChange={handleAdd}
        />
      </div>
      {warn && (
        <div role="alert" className="community-file-picker__warn">
          {warn}
        </div>
      )}
      {files.length > 0 && (
        <div className="community-file-list">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="community-file-item"
            >
              <span className="community-file-item__name">
                {f.name}
              </span>
              <span className="stu-muted community-file-item__size">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                aria-label={`${f.name} 제거`}
                className="community-file-remove"
                title="제거"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// HtmlContent — renders HTML content (from RichTextEditor) safely
// ═══════════════════════════════════════════
function HtmlContent({ html }: { html: string }) {
  if (!html) return <div className="stu-muted community-empty-content">내용이 없습니다.</div>;

  const isPlainText = !/<[a-z][\s\S]*>/i.test(html);
  if (isPlainText) {
    return <div className="community-plain-content">{html}</div>;
  }

  return (
    <div
      className="stu-html-content community-html-content"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

// ═══════════════════════════════════════════
// Scope label helper (SSOT — canonical scope label for student app)
// ═══════════════════════════════════════════
function getScopeLabel(post: { mappings?: Array<{ node_detail?: { session_title?: string | null; lecture_title?: string | null } | null }> }): string {
  const nd = post.mappings?.[0]?.node_detail;
  if (!nd) return "전체";
  if (nd.session_title) return nd.session_title;
  if (nd.lecture_title) return nd.lecture_title;
  return "전체";
}

// ═══════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════
function PostList({ children }: { children: React.ReactNode }) {
  return <div className="community-post-list">{children}</div>;
}

function PostRow({
  post,
  onClick,
  right,
  subtitle,
}: {
  post: PostEntity;
  onClick: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  // 본문 미리보기 (HTML 태그 제거, 80자 제한)
  const preview = useMemo(() => {
    if (!post.content) return "";
    const text = post.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    return text.length > 80 ? text.slice(0, 80) + "…" : text;
  }, [post.content]);
  const rowClass = [
    "stu-panel",
    "stu-panel--pressable",
    "community-post-row",
    post.is_urgent ? "community-post-row--urgent" : "",
    !post.is_urgent && post.is_pinned ? "community-post-row--pinned" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={rowClass}
      onClick={onClick}
    >
      <div className="community-post-body">
        {/* 제목 행 */}
        <div className={`community-post-title-row${preview ? " community-post-title-row--with-preview" : ""}`}>
          {post.is_urgent && (
            <span className="community-post-badge community-post-badge--urgent">긴급</span>
          )}
          {post.is_pinned && !post.is_urgent && (
            <span className="community-post-badge community-post-badge--pinned">고정</span>
          )}
          <span className="community-post-title-text">{post.title}</span>
        </div>
        {/* 본문 미리보기 */}
        {preview && (
          <div className="community-post-preview">
            {preview}
          </div>
        )}
        {/* 메타 행 */}
        <div className="community-post-meta">
          <span className="community-post-date">
            {formatYmd(post.created_at)}
          </span>
          {subtitle && (
            <span className="community-post-scope">
              {subtitle}
            </span>
          )}
          {isAnswered(post) && post.replies_count != null && post.replies_count > 0 && (
            <span className="community-post-replies">
              답변 {post.replies_count}개
            </span>
          )}
          {(post.attachments?.length ?? 0) > 0 && (
            <span className="community-post-attachment">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M12 7.17l-4.59 4.59a3.25 3.25 0 01-4.6-4.6l5.3-5.3a2.17 2.17 0 013.06 3.07l-5.3 5.3a1.08 1.08 0 01-1.53-1.53l4.59-4.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {post.attachments!.length}
            </span>
          )}
        </div>
      </div>
      {right}
      <IconChevronRight className="community-icon-chevron" />
    </button>
  );
}

function Tag({ children, variant }: { children: React.ReactNode; variant?: "default" | "primary" | "session" }) {
  const v = variant ?? "default";
  return (
    <span className={`community-tag community-tag--${v}`}>
      {children}
    </span>
  );
}

function Loading() {
  return <div className="stu-muted community-loading">불러오는 중…</div>;
}

function SkeletonList() {
  return (
    <div className="community-skeleton-list">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`stu-skel community-skeleton-item community-skeleton-item--${i}`} />
      ))}
    </div>
  );
}
