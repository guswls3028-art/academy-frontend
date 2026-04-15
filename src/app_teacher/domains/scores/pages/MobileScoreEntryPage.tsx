// PATH: src/app_teacher/domains/scores/pages/MobileScoreEntryPage.tsx
// 성적 입력 — 모바일 최적화. 숫자 키패드 + 자동 다음 포커스
import { useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { fetchSessionExams, fetchExamResults, updateResult } from "../api";

export default function MobileScoreEntryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sid = Number(sessionId);

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ["session-exams", sid],
    queryFn: () => fetchSessionExams(sid),
    enabled: Number.isFinite(sid),
  });

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const activeExamId = selectedExamId ?? exams?.[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>
          성적 입력
        </h1>
      </div>

      {examsLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : exams && exams.length > 0 ? (
        <>
          {/* Exam selector chips */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {exams.map((exam: any) => (
              <button
                key={exam.id}
                onClick={() => setSelectedExamId(exam.id)}
                className="rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  padding: "8px 16px",
                  border: exam.id === activeExamId ? "none" : "1px solid var(--tc-border)",
                  background: exam.id === activeExamId ? "var(--tc-primary)" : "transparent",
                  color: exam.id === activeExamId ? "#fff" : "var(--tc-text)",
                }}
              >
                {exam.title}
              </button>
            ))}
          </div>
          {activeExamId && <ScoreEntryList examId={activeExamId} />}
        </>
      ) : (
        <EmptyState scope="panel" tone="empty" title="이 세션에 연결된 시험이 없습니다" />
      )}
    </div>
  );
}

function ScoreEntryList({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { data: results, isLoading } = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: () => fetchExamResults(examId),
    enabled: Number.isFinite(examId),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) =>
      updateResult(id, { score }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-results", examId] }),
    onError: (e) => feedback.error(extractApiError(e, "저장 실패")),
  });

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const [localScores, setLocalScores] = useState<Map<number, string>>(new Map());

  const handleSubmit = useCallback(
    (resultId: number, maxScore: number) => {
      const val = localScores.get(resultId);
      if (val == null || val === "") return;
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > maxScore) return;
      updateMut.mutate({ id: resultId, score: num });
    },
    [localScores, updateMut],
  );

  const focusNext = useCallback(
    (currentId: number) => {
      if (!results) return;
      const idx = results.findIndex((r: any) => r.id === currentId);
      if (idx >= 0 && idx < results.length - 1) {
        inputRefs.current.get(results[idx + 1].id)?.focus();
      }
    },
    [results],
  );

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!results?.length)
    return <EmptyState scope="panel" tone="empty" title="성적 데이터가 없습니다" />;

  const entered = results.filter(
    (r: any) => r.final_score != null || r.score != null || localScores.has(r.id),
  ).length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[13px]" style={{ color: "var(--tc-text-secondary)" }}>
        입력 {entered}/{results.length}
      </div>
      {results.map((r: any) => {
        const existing = r.final_score ?? r.score;
        const display = localScores.get(r.id) ?? (existing != null ? String(existing) : "");
        const maxScore = r.max_score ?? r.perfect_score ?? 100;
        const name = r.student_name ?? r.name ?? "이름 없음";

        return (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-lg"
            style={{
              padding: "var(--tc-space-3) var(--tc-space-4)",
              background: "var(--tc-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <span
              className="text-[15px] font-semibold flex-1 min-w-0"
              style={{ color: "var(--tc-text)" }}
            >
              {name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={(el) => {
                  if (el) inputRefs.current.set(r.id, el);
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={display}
                placeholder="-"
                onChange={(e) =>
                  setLocalScores((p) => new Map(p).set(r.id, e.target.value))
                }
                onBlur={() => handleSubmit(r.id, maxScore)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(r.id, maxScore);
                    focusNext(r.id);
                  }
                }}
                className="text-center text-lg font-bold outline-none"
                style={{
                  width: 56,
                  height: 40,
                  border: "1px solid var(--tc-border-strong)",
                  borderRadius: "var(--tc-radius-sm)",
                  background: "var(--tc-surface-soft)",
                  color: "var(--tc-text)",
                }}
              />
              <span className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>
                / {maxScore}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
