/**
 * 학생 QnA 페이지
 * - 선생앱 QnA와 동일한 용어·구조 정합: 전체 질문 / 답변 필요 / 해결됨, 답변 대기·답변 완료
 * - 내 질문 목록 → 선택 시 상세(질문 + 선생님 답변)
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchBlockTypes, createPost, fetchPostReplies, type PostEntity, type Answer } from "@/features/community/api/community.api";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { fetchMyQnaQuestions, fetchQnaQuestionDetail, hasAnswer, isPendingAnswer } from "../api/qna.api";
import { formatYmd } from "@/student/shared/utils/date";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconPlus, IconChevronRight } from "@/student/shared/ui/icons/Icons";

const QNA_BLOCK_CODE = "qna";
const MAX_FILES = 5;
const MAX_SIZE_MB = 10;

/** 선생앱 QnA와 동일한 필터 구분 */
type FilterKind = "all" | "pending" | "resolved";

export default function QnaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  // 알림에서 "답변 달림" 클릭 시 해당 질문 상세로 열기
  useEffect(() => {
    const openId = (location.state as { openQuestionId?: number } | null)?.openQuestionId;
    if (openId != null) {
      setSelectedQuestionId(openId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  // 내 질문 목록 조회 (선생앱과 동일: community.api 기반)
  const { data: questions = [], isLoading: questionsLoading, refetch: refetchQuestions } = useQuery({
    queryKey: ["student", "qna", "questions"],
    queryFn: () => fetchMyQnaQuestions({ pageSize: 50 }),
  });

  // 선생앱과 동일한 필터: 전체 / 답변 필요 / 해결됨
  const filtered = useMemo(() => {
    if (filter === "pending") return questions.filter((q) => isPendingAnswer(q));
    if (filter === "resolved") return questions.filter((q) => hasAnswer(q));
    return questions;
  }, [questions, filter]);

  const pendingCount = useMemo(() => questions.filter((q) => isPendingAnswer(q)).length, [questions]);
  const resolvedCount = useMemo(() => questions.filter((q) => hasAnswer(q)).length, [questions]);

  if (showQuestionForm) {
    return (
      <div data-page="qna">
        <QuestionFormPage
          onBack={() => setShowQuestionForm(false)}
          onSuccess={() => {
            setShowQuestionForm(false);
            refetchQuestions();
          }}
        />
      </div>
    );
  }

  if (selectedQuestionId != null) {
    const questionDetail = questions.find((q) => q.id === selectedQuestionId);
    if (questionDetail) {
      return (
        <div data-page="qna">
          <QuestionDetailPage
            question={questionDetail}
            onBack={() => setSelectedQuestionId(null)}
          />
        </div>
      );
    }
    // 아직 로드 전이면 상세 쿼리로 조회
    return (
      <div data-page="qna">
        <QuestionDetailPageById
          questionId={selectedQuestionId}
          onBack={() => setSelectedQuestionId(null)}
        />
      </div>
    );
  }

  return (
    <div data-page="qna">
      <StudentPageShell
        title="QnA"
        description="내가 작성한 질문과 답변을 확인하세요."
      >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 선생앱과 동일: 질문하기 버튼 */}
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          onClick={() => setShowQuestionForm(true)}
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

        {/* 선생앱 QnA와 동일한 필터 탭: 전체 질문 / 답변 필요 / 해결됨 */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            background: "var(--stu-surface-soft)",
            borderRadius: 8,
          }}
        >
          {(
            [
              { key: "all" as const, label: "전체 질문", count: questions.length },
              { key: "pending" as const, label: "답변 필요", count: pendingCount },
              { key: "resolved" as const, label: "해결됨", count: resolvedCount },
            ] as const
          ).map(({ key, label, count }) => (
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
              }}
            >
              <span>{label}</span>
              <span style={{ marginLeft: 4, opacity: 0.9 }}>{count}</span>
            </button>
          ))}
        </div>

        {questionsLoading ? (
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
            {filtered.map((question) => (
              <QuestionItem
                key={question.id}
                question={question}
                isAnswered={hasAnswer(question)}
                onClick={() => setSelectedQuestionId(question.id)}
              />
            ))}
          </div>
        )}
      </div>
    </StudentPageShell>
    </div>
  );
}

/**
 * 질문 아이템 — 선생앱 QnA 카드와 동일한 상태 라벨(답변 대기 / 답변 완료)
 */
