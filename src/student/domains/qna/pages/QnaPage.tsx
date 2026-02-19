/**
 * 학생 QnA 페이지
 * - 내가 작성한 질문 목록 보기
 * - 질문 상세 및 답변 보기
 * - 질문하기 기능
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchBlockTypes, createPost, fetchPostReplies, type PostEntity, type Answer } from "@/features/community/api/community.api";
import { fetchMyQnaQuestions, fetchQnaQuestionDetail, hasAnswer, isPendingAnswer } from "../api/qna.api";
import { formatYmd } from "@/student/shared/utils/date";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconPlus, IconChevronRight } from "@/student/shared/ui/icons/Icons";

const QNA_BLOCK_CODE = "qna";
const MAX_FILES = 5;
const MAX_SIZE_MB = 10;

export default function QnaPage() {
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  // 내 질문 목록 조회
  const { data: questions = [], isLoading: questionsLoading, refetch: refetchQuestions } = useQuery({
    queryKey: ["student", "qna", "questions"],
    queryFn: fetchMyQnaQuestions,
  });

  // 선택한 질문 상세 조회
  const { data: questionDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["student", "qna", "question", selectedQuestionId],
    queryFn: () => selectedQuestionId ? fetchQnaQuestionDetail(selectedQuestionId) : null,
    enabled: selectedQuestionId != null,
  });

  // 선택한 질문의 답변 목록 조회
  const { data: replies = [], isLoading: repliesLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", selectedQuestionId],
    queryFn: () => selectedQuestionId ? fetchPostReplies(selectedQuestionId) : [],
    enabled: selectedQuestionId != null && questionDetail != null && hasAnswer(questionDetail),
  });

  // 질문 분류
  const answeredQuestions = questions.filter((q) => hasAnswer(q));
  const pendingQuestions = questions.filter((q) => isPendingAnswer(q));

  if (showQuestionForm) {
    return (
      <QuestionFormPage
        onBack={() => setShowQuestionForm(false)}
        onSuccess={() => {
          setShowQuestionForm(false);
          refetchQuestions();
        }}
      />
    );
  }

  if (selectedQuestionId && questionDetail) {
    return (
      <QuestionDetailPage
        question={questionDetail}
        onBack={() => setSelectedQuestionId(null)}
      />
    );
  }

  return (
    <StudentPageShell
      title="QnA"
      description="내가 작성한 질문과 답변을 확인하세요."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 질문하기 버튼 */}
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

        {questionsLoading ? (
          <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-8)" }}>
            불러오는 중...
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            title="작성한 질문이 없습니다"
            description="질문하기 버튼을 눌러 선생님께 질문을 보내보세요."
          />
        ) : (
          <>
            {/* 답변 대기 질문 */}
            {pendingQuestions.length > 0 && (
              <div className="stu-section stu-section--nested">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
                  답변 대기 ({pendingQuestions.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                  {pendingQuestions.map((question) => (
                    <QuestionItem
                      key={question.id}
                      question={question}
                      onClick={() => setSelectedQuestionId(question.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 답변 완료 질문 */}
            {answeredQuestions.length > 0 && (
              <div className="stu-section stu-section--nested">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
                  답변 완료 ({answeredQuestions.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                  {answeredQuestions.map((question) => (
                    <QuestionItem
                      key={question.id}
                      question={question}
                      onClick={() => setSelectedQuestionId(question.id)}
                      isAnswered
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StudentPageShell>
  );
}

/**
 * 질문 아이템 컴포넌트
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
          {isAnswered && question.replies_count && question.replies_count > 0 && (
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
 * 질문 상세 페이지
 */
function QuestionDetailPage({
  question,
  onBack,
}: {
  question: PostEntity;
  onBack: () => void;
}) {
  const hasAnswerValue = hasAnswer(question);
  
  // 답변 목록 조회
  const { data: replies = [], isLoading: repliesLoading } = useQuery<Answer[]>({
    queryKey: ["student", "qna", "replies", question.id],
    queryFn: () => fetchPostReplies(question.id),
    enabled: hasAnswerValue,
  });

  return (
    <StudentPageShell
      title="질문 상세"
      onBack={onBack}
    >
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

        {/* 답변 영역 */}
        {hasAnswerValue ? (
          <div className="stu-section stu-section--nested">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
              답변 {replies.length > 0 ? `(${replies.length}개)` : question.replies_count ? `(${question.replies_count}개)` : ""}
            </div>
            {repliesLoading ? (
              <div className="stu-muted" style={{ textAlign: "center", padding: "var(--stu-space-4)" }}>
                답변을 불러오는 중...
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
    </StudentPageShell>
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

  const { data: blockTypes = [], isLoading: blockTypesLoading } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
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
      return createPost({
        block_type: effectiveBlockTypeId,
        title: title.trim(),
        content: content.trim(),
        node_ids: [],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "qna", "questions"] });
      qc.invalidateQueries({ queryKey: ["student-community-posts"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      setTitle("");
      setContent("");
      setFiles([]);
      onSuccess();
    },
  });

  const canSubmit =
    !blockTypesLoading &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    effectiveBlockTypeId != null;

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
        {createMut.isError && (
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
            {createMut.error instanceof Error ? createMut.error.message : "전송에 실패했습니다."}
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
