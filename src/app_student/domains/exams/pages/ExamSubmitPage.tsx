// src/app_student/domains/exams/pages/ExamSubmitPage.tsx
/**
 * 시험 답안 입력 페이지 — 문항별 1, 2, 3, 4, 5 입력 후 제출
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import { useStudentExam } from "@student/domains/exams/hooks/useStudentExams";
import {
  fetchStudentExamQuestions,
  submitStudentExamAnswers,
} from "@student/domains/exams/api/exams.api";
import { useAuthContext } from "@/auth/context/AuthContext";
import { resolveTenantCodeString } from "@/shared/tenant";

export default function ExamSubmitPage() {
  const { examId } = useParams();
  const safeId = Number(examId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuthContext();
  const isParent = user?.tenantRole === "parent";
  const tenantCode = resolveTenantCodeString();

  // 학부모는 응시 불가 — hook은 모두 호출하되 fetch/draft 동작을 차단해 자녀 데이터 오염 방지.
  const examQ = useStudentExam(!isParent && Number.isFinite(safeId) ? safeId : undefined);
  const questionsQ = useQuery({
    queryKey: ["student", "exams", "questions", tenantCode, safeId],
    queryFn: () => fetchStudentExamQuestions(safeId),
    enabled: !isParent && Number.isFinite(safeId),
  });
  const questions = questionsQ.data ?? [];
  const loadingQuestions = questionsQ.isLoading;

  // 학부모일 땐 draft 자체를 저장/복원하지 않음 — 자녀 draft 오염 방지.
  const draftKey = isParent
    ? `exam_draft_PARENT_NOOP_${tenantCode}_${safeId}`
    : `exam_draft_${tenantCode}_${user?.id ?? "anon"}_${safeId}`;

  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    if (isParent) return {};
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore corrupt data */ }
    return {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save draft to localStorage on answer change
  const updateAnswers = useCallback(
    (updater: (prev: Record<number, string>) => Record<number, string>) => {
      setAnswers((prev) => {
        const next = updater(prev);
        if (!isParent) {
          try {
            localStorage.setItem(draftKey, JSON.stringify(next));
          } catch { /* quota exceeded — non-critical */ }
        }
        return next;
      });
    },
    [draftKey, isParent],
  );

  // Seed answers state when questions first load
  useEffect(() => {
    if (questions.length === 0) return;
    updateAnswers((prev) => {
      const next = { ...prev };
      questions.forEach((q) => {
        if (next[q.id] === undefined) next[q.id] = "";
      });
      return next;
    });
  }, [questions, updateAnswers]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!Number.isFinite(safeId)) return;
    const payload = {
      answers: Object.entries(answers)
        .filter(([, v]) => String(v).trim() !== "")
        .map(([qId, answer]) => ({
          exam_question_id: Number(qId),
          answer: String(answer).trim(),
        })),
    };
    if (payload.answers.length === 0) {
      setError("최소 한 문항의 답을 입력하세요.");
      return;
    }
    const unanswered = questions.length - payload.answers.length;
    const confirmMsg = unanswered > 0
      ? `${unanswered}개 문항이 미입력 상태입니다. 제출하시겠습니까?`
      : "답안을 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.";
    const ok = await confirm({ title: "제출 확인", message: confirmMsg, danger: false, confirmText: "제출" });
    if (!ok) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitStudentExamAnswers(safeId, payload);
      try { localStorage.removeItem(draftKey); } catch { /* non-critical */ }
      qc.invalidateQueries({ queryKey: ["student", "exams"] });
      qc.invalidateQueries({ queryKey: ["student", "grades"] });
      qc.invalidateQueries({ queryKey: ["student-dashboard"] });
      navigate(`/student/exams/${safeId}/result`, { replace: true });
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ?? "제출에 실패했습니다. 다시 시도해 주세요."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험 입력" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  // 학부모 가드 — fetch는 disabled, 화면도 즉시 차단.
  if (isParent) {
    return (
      <StudentPageShell title="시험 응시" description="학부모는 시험에 응시할 수 없습니다.">
        <EmptyState
          title="학부모는 시험에 응시할 수 없습니다."
          description="자녀(학생) 계정으로 로그인한 뒤 응시해 주세요."
        />
      </StudentPageShell>
    );
  }

  if (examQ.isLoading) {
    return (
      <StudentPageShell title="시험 입력">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 24, width: "60%", borderRadius: "var(--stu-radius-sm)" }} />
          <div className="stu-skel" style={{ height: 6, borderRadius: 3 }} />
          <div className="stu-skel" style={{ height: 52, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 52, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 52, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (examQ.isError || !examQ.data) {
    return (
      <StudentPageShell title="시험 입력" description="시험 정보를 불러올 수 없습니다.">
        <EmptyState
          title="시험 정보를 불러오지 못했습니다."
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => examQ.refetch()}
        />
      </StudentPageShell>
    );
  }

  const exam = examQ.data;

  // Already submitted guard: prevent direct URL access after submission
  const hasResult = exam.status === "done" || exam.has_result;
  const canRetake = exam.allow_retake && (exam.attempt_count ?? 0) < (exam.max_attempts ?? 1);
  if (hasResult && !canRetake) {
    return (
      <StudentPageShell title={exam.title} description="이미 제출된 시험입니다.">
        <EmptyState
          title="이미 제출된 시험입니다"
          description="결과 페이지에서 확인하세요."
        />
        <div style={{ padding: 16 }}>
          <Link to={`/student/exams/${safeId}/result`} className="stu-cta-link">
            결과 보기
          </Link>
        </div>
      </StudentPageShell>
    );
  }

  // Closed exam guard: prevent submission after close_at
  const isClosed = exam.close_at
    ? new Date(exam.close_at) < new Date()
    : false;

  if (isClosed) {
    return (
      <StudentPageShell title={exam.title} description="시험이 마감되었습니다.">
        <EmptyState
          title="시험이 마감되었습니다"
          description="마감 시간이 지나 더 이상 답안을 제출할 수 없습니다."
        />
        <div style={{ padding: 16 }}>
          <Link to={`/student/exams/${safeId}`} className="stu-cta-link">
            시험 상세로 돌아가기
          </Link>
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      title={exam.title}
      description="문항별 답을 입력한 뒤 제출하세요."
      actions={
        <Link
          to={`/student/exams/${safeId}`}
          className="stu-cta-link"
          style={{ fontSize: 14 }}
        >
          뒤로
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loadingQuestions && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="stu-skel" style={{ height: 52, borderRadius: "var(--stu-radius)" }} />
            ))}
          </div>
        )}

        {(error || questionsQ.isError) && (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 10,
              background: "var(--stu-surface-soft)",
              color: "var(--stu-danger)",
              fontSize: 14,
            }}
          >
            {error ?? "문항을 불러오지 못했습니다."}
          </div>
        )}

        {!loadingQuestions && !questionsQ.isError && questions.length === 0 && !error && (
          <EmptyState title="문항이 없습니다." />
        )}

        {!loadingQuestions && questions.length > 0 && (
          <>
            {/* Progress indicator */}
            {(() => {
              const answered = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
              const total = questions.length;
              const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: "var(--stu-text-muted)" }}>입력 진행</span>
                    <span style={{ color: answered === total ? "var(--stu-success-text)" : "var(--stu-primary)" }}>
                      {answered}/{total}문항 ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--stu-surface-soft)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: answered === total ? "var(--stu-success)" : "var(--stu-primary)",
                        transition: "width 0.3s ease, background 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            <div className="stu-section">
              <div
                className="stu-section-header"
                style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}
              >
                문항별 답 입력 (1 ~ {questions.length})
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--stu-space-3)",
                }}
              >
                {questions.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: "var(--stu-radius-md)",
                      background: "var(--stu-surface-soft)",
                      border: "1px solid var(--stu-border)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        minWidth: 32,
                        color: "var(--stu-primary)",
                      }}
                    >
                      {q.number}
                    </span>
                    <span className="stu-muted" style={{ fontSize: 13 }}>
                      배점 {q.score}
                    </span>
                    <input
                      className="stu-input"
                      type="text"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateAnswers((prev) => ({
                          ...prev,
                          [q.id]: val,
                        }));
                      }}
                      placeholder="1~5, O/X, 단답"
                      maxLength={20}
                      style={{ flex: 1, minHeight: 40 }}
                      aria-label={`${q.number}번 답`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="stu-sticky-submit">
              <button
                type="button"
                className="stu-btn stu-btn--primary stu-btn--lg"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ width: "100%" }}
              >
                {submitting ? "제출 중…" : "제출하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </StudentPageShell>
  );
}