function QuestionItem({
  question,
  onClick,
  isAnswered = false,
}: {
  question: PostEntity;
  onClick: () => void;
  isAnswered?: boolean;
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
        background: isAnswered
          ? "var(--stu-success-bg)"
          : undefined,
        border: isAnswered
          ? "1px solid var(--stu-success)"
          : undefined,
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
          background: isAnswered
            ? "var(--stu-success-bg)"
            : "var(--stu-surface-soft)",
          color: isAnswered
            ? "var(--stu-success-text)"
            : "var(--stu-text-muted)",
        }}
      >
        {isAnswered ? "답변 완료" : "답변 대기"}
      </div>
      <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
    </button>
  );
}

/**
 * 질문 상세 페이지 (목록에서 선택된 질문)
 */
function QuestionDetailPage({
  question,
  onBack,
}: {
  question: PostEntity;
  onBack: () => void;
}) {
  const hasAnswerValue = hasAnswer(question);
  const { data: replies = [], isLoading: repliesLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", question.id],
    queryFn: () => fetchPostReplies(question.id),
    enabled: hasAnswerValue,
  });
  return (
    <StudentPageShell title="질문 상세" onBack={onBack}>
      <QuestionDetailContent
        question={question}
        hasAnswerValue={hasAnswerValue}
        replies={replies}
        repliesLoading={repliesLoading}
      />
    </StudentPageShell>
  );
}

/**
 * ID로 질문 상세 조회 (알림 등 직접 진입 시)
 */
function QuestionDetailPageById({ questionId, onBack }: { questionId: number; onBack: () => void }) {
  const { data: question, isLoading } = useQuery({
    queryKey: ["student", "qna", "question", questionId],
    queryFn: () => fetchQnaQuestionDetail(questionId),
    enabled: Number.isFinite(questionId),
  });
  const hasAnswerValue = question != null && hasAnswer(question);
  const { data: replies = [], isLoading: repliesLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", questionId],
    queryFn: () => fetchPostReplies(questionId),
    enabled: hasAnswerValue,
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
  return (
    <StudentPageShell title="질문 상세" onBack={onBack}>
      <QuestionDetailContent
        question={question}
        hasAnswerValue={hasAnswerValue}
        replies={replies}
        repliesLoading={repliesLoading}
      />
    </StudentPageShell>
  );
}

/** 상세 본문 — 선생앱과 동일 구조(제목·상태·내용 → 선생님 답변) */
function QuestionDetailContent({
  question,
  hasAnswerValue,
  replies,
  repliesLoading,
}: {
  question: PostEntity;
  hasAnswerValue: boolean;
  replies: Answer[];
  repliesLoading: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 질문 정보 */}
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
                background: hasAnswerValue
                  ? "var(--stu-success-bg)"
                  : "var(--stu-surface-soft)",
                color: hasAnswerValue
                  ? "var(--stu-success-text)"
                  : "var(--stu-text-muted)",
              }}
            >
              {hasAnswerValue ? "답변 완료" : "답변 대기"}
            </div>
          </div>
          <div className="stu-muted" style={{ fontSize: 12, marginBottom: "var(--stu-space-4)" }}>
            {formatYmd(question.created_at)}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "var(--stu-text)",
            }}
          >
            {question.content}
          </div>
        </div>

        {/* 답변 영역 — 선생앱과 동일: "선생님 답변" 구분 */}
        {hasAnswerValue ? (
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
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        color: "var(--stu-text)",
                      }}
                    >
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
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    color: "var(--stu-text)",
                  }}
                >
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
  );
}

/**
 * 질문 작성 페이지
 */
