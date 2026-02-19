// PATH: src/features/community/pages/QnaBoardPage.tsx
// 커뮤니티 QnA — scope에 따라 목록 + 답변

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchCommunityQuestions,
  fetchQuestionAnswer,
  createAnswer,
  type Question,
} from "../api/community.api";
import { EmptyState, Button } from "@/shared/ui/ds";

export default function QnaBoardPage() {
  const qc = useQueryClient();
  const { scope, lectureId, sessionId, effectiveLectureId } = useCommunityScope();
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [filterAnswered, setFilterAnswered] = useState<"all" | "pending">("all");

  const scopeParams = {
    scope,
    lectureId: effectiveLectureId ?? undefined,
    sessionId: sessionId ?? undefined,
  };

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["community-questions", scope, effectiveLectureId, sessionId],
    queryFn: () => fetchCommunityQuestions(scopeParams),
    enabled: scope === "all" || (scope === "lecture" && effectiveLectureId != null) || (scope === "session" && sessionId != null),
  });

  const filtered = filterAnswered === "pending"
    ? questions.filter((q) => !q.is_answered)
    : questions;

  if ((scope === "lecture" && effectiveLectureId == null) || (scope === "session" && (!effectiveLectureId || sessionId == null))) {
    return (
      <EmptyState
        scope="panel"
        title={scope === "session" ? "강의·차시를 선택하세요" : "강의를 선택하세요"}
        description={
          scope === "session"
            ? "노출 범위를 '세션별'로 두고 강의와 차시를 선택하면 해당 차시 QnA를 볼 수 있습니다."
            : "노출 범위를 '강의별'로 두고 위에서 강의를 선택하면 해당 강의의 QnA를 관리할 수 있습니다."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <select
          className="ds-input"
          value={filterAnswered}
          onChange={(e) => setFilterAnswered(e.target.value as "all" | "pending")}
          style={{ width: 140 }}
        >
          <option value="all">전체</option>
          <option value="pending">답변 대기</option>
        </select>
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          {filtered.length}건
        </span>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          scope="panel"
          title="질문이 없습니다."
          description="학생이 올린 질문이 여기에 표시됩니다."
        />
      ) : (
        <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((q) => (
            <li key={q.id}>
              <QuestionRow
                question={q}
                isOpen={openedId === q.id}
                onToggle={() => setOpenedId((id) => (id === q.id ? null : q.id))}
                onAnswerSuccess={() => {
                  qc.invalidateQueries({ queryKey: ["community-questions"] });
                  setOpenedId(null);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionRow({
  question,
  isOpen,
  onToggle,
  onAnswerSuccess,
}: {
  question: Question;
  isOpen: boolean;
  onToggle: () => void;
  onAnswerSuccess: () => void;
}) {
  const { data: answer } = useQuery({
    queryKey: ["question-answer", question.id],
    queryFn: () => fetchQuestionAnswer(question.id),
    enabled: isOpen,
  });

  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          {question.title}
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            padding: "2px 8px",
            borderRadius: 999,
            background: question.is_answered
              ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
              : "var(--color-bg-surface-soft)",
            color: question.is_answered ? "var(--color-primary)" : "var(--color-text-muted)",
          }}
        >
          {question.is_answered ? "답변 완료" : "답변 대기"}
        </span>
      </button>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 6 }}>
        {new Date(question.created_at).toLocaleDateString("ko-KR")}
      </div>

      {isOpen && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border-divider)" }}>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {question.content}
          </div>
          {answer && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "var(--color-bg-surface-soft)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>답변</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{answer.content}</div>
            </div>
          )}
          {!question.is_answered && (
            <AnswerForm questionId={question.id} onSuccess={onAnswerSuccess} />
          )}
        </div>
      )}
    </div>
  );
}

function AnswerForm({ questionId, onSuccess }: { questionId: number; onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: () => createAnswer(questionId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-questions"] });
      qc.invalidateQueries({ queryKey: ["question-answer", questionId] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setContent("");
      onSuccess();
    },
  });

  return (
    <div style={{ marginTop: 12 }}>
      <textarea
        className="ds-input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="답변 입력"
        rows={3}
        style={{ width: "100%", resize: "vertical" }}
      />
      <Button
        intent="primary"
        size="sm"
        className="mt-2"
        onClick={() => createMut.mutate()}
        disabled={!content.trim() || createMut.isPending}
      >
        {createMut.isPending ? "등록 중…" : "답변 등록"}
      </Button>
    </div>
  );
}
