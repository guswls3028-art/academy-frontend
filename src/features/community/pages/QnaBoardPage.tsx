// PATH: src/features/community/pages/QnaBoardPage.tsx
// QnA 목록 — 섹션형 레이아웃(SSOT: patterns/section.css), 검색·필터·상세 이동

import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import { fetchCommunityQuestions, type Question } from "../api/community.api";
import { EmptyState, Button } from "@/shared/ui/ds";

const SNIPPET_LEN = 80;

export default function QnaBoardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scope, effectiveLectureId, sessionId } = useCommunityScope();
  const [filterPending, setFilterPending] = useState<boolean>(() =>
    searchParams.get("pending") === "1"
  );
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("search") ?? "");

  const scopeParams = useMemo(
    () => ({
      scope,
      lectureId: effectiveLectureId ?? undefined,
      sessionId: sessionId ?? undefined,
    }),
    [scope, effectiveLectureId, sessionId]
  );

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["community-questions", scope, effectiveLectureId, sessionId],
    queryFn: () => fetchCommunityQuestions(scopeParams),
    enabled:
      scope === "all" ||
      (scope === "lecture" && effectiveLectureId != null) ||
      (scope === "session" && sessionId != null),
  });

  const filtered = useMemo(() => {
    let list = filterPending ? questions.filter((q) => !q.is_answered) : questions;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(q) || (x.content || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [questions, filterPending, searchQuery]);

  const pendingCount = useMemo(
    () => questions.filter((q) => !q.is_answered).length,
    [questions]
  );

  const handleSearch = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (searchQuery.trim()) next.set("search", searchQuery.trim());
      else next.delete("search");
      if (filterPending) next.set("pending", "1");
      else next.delete("pending");
      return next;
    });
  };

  if (
    (scope === "lecture" && effectiveLectureId == null) ||
    (scope === "session" && (!effectiveLectureId || sessionId == null))
  ) {
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
    <section className="ds-section">
      <header className="ds-section__header">
        <h2 className="ds-section__title">질의응답</h2>
        <p className="ds-section__description">학생 질문 목록 · 검색 후 상세에서 답변할 수 있습니다.</p>
      </header>

      <div className="ds-section__body">
        {/* 검색·필터 바 */}
        <div
          className="flex flex-wrap items-center gap-3"
          style={{ marginBottom: "var(--space-4)" }}
        >
          <select
            className="ds-input"
            style={{ width: 140 }}
            aria-label="카테고리"
          >
            <option value="all">전체</option>
          </select>
          <input
            type="search"
            className="ds-input"
            placeholder="Q 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ width: 200 }}
            aria-label="검색어"
          />
          <Button intent="primary" size="sm" onClick={handleSearch}>
            검색
          </Button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterPending}
              onChange={(e) => setFilterPending(e.target.checked)}
              className="rounded border-[var(--color-border-divider)]"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              답변 필요 질문만
            </span>
            {pendingCount > 0 && (
              <span
                className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold text-white bg-[var(--color-status-error,#ef4444)]"
                aria-label={`답변 대기 ${pendingCount}건`}
              >
                {pendingCount}
              </span>
            )}
          </label>
        </div>

        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            scope="panel"
            title="질문이 없습니다."
            description={
              searchQuery.trim() || filterPending
                ? "검색 조건을 바꿔 보세요."
                : "학생이 올린 질문이 여기에 표시됩니다."
            }
          />
        ) : (
          <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((q) => (
              <li key={q.id}>
                <QuestionRow question={q} onOpen={() => navigate(`/admin/community/qna/read/${q.id}`)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function QuestionRow({ question, onOpen }: { question: Question; onOpen: () => void }) {
  const snippet =
    question.content && question.content.length > SNIPPET_LEN
      ? question.content.slice(0, SNIPPET_LEN).trim() + "…"
      : question.content || "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="ds-section__item w-full flex items-start gap-3 text-left"
    >
      <div className="ds-section__item-content flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[var(--color-text-muted)] font-medium tabular-nums">
            {question.id}
          </span>
          <span className="ds-section__item-label">{question.title}</span>
          <span
            className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: question.is_answered
                ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
                : "var(--color-bg-surface-soft)",
              color: question.is_answered ? "var(--color-primary)" : "var(--color-text-muted)",
            }}
          >
            {question.is_answered ? "답변 완료" : "답변 대기"}
          </span>
        </div>
        {snippet && (
          <p className="ds-section__item-meta mt-1 line-clamp-2">{snippet}</p>
        )}
        <p className="ds-section__item-meta mt-1">
          {question.student_name ?? "—"} ·{" "}
          {new Date(question.created_at).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </button>
  );
}