function QuestionFormPage({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hadFilesOnSubmitRef = useRef(false);

  const {
    data: blockTypes = [],
    isLoading: blockTypesLoading,
    isError: blockTypesError,
  } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const qnaBlockType =
    blockTypes.find((b) => (b.code || "").toLowerCase() === QNA_BLOCK_CODE) ?? blockTypes[0];
  const effectiveBlockTypeId = qnaBlockType?.id ?? blockTypes[0]?.id;

  const createMut = useMutation({
    mutationFn: () => {
      if (effectiveBlockTypeId == null) {
        throw new Error("질문 유형을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      }
      hadFilesOnSubmitRef.current = files.length > 0;
      const me = qc.getQueryData<{ id: number }>(["student", "me"]) ?? profile;
      if (me?.id == null) {
        throw new Error("로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      }
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
      setTitle("");
      setContent("");
      setFiles([]);
      onSuccess();
    },
    onError: (err: unknown) => {
      // 백엔드 400 profile_required 시 프로필 재조회해 재시도 가능하게
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "profile_required") {
        qc.invalidateQueries({ queryKey: ["student", "me"] });
      }
    },
  });

  const createErrorMessage =
    createMut.error != null
      ? (() => {
          const e = createMut.error as { response?: { data?: { detail?: string; code?: string } }; message?: string };
          if (e?.response?.data?.detail && typeof e.response.data.detail === "string") {
            return e.response.data.detail;
          }
          return e instanceof Error ? e.message : "전송에 실패했습니다.";
        })()
      : null;

  const canSubmit =
    !blockTypesLoading &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    effectiveBlockTypeId != null &&
    (profile != null || qc.getQueryData<{ id: number }>(["student", "me"]) != null);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    const ok: File[] = [];
    for (const f of chosen) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue;
      if (ok.length + files.length >= MAX_FILES) break;
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
    if (e.target) e.target.value = "";
  };
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = () => {
    if (!canSubmit || createMut.isPending) return;
    createMut.mutate();
  };

  return (
    <StudentPageShell
      title="질문 보내기"
      description="궁금한 점을 적어 보내면 선생님이 확인해 주세요."
      onBack={onBack}
    >
      <div
        className="stu-section stu-section--nested"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--stu-space-4)",
        }}
      >
        {blockTypesLoading && (
          <div className="stu-muted" style={{ padding: "var(--stu-space-2)", fontSize: 14 }}>
            질문 유형을 불러오는 중…
          </div>
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
              color: "var(--stu-text, #333)",
            }}
          >
            질문 유형을 불러올 수 없습니다. 새로고침하거나 관리자에게 문의해 주세요.
          </div>
        )}
        {!blockTypesLoading && !blockTypesError && blockTypes.length === 0 && (
          <div className="stu-muted" style={{ padding: "var(--stu-space-2)", fontSize: 13 }}>
            등록된 질문 유형이 없습니다. 관리자에게 문의해 주세요.
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
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
            제목
          </span>
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
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
            내용
          </span>
          <textarea
            placeholder="질문 내용을 적어 주세요."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="stu-textarea"
            style={{ width: "100%", resize: "vertical", minHeight: 160 }}
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
            사진·파일 (선택, 최대 {MAX_FILES}개, 개당 {MAX_SIZE_MB}MB)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple
            onChange={addFiles}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="stu-btn stu-btn--secondary stu-btn--sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ alignSelf: "flex-start" }}
          >
            파일 선택
          </button>
          {files.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--stu-space-2) var(--stu-space-3)",
                    background: "var(--stu-surface)",
                    border: "1px solid var(--stu-border)",
                    borderRadius: "var(--stu-radius)",
                    fontSize: 13,
                    color: "var(--stu-text)",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                    {f.name} ({(f.size / 1024).toFixed(1)}KB)
                  </span>
                  <button
                    type="button"
                    className="stu-btn stu-btn--ghost stu-btn--sm"
                    onClick={() => removeFile(i)}
                    style={{ flexShrink: 0, padding: "var(--stu-space-1) var(--stu-space-2)" }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {createMut.isSuccess && (
          <div
            style={{
              padding: "var(--stu-space-3)",
              background: "var(--stu-success-bg)",
              borderRadius: "var(--stu-radius)",
              fontSize: 14,
              color: "var(--stu-success-text)",
            }}
          >
            질문이 전달되었습니다. 선생님이 확인 후 답변해 주실 거예요.
            {hadFilesOnSubmitRef.current && (
              <div style={{ marginTop: "var(--stu-space-2)", fontSize: 12, opacity: 0.9 }}>
                ※ 첨부파일은 현재 저장되지 않습니다. 제목과 내용만 전송되었습니다.
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          disabled={!canSubmit || createMut.isPending}
          title={
            createMut.isPending
              ? "보내는 중…"
              : !effectiveBlockTypeId
                ? "질문 유형을 불러올 수 없습니다."
                : profile == null && qc.getQueryData(["student", "me"]) == null
                  ? "로그인 정보를 불러오는 중입니다."
                  : !title.trim() || !content.trim()
                    ? "제목과 내용을 입력해 주세요."
                    : undefined
          }
          onClick={handleSubmit}
          onPointerDown={(e) => {
            if (e.pointerType === "touch" && canSubmit && !createMut.isPending) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          style={{
            alignSelf: "flex-end",
            minHeight: 44,
            minWidth: 140,
          }}
        >
          {createMut.isPending ? "보내는 중…" : "질문 보내기"}
        </button>
      </div>
    </StudentPageShell>
  );
}
