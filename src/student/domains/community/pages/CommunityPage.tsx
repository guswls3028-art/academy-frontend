/**
 * PATH: src/student/domains/community/pages/CommunityPage.tsx
 * 학생 커뮤니티 — QnA | 게시판 | 자료실
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";
import { IconPlus, IconChevronRight } from "@/student/shared/ui/icons/Icons";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import DOMPurify from "dompurify";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { fetchVideoMe } from "@/student/domains/video/api/video";
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

// ─── Types ───
type Tab = "notice" | "board" | "materials" | "qna" | "counsel";
type QnaFilter = "all" | "pending" | "resolved";
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
  { key: "counsel", label: "상담 신청" },
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
    <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--stu-surface-soft)", borderRadius: 10 }}>
      {items.map(({ key, label, count }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              flex: 1,
              padding: "8px 6px",
              border: "none",
              borderRadius: 7,
              background: active ? "var(--stu-surface)" : "transparent",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--stu-text)" : "var(--stu-text-muted)",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
              cursor: "pointer",
              transition: "all var(--stu-motion-fast)",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span>{label}</span>
            {count != null && count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: active ? "var(--stu-primary)" : "rgba(17,17,17,0.1)",
                  color: active ? "#fff" : "var(--stu-text-muted)",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
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

// ─── Status chip ───
function StatusChip({ answered }: { answered: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: answered ? "var(--stu-success-bg)" : "var(--stu-surface-soft)",
        color: answered ? "var(--stu-success-text)" : "var(--stu-text-muted)",
      }}
    >
      {answered ? "답변 완료" : "답변 대기"}
    </span>
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

  // 알림에서 질문 상세 직접 진입
  useEffect(() => {
    const openId = (location.state as { openQuestionId?: number } | null)?.openQuestionId;
    if (openId != null) {
      setTab("qna");
      setView({ kind: "qna-detail", id: openId });
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
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} />
      <div style={{ marginTop: "var(--stu-space-5)" }}>
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
        const lecture = p.mappings?.[0]?.node_detail?.lecture_title;
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

  return (
    <StudentPageShell title="공지사항" onBack={onBack}>
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: "var(--stu-space-3)" }}>{post.title}</h1>
          <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
            {node?.lecture_title && <Tag>{node.lecture_title}</Tag>}
            <span className="stu-muted" style={{ fontSize: 13 }}>{formatYmd(post.created_at)}</span>
          </div>
        </div>
        <HtmlContent html={post.content} />
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-5)" }}>
      {!profile?.isParentReadOnly && (
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          onClick={onForm}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--stu-space-2)" }}
        >
          <IconPlus style={{ width: 18, height: 18 }} />
          질문하기
        </button>
      )}

      <SegmentedTabs
        items={[
          { key: "all" as const, label: "전체", count: questions.length },
          { key: "pending" as const, label: "답변 필요", count: pending.length },
          { key: "resolved" as const, label: "해결됨", count: resolved.length },
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
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", question.id],
    queryFn: () => fetchReplies(question.id),
    enabled: answered,
  });

  return (
    <StudentPageShell title="질문 상세" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 질문 */}
        <div className="stu-section stu-section--nested">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--stu-space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0 }}>{question.title}</div>
            <StatusChip answered={answered} />
          </div>
          <div className="stu-muted" style={{ fontSize: 12, marginBottom: "var(--stu-space-4)" }}>
            {formatYmd(question.created_at)}
          </div>
          <HtmlContent html={question.content} />
          <AttachmentList postId={question.id} attachments={question.attachments} />
        </div>

        {/* 답변 */}
        <div className="stu-section stu-section--nested">
          {answered ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
                선생님 답변{replies.length > 0 && ` (${replies.length}개)`}
              </div>
              {isLoading ? (
                <Loading />
              ) : replies.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
                  {replies.map((r) => (
                    <div
                      key={r.id}
                      className="stu-panel"
                      style={{ padding: "var(--stu-space-4)", background: "var(--stu-success-bg)", border: "1px solid var(--stu-success)" }}
                    >
                      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.content}</div>
                      <div className="stu-muted" style={{ fontSize: 12, marginTop: "var(--stu-space-2)" }}>{formatYmd(r.created_at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
                  답변이 등록되었습니다.
                </div>
              )}
            </>
          ) : (
            <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
              아직 답변이 등록되지 않았습니다.<br />선생님이 확인 후 답변해 주실 거예요.
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}

// ─── QnA Form ───
function QnaForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [categoryLabel, setCategoryLabel] = useState("");

  const { data: profile } = useQuery({ queryKey: ["student", "me"], queryFn: fetchMyProfile });
  const { data: videoMe } = useQuery({ queryKey: ["student", "video", "me"], queryFn: fetchVideoMe, staleTime: 60_000 });
  const lectureOptions = useMemo(() => (videoMe?.lectures ?? []).map((l) => l.title), [videoMe]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("로그인 정보를 불러오는 중입니다.");
      const post = await submitQuestion(title.trim(), content.trim(), profile.id, categoryLabel || null);
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
      return post;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "qna", "questions"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
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

  return (
    <StudentPageShell title="질문 보내기" description="궁금한 점을 적어 보내면 선생님이 확인해 주세요." onBack={onBack}>
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {errorMsg && (
          <div role="alert" style={{ padding: "var(--stu-space-3)", background: "var(--stu-danger-bg)", border: "1px solid var(--stu-danger-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-danger-text)", fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>제목</span>
          <input type="text" placeholder="질문 제목" value={title} onChange={(e) => setTitle(e.target.value)} className="stu-input" style={{ width: "100%" }} />
        </label>
        {lectureOptions.length > 0 && (
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>카테고리 (선택)</span>
            <select value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} className="stu-input" style={{ width: "100%" }}>
              <option value="">카테고리 없음</option>
              {lectureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)", flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>내용</span>
          <RichTextEditor value={content} onChange={setContent} placeholder="질문 내용을 적어 주세요." minHeight={200} />
        </div>
        <FilePickerSection files={files} onChange={setFiles} />
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => { if (canSubmit && !mutation.isPending) mutation.mutate(); }}
          style={{ alignSelf: "flex-end", minHeight: 44, minWidth: 140 }}
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
        const lecture = p.mappings?.[0]?.node_detail?.lecture_title;
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

  return (
    <StudentPageShell title="게시물" onBack={onBack}>
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: "var(--stu-space-3)" }}>{post.title}</h1>
          <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
            {node?.lecture_title && <Tag>{node.lecture_title}</Tag>}
            <span className="stu-muted" style={{ fontSize: 13 }}>{formatYmd(post.created_at)}</span>
            {post.created_by_display && <span className="stu-muted" style={{ fontSize: 13 }}>· {post.created_by_display}</span>}
          </div>
        </div>
        <HtmlContent html={post.content} />
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-5)" }}>
      {!profile?.isParentReadOnly && (
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          onClick={onForm}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--stu-space-2)" }}
        >
          <IconPlus style={{ width: 18, height: 18 }} />
          상담 신청하기
        </button>
      )}

      <SegmentedTabs
        items={[
          { key: "all" as const, label: "전체", count: requests.length },
          { key: "pending" as const, label: "답변 대기", count: pending.length },
          { key: "resolved" as const, label: "처리됨", count: resolved.length },
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
  const { data: replies = [], isLoading } = useQuery<Answer[]>({
    queryKey: ["student", "counsel", "replies", request.id],
    queryFn: () => fetchReplies(request.id),
    enabled: answered,
  });

  return (
    <StudentPageShell title="상담 신청 상세" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 상담 신청 내용 */}
        <div className="stu-section stu-section--nested">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--stu-space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0 }}>{request.title}</div>
            <StatusChip answered={answered} />
          </div>
          <div className="stu-muted" style={{ fontSize: 12, marginBottom: "var(--stu-space-4)" }}>
            {formatYmd(request.created_at)}
          </div>
          <HtmlContent html={request.content} />
          <AttachmentList postId={request.id} attachments={request.attachments} />
        </div>

        {/* 관리자 답변 */}
        <div className="stu-section stu-section--nested">
          {answered ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
                관리자 답변{replies.length > 0 && ` (${replies.length}개)`}
              </div>
              {isLoading ? (
                <Loading />
              ) : replies.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
                  {replies.map((r) => (
                    <div
                      key={r.id}
                      className="stu-panel"
                      style={{ padding: "var(--stu-space-4)", background: "var(--stu-success-bg)", border: "1px solid var(--stu-success)" }}
                    >
                      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.content}</div>
                      <div className="stu-muted" style={{ fontSize: 12, marginTop: "var(--stu-space-2)" }}>{formatYmd(r.created_at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
                  답변이 등록되었습니다.
                </div>
              )}
            </>
          ) : (
            <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
              아직 답변이 등록되지 않았습니다.<br />관리자가 확인 후 답변해 주실 거예요.
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
  const { data: videoMe } = useQuery({ queryKey: ["student", "video", "me"], queryFn: fetchVideoMe, staleTime: 60_000 });
  const lectureOptions = useMemo(() => (videoMe?.lectures ?? []).map((l) => l.title), [videoMe]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("로그인 정보를 불러오는 중입니다.");
      const post = await submitCounselRequest(title.trim(), content.trim(), profile.id, categoryLabel || null);
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
      return post;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "counsel", "requests"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
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

  return (
    <StudentPageShell title="상담 신청" description="상담받고 싶은 내용을 적어 보내면 관리자가 확인해 드립니다." onBack={onBack}>
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {errorMsg && (
          <div role="alert" style={{ padding: "var(--stu-space-3)", background: "var(--stu-danger-bg)", border: "1px solid var(--stu-danger-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-danger-text)", fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>상담 제목</span>
          <input type="text" placeholder="예: 진로 상담, 학습 방법 상담" value={title} onChange={(e) => setTitle(e.target.value)} className="stu-input" style={{ width: "100%" }} />
        </label>
        {lectureOptions.length > 0 && (
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>카테고리 (선택)</span>
            <select value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} className="stu-input" style={{ width: "100%" }}>
              <option value="">카테고리 없음</option>
              {lectureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)", flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>상담 내용</span>
          <RichTextEditor value={content} onChange={setContent} placeholder="상담받고 싶은 내용을 자세히 적어 주세요." minHeight={200} />
        </div>
        <FilePickerSection files={files} onChange={setFiles} />
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => { if (canSubmit && !mutation.isPending) mutation.mutate(); }}
          style={{ alignSelf: "flex-end", minHeight: 44, minWidth: 140 }}
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
        const lecture = p.mappings?.[0]?.node_detail?.lecture_title;
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

  return (
    <StudentPageShell title="자료실" onBack={onBack}>
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: "var(--stu-space-3)" }}>{post.title}</h1>
          <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
            {node?.lecture_title && <Tag>{node.lecture_title}</Tag>}
            <span className="stu-muted" style={{ fontSize: 13 }}>{formatYmd(post.created_at)}</span>
          </div>
        </div>
        <HtmlContent html={post.content} />
        <AttachmentList postId={post.id} attachments={post.attachments} />
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Attachments — display + download
// ═══════════════════════════════════════════
function AttachmentList({ postId, attachments }: { postId: number; attachments?: PostAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const handleDownload = async (att: PostAttachment) => {
    try {
      const { url } = await getAttachmentDownloadUrl(postId, att.id);
      const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
      downloadPresignedUrl(url, att.original_name);
    } catch {
      // silent fail
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text-muted)" }}>
        첨부파일 ({attachments.length})
      </div>
      {attachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => handleDownload(att)}
          className="stu-panel stu-panel--pressable"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--stu-space-3)",
            padding: "10px var(--stu-space-4)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: "var(--stu-primary)" }}>
            <path d="M10 1H4.5A1.5 1.5 0 003 2.5v13A1.5 1.5 0 004.5 17h9a1.5 1.5 0 001.5-1.5V6L10 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 1v5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {att.original_name}
            </div>
            <div className="stu-muted" style={{ fontSize: 12 }}>{formatSize(att.size_bytes)}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--stu-text-muted)" }}>
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
function FilePickerSection({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = { current: null as HTMLInputElement | null };

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;
    const merged = [...files, ...Array.from(newFiles)].slice(0, 10);
    onChange(merged);
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
          첨부파일 {files.length > 0 && `(${files.length}/10)`}
        </span>
        <button
          type="button"
          className="stu-btn stu-btn--ghost"
          style={{ fontSize: 13, padding: "4px 10px", minHeight: 0 }}
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= 10}
        >
          + 파일 추가
        </button>
        <input
          ref={(el) => { inputRef.current = el; }}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleAdd}
        />
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--stu-space-2)",
                padding: "6px 10px",
                background: "var(--stu-surface-soft)",
                borderRadius: "var(--stu-radius)",
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
              </span>
              <span className="stu-muted" style={{ fontSize: 11, flexShrink: 0 }}>{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--stu-text-muted)",
                  padding: 2,
                  lineHeight: 1,
                  fontSize: 16,
                }}
                title="제거"
              >
                &times;
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
  if (!html) return <div className="stu-muted" style={{ fontSize: 14 }}>내용이 없습니다.</div>;

  const isPlainText = !/<[a-z][\s\S]*>/i.test(html);
  if (isPlainText) {
    return <div style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{html}</div>;
  }

  return (
    <div
      className="stu-html-content"
      style={{ fontSize: 15, lineHeight: 1.7, wordBreak: "break-word" }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

// ═══════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════
function PostList({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>{children}</div>;
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
  return (
    <button
      type="button"
      className="stu-panel stu-panel--pressable"
      onClick={onClick}
      style={{ textAlign: "left", padding: "var(--stu-space-4)", display: "flex", alignItems: "center", gap: "var(--stu-space-3)" }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          {post.is_urgent && (
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--stu-danger, #ef4444)", borderRadius: 4, padding: "1px 6px", lineHeight: 1.5 }}>긴급</span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</span>
        </div>
        <div className="stu-muted" style={{ fontSize: 12 }}>
          {formatYmd(post.created_at)}
          {subtitle && <> · {subtitle}</>}
          {isAnswered(post) && post.replies_count != null && post.replies_count > 0 && <> · 답변 {post.replies_count}개</>}
          {(post.attachments?.length ?? 0) > 0 && (
            <> · <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ display: "inline", verticalAlign: "-1px" }}><path d="M12 7.17l-4.59 4.59a3.25 3.25 0 01-4.6-4.6l5.3-5.3a2.17 2.17 0 013.06 3.07l-5.3 5.3a1.08 1.08 0 01-1.53-1.53l4.59-4.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg> {post.attachments!.length}</>
          )}
        </div>
      </div>
      {right}
      <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="stu-muted" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "var(--stu-surface-soft)" }}>
      {children}
    </span>
  );
}

function Loading() {
  return <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-8)" }}>불러오는 중…</div>;
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map((i) => <div key={i} className="stu-skel" style={{ height: 72, borderRadius: "var(--stu-radius-md)" }} />)}
    </div>
  );
}
