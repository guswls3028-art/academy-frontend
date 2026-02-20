// src/student/domains/exams/pages/ExamSubmitPage.tsx
/**
 * 시험 답안 입력 페이지 — 문항별 1, 2, 3, 4, 5 입력 후 제출
 */
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useStudentExam } from "@/student/domains/exams/hooks/useStudentExams";
import {
  fetchStudentExamQuestions,
  submitStudentExamAnswers,
  type StudentExamQuestion,
} from "@/student/domains/exams/api/exams";

export default function ExamSubmitPage() {
  const { examId } = useParams();
  const safeId = Number(examId);
  const navigate = useNavigate();

  const examQ = useStudentExam(Number.isFinite(safeId) ? safeId : undefined);
  const [questions, setQuestions] = useState<StudentExamQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(safeId)) return;
    setLoadingQuestions(true);
    fetchStudentExamQuestions(safeId)
      .then((list) => {
        setQuestions(list);
        setAnswers((prev) => {
          const next = { ...prev };
          list.forEach((q) => {
            if (next[q.id] === undefined) next[q.id] = "";
          });
          return next;
        });
      })
      .catch(() => setError("문항을 불러오지 못했습니다."))
      .finally(() => setLoadingQuestions(false));
  }, [safeId]);

  const handleSubmit = async () => {
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
    setError(null);
    setSubmitting(true);
    try {
      await submitStudentExamAnswers(safeId, payload);
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
        <EmptyState title="시험 ID가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  if (examQ.isLoading || !examQ.data) {
    return (
      <StudentPageShell title="시험 입력" description="불러오는 중...">
        <div className="stu-muted" style={{ padding: 16 }}>
          불러오는 중…
        </div>
      </StudentPageShell>
    );
  }

  const exam = examQ.data;

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
          <div className="stu-muted" style={{ padding: 8 }}>
            문항 불러오는 중…
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 10,
              background: "var(--stu-surface-soft)",
              color: "var(--stu-danger, #c00)",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {!loadingQuestions && questions.length === 0 && !error && (
          <EmptyState title="문항이 없습니다." />
        )}

        {!loadingQuestions && questions.length > 0 && (
          <>
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
                      borderRadius: 10,
                      background: "var(--stu-surface-soft)",
                      border: "1px solid var(--border-divider, #eee)",
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
                      type="text"
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="1~5, O/X, 단답"
                      maxLength={20}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border-divider, #ddd)",
                        fontSize: 15,
                      }}
                      aria-label={`${q.number}번 답`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                border: "none",
                background: "var(--stu-primary)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? "제출 중…" : "제출하기"}
            </button>
          </>
        )}
      </div>
    </StudentPageShell>
  );
}
