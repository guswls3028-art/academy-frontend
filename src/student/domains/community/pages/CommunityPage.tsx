/**
 * PATH: src/student/domains/community/pages/CommunityPage.tsx
 * 학생 커뮤니티 — 탭 구조: QnA | 게시판 | 자료실
 * features/community와 정합 (동일 API 사용)
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";
import { IconPlus, IconChevronRight, IconFolder, IconDownload } from "@/student/shared/ui/icons/Icons";

import {
  fetchBlockTypes,
  createPost,
  fetchPostReplies,
  type PostEntity,
  type Answer,
  type Material,
} from "@/features/community/api/community.api";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import {
  fetchMyQnaQuestions,
  fetchQnaQuestionDetail,
  hasAnswer,
  isPendingAnswer,
} from "@/student/domains/qna/api/qna.api";
import {
  fetchBoardPosts,
  fetchBoardPostDetail,
  fetchStudentMaterials,
} from "../api/community.api";

// ─── Tab definitions ───
type CommunityTab = "qna" | "board" | "materials";

const TABS: { key: CommunityTab; label: string }[] = [
  { key: "qna", label: "QnA" },
  { key: "board", label: "게시판" },
  { key: "materials", label: "자료실" },
];

// ─── Sub-view routing (QnA detail/form, Board detail) ───
type SubView =
  | { type: "none" }
  | { type: "qna-form" }
  | { type: "qna-detail"; questionId: number; question?: PostEntity }
  | { type: "board-detail"; postId: number };

export default function CommunityPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CommunityTab>("qna");
  const [subView, setSubView] = useState<SubView>({ type: "none" });

  // 알림에서 QnA 질문 상세로 직접 진입
  useEffect(() => {
    const openId = (location.state as { openQuestionId?: number } | null)?.openQuestionId;
    if (openId != null) {
      setActiveTab("qna");
      setSubView({ type: "qna-detail", questionId: openId });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const handleBack = () => setSubView({ type: "none" });

  // ─── Sub-views ───
  if (subView.type === "qna-form") {
    return (
      <QuestionFormPage
        onBack={handleBack}
        onSuccess={handleBack}
      />
    );
  }
  if (subView.type === "qna-detail") {
    return (
      <QuestionDetailRouter
        questionId={subView.questionId}
        question={subView.question}
        onBack={handleBack}
      />
    );
  }
  if (subView.type === "board-detail") {
    return (
      <BoardDetailPage
        postId={subView.postId}
        onBack={handleBack}
      />
    );
  }

  // ─── Main tab view ───
  return (
    <StudentPageShell title="커뮤니티">
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--stu-surface-soft)",
          borderRadius: 10,
          marginBottom: "var(--stu-space-6)",
        }}
      >
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                padding: "8px 6px",
                border: "none",
                borderRadius: 7,
                background: isActive ? "var(--stu-surface)" : "transparent",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--stu-text)" : "var(--stu-text-muted)",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
                cursor: "pointer",
                transition: "all var(--stu-motion-fast)",
                letterSpacing: "-0.01em",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "qna" && (
        <QnaTabContent
          onOpenForm={() => setSubView({ type: "qna-form" })}
          onOpenDetail={(id, q) => setSubView({ type: "qna-detail", questionId: id, question: q })}
        />
      )}
      {activeTab === "board" && (
        <BoardTabContent
          onOpenDetail={(id) => setSubView({ type: "board-detail", postId: id })}
        />
      )}
      {activeTab === "materials" && <MaterialsTabContent />}
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// QnA Tab
// ═══════════════════════════════════════════
type QnaFilter = "all" | "pending" | "resolved";

function QnaTabContent({
  onOpenForm,
  onOpenDetail,
}: {
  onOpenForm: () => void;
  onOpenDetail: (id: number, question?: PostEntity) => void;
}) {
  const [filter, setFilter] = useState<QnaFilter>("all");

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["student", "qna", "questions"],
    queryFn: () => fetchMyQnaQuestions({ pageSize: 50 }),
  });

  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const filtered = useMemo(() => {
    if (filter === "pending") return questions.filter(isPendingAnswer);
    if (filter === "resolved") return questions.filter(hasAnswer);
    return questions;
  }, [questions, filter]);

  const pendingCount = useMemo(() => questions.filter(isPendingAnswer).length, [questions]);
  const resolvedCount = useMemo(() => questions.filter(hasAnswer).length, [questions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-5)" }}>
      {/* 질문하기 버튼 */}
      {!profile?.isParentReadOnly && (
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          onClick={onOpenForm}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--stu-space-2)",
          }}
        >
          <IconPlus style={{ width: 18, height: 18 }} />
          질문하기
        </button>
      )}

      {/* 필터 */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--stu-surface-soft)",
          borderRadius: 8,
        }}
      >
        {([
          { key: "all" as const, label: "전체 질문", count: questions.length },
          { key: "pending" as const, label: "답변 필요", count: pendingCount },
          { key: "resolved" as const, label: "해결됨", count: resolvedCount },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              flex: 1,
              padding: "6px 8px",
              border: "none",
              borderRadius: 6,
              background: filter === key ? "var(--stu-surface)" : "transparent",
              fontSize: 12,
              fontWeight: filter === key ? 600 : 500,
              color: filter === key ? "var(--stu-text)" : "var(--stu-text-muted)",
              boxShadow: filter === key ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
              cursor: "pointer",
            }}
          >
            <span>{label}</span>
            <span style={{ marginLeft: 4, opacity: 0.9 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-8)" }}>
          불러오는 중…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter !== "all" ? "해당하는 질문이 없습니다" : "작성한 질문이 없습니다"}
          description={
            filter !== "all"
              ? "다른 필터를 선택해 보세요."
              : "질문하기 버튼을 눌러 선생님께 질문을 보내보세요."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          {filtered.map((q) => (
            <QnaQuestionItem
              key={q.id}
              question={q}
              isAnswered={hasAnswer(q)}
              onClick={() => onOpenDetail(q.id, q)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QnaQuestionItem({
  question,
  onClick,
  isAnswered,
}: {
  question: PostEntity;
  onClick: () => void;
  isAnswered: boolean;
}) {
  return (
    <button
      type="button"
      className="stu-panel stu-panel--pressable"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "var(--stu-space-4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--stu-space-3)",
        background: isAnswered ? "var(--stu-success-bg)" : undefined,
        border: isAnswered ? "1px solid var(--stu-success)" : undefined,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {question.title}
        </div>
        <div className="stu-muted" style={{ fontSize: 12 }}>
          {formatYmd(question.created_at)}
          {isAnswered && question.replies_count != null && question.replies_count > 0 && (
            <> · 답변 {question.replies_count}개</>
          )}
        </div>
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          background: isAnswered ? "var(--stu-success-bg)" : "var(--stu-surface-soft)",
          color: isAnswered ? "var(--stu-success-text)" : "var(--stu-text-muted)",
        }}
      >
        {isAnswered ? "답변 완료" : "답변 대기"}
      </div>
      <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
    </button>
  );
}

// ─── QnA Detail Router ───
function QuestionDetailRouter({
  questionId,
  question,
  onBack,
}: {
  questionId: number;
  question?: PostEntity;
  onBack: () => void;
}) {
  if (question) {
    return <QuestionDetailView question={question} onBack={onBack} />;
  }
  return <QuestionDetailById questionId={questionId} onBack={onBack} />;
}

function QuestionDetailById({ questionId, onBack }: { questionId: number; onBack: () => void }) {
  const { data: question, isLoading } = useQuery({
    queryKey: ["student", "qna", "question", questionId],
    queryFn: () => fetchQnaQuestionDetail(questionId),
    enabled: Number.isFinite(questionId),
  });

  if (isLoading || !question) {
    return (
      <StudentPageShell title="질문 상세" onBack={onBack}>
        <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-8)" }}>
          {isLoading ? "불러오는 중…" : "질문을 찾을 수 없습니다."}
        </div>
      </StudentPageShell>
    );
  }
  return <QuestionDetailView question={question} onBack={onBack} />;
}

function QuestionDetailView({ question, onBack }: { question: PostEntity; onBack: () => void }) {
  const answered = hasAnswer(question);
  const { data: replies = [], isLoading: repliesLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", question.id],
    queryFn: () => fetchPostReplies(question.id),
    enabled: answered,
  });

  return (
    <StudentPageShell title="질문 상세" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 질문 */}
        <div className="stu-section stu-section--nested">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--stu-space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{question.title}</div>
            <div
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
            </div>
          </div>
          <div className="stu-muted" style={{ fontSize: 12, marginBottom: "var(--stu-space-4)" }}>
            {formatYmd(question.created_at)}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--stu-text)" }}>
            {question.content}
          </div>
        </div>

        {/* 답변 */}
        {answered ? (
          <div className="stu-section stu-section--nested">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
              선생님 답변 {replies.length > 0 ? `(${replies.length}개)` : question.replies_count ? `(${question.replies_count}개)` : ""}
            </div>
            {repliesLoading ? (
              <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
                답변을 불러오는 중…
              </div>
            ) : replies.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="stu-panel"
                    style={{
                      padding: "var(--stu-space-4)",
                      background: "var(--stu-success-bg)",
                      border: "1px solid var(--stu-success)",
                    }}
                  >
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--stu-text)" }}>
                      {reply.content}
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12, marginTop: "var(--stu-space-2)" }}>
                      {formatYmd(reply.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="stu-panel"
                style={{
                  padding: "var(--stu-space-4)",
                  background: "var(--stu-success-bg)",
                  border: "1px solid var(--stu-success)",
                }}
              >
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--stu-text)" }}>
                  답변이 등록되었습니다. 선생님의 답변을 확인해주세요.
                  {question.updated_at && (
                    <div className="stu-muted" style={{ fontSize: 12, marginTop: "var(--stu-space-2)" }}>
                      답변일: {formatYmd(question.updated_at)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="stu-section stu-section--nested">
            <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
              아직 답변이 등록되지 않았습니다.
              <br />
              선생님이 확인 후 답변해 주실 거예요.
            </div>
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}

// ─── QnA Form ───
const QNA_BLOCK_CODE = "qna";

function QuestionFormPage({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: blockTypes = [], isLoading: blockTypesLoading, isError: blockTypesError } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const qnaBlockType = blockTypes.find((b) => (b.code || "").toLowerCase() === QNA_BLOCK_CODE) ?? blockTypes[0];
  const effectiveBlockTypeId = qnaBlockType?.id ?? blockTypes[0]?.id;

  const createMut = useMutation({
    mutationFn: () => {
      if (effectiveBlockTypeId == null) throw new Error("질문 유형을 불러오는 중입니다.");
      const me = qc.getQueryData<{ id: number }>(["student", "me"]) ?? profile;
      if (me?.id == null) throw new Error("로그인 정보를 불러오는 중입니다.");
      return createPost({
        block_type: effectiveBlockTypeId,
        title: title.trim(),
        content: content.trim(),
        created_by: me.id,
        node_ids: [],
      });
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

  const createErrorMessage = createMut.error != null
    ? (() => {
        const e = createMut.error as { response?: { data?: { detail?: string } }; message?: string };
        if (e?.response?.data?.detail && typeof e.response.data.detail === "string") return e.response.data.detail;
        return e instanceof Error ? e.message : "전송에 실패했습니다.";
      })()
    : null;

  const canSubmit =
    !blockTypesLoading &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    effectiveBlockTypeId != null &&
    (profile != null || qc.getQueryData<{ id: number }>(["student", "me"]) != null);

  const handleSubmit = () => {
    if (!canSubmit || createMut.isPending) return;
    createMut.mutate();
  };

  return (
    <StudentPageShell title="질문 보내기" description="궁금한 점을 적어 보내면 선생님이 확인해 주세요." onBack={onBack}>
      <div
        className="stu-section stu-section--nested"
        style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}
      >
        {blockTypesLoading && (
          <div className="stu-muted" style={{ padding: "var(--stu-space-2)", fontSize: 14 }}>질문 유형을 불러오는 중…</div>
        )}
        {!blockTypesLoading && blockTypesError && (
          <div
            role="alert"
            style={{
              padding: "var(--stu-space-3)",
              background: "var(--stu-warning-bg, #fff8e6)",
              border: "1px solid var(--stu-warning-border, #f0d675)",
              borderRadius: "var(--stu-radius)",
              fontSize: 14,
            }}
          >
            질문 유형을 불러올 수 없습니다. 새로고침하거나 관리자에게 문의해 주세요.
          </div>
        )}
        {createMut.isError && createErrorMessage && (
          <div
            role="alert"
            style={{
              padding: "var(--stu-space-3)",
              background: "var(--stu-danger-bg)",
              border: "1px solid var(--stu-danger-border)",
              borderRadius: "var(--stu-radius)",
              fontSize: 14,
              color: "var(--stu-danger-text)",
              fontWeight: 600,
            }}
          >
            {createErrorMessage}
          </div>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>제목</span>
          <input
            type="text"
            placeholder="질문 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="stu-input"
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)", flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>내용</span>
          <textarea
            placeholder="질문 내용을 적어 주세요."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="stu-textarea"
            style={{ width: "100%", resize: "vertical", minHeight: 160 }}
          />
        </label>
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          disabled={!canSubmit || createMut.isPending}
          onClick={handleSubmit}
          style={{ alignSelf: "flex-end", minHeight: 44, minWidth: 140 }}
        >
          {createMut.isPending ? "보내는 중…" : "질문 보내기"}
        </button>
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Board Tab (게시판 — QnA·공지 제외 일반 게시물)
// ═══════════════════════════════════════════
function BoardTabContent({ onOpenDetail }: { onOpenDetail: (id: number) => void }) {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["student", "board", "posts"],
    queryFn: () => fetchBoardPosts(100),
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="stu-skel" style={{ height: 72, borderRadius: "var(--stu-radius-md)" }} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        title="등록된 게시물이 없습니다"
        description="선생님이 게시물을 등록하면 여기에 표시됩니다."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
      {posts.map((post) => {
        const node = post.mappings?.[0]?.node_detail;
        return (
          <button
            key={post.id}
            type="button"
            className="stu-panel stu-panel--pressable"
            onClick={() => onOpenDetail(post.id)}
            style={{
              textAlign: "left",
              padding: "var(--stu-space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--stu-space-2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-2)" }}>
              {post.block_type_label && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "var(--stu-surface-soft)",
                    color: "var(--stu-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {post.block_type_label}
                </span>
              )}
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {post.title}
              </span>
              <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
            </div>
            <div className="stu-muted" style={{ fontSize: 12, display: "flex", gap: "var(--stu-space-2)", alignItems: "center" }}>
              <span>{formatYmd(post.created_at)}</span>
              {node?.lecture_title && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "var(--stu-surface-soft)",
                  }}
                >
                  {node.lecture_title}
                </span>
              )}
              {post.created_by_display && <span>· {post.created_by_display}</span>}
            </div>
            {post.content && (
              <div
                className="stu-muted"
                style={{
                  fontSize: 13,
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {post.content}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Board Detail ───
function BoardDetailPage({ postId, onBack }: { postId: number; onBack: () => void }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ["student", "board", "post", postId],
    queryFn: () => fetchBoardPostDetail(postId),
    enabled: Number.isFinite(postId),
  });

  if (isLoading || !post) {
    return (
      <StudentPageShell title="게시물" onBack={onBack}>
        <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-8)" }}>
          {isLoading ? "불러오는 중…" : "게시물을 찾을 수 없습니다."}
        </div>
      </StudentPageShell>
    );
  }

  const node = post.mappings?.[0]?.node_detail;

  return (
    <StudentPageShell title="게시물" onBack={onBack}>
      <div className="stu-section stu-section--nested">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: "var(--stu-space-3)" }}>{post.title}</h1>
            <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
              {post.block_type_label && (
                <span
                  className="stu-muted"
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "var(--stu-surface-soft)" }}
                >
                  {post.block_type_label}
                </span>
              )}
              {node?.lecture_title && (
                <span
                  className="stu-muted"
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "var(--stu-surface-soft)" }}
                >
                  {node.lecture_title}
                </span>
              )}
              <span className="stu-muted" style={{ fontSize: 13 }}>{formatYmd(post.created_at)}</span>
              {post.created_by_display && (
                <span className="stu-muted" style={{ fontSize: 13 }}>· {post.created_by_display}</span>
              )}
            </div>
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--stu-text)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {post.content || "내용이 없습니다."}
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}

// ═══════════════════════════════════════════
// Materials Tab (자료실 — 백엔드 미구현, 스텁)
// ═══════════════════════════════════════════
function MaterialsTabContent() {
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["student", "materials"],
    queryFn: fetchStudentMaterials,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2].map((i) => (
          <div key={i} className="stu-skel" style={{ height: 60, borderRadius: "var(--stu-radius-md)" }} />
        ))}
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <EmptyState
        title="등록된 자료가 없습니다"
        description="선생님이 자료를 등록하면 여기에서 다운로드할 수 있습니다."
        icon={
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--stu-surface-soft)",
              border: "1px solid var(--stu-border-subtle)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto",
              opacity: 0.6,
            }}
          >
            <IconFolder style={{ width: 32, height: 32, color: "var(--stu-text-muted)" }} />
          </div>
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
      {materials.map((m) => (
        <div
          key={m.id}
          className="stu-panel"
          style={{
            padding: "var(--stu-space-4)",
            display: "flex",
            alignItems: "center",
            gap: "var(--stu-space-3)",
          }}
        >
          <IconFolder style={{ width: 20, height: 20, color: "var(--stu-primary)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
            {m.description && (
              <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>{m.description}</div>
            )}
          </div>
          {(m.file || m.url) && (
            <a
              href={m.file || m.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="stu-btn stu-btn--ghost stu-btn--sm"
              style={{ flexShrink: 0 }}
            >
              <IconDownload style={{ width: 16, height: 16 }} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
