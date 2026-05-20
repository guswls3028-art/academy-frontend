// src/app_student/domains/exams/pages/ExamSubmitPage.tsx
/**
 * 시험 답안 입력 페이지 — 문항별 1, 2, 3, 4, 5 입력 후 제출
 */
import { useState, useEffect, useCallback, useMemo } from "react";
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
import styles from "./ExamSubmitPage.module.css";

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
  const questions = useMemo(() => questionsQ.data ?? [], [questionsQ.data]);
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
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const totalQuestions = questions.length;
  const progressPct = totalQuestions > 0
    ? clampPercent(Math.round((answeredCount / totalQuestions) * 100))
    : 0;
  const isComplete = totalQuestions > 0 && answeredCount === totalQuestions;

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
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail;
      setError(detail ?? "제출에 실패했습니다. 다시 시도해 주세요.");
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
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.loadingTitle}`} />
          <div className={`stu-skel ${styles.loadingTrack}`} />
          <div className={`stu-skel ${styles.loadingQuestion}`} />
          <div className={`stu-skel ${styles.loadingQuestion}`} />
          <div className={`stu-skel ${styles.loadingQuestion}`} />
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
        <div className={styles.emptyActionPad}>
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
        <div className={styles.emptyActionPad}>
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
          className={`stu-cta-link ${styles.backAction}`}
        >
          뒤로
        </Link>
      }
    >
      <div className={styles.pageStack}>
        {loadingQuestions && (
          <div className={styles.loadingStack}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`stu-skel ${styles.loadingQuestion}`} />
            ))}
          </div>
        )}

        {(error || questionsQ.isError) && (
          <div
            role="alert"
            className={styles.alert}
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
            <div className={styles.progressStack}>
              <div className={styles.progressHeader}>
                <span className={styles.progressLabel}>입력 진행</span>
                <span className={styles.progressValue} data-complete={isComplete}>
                  {answeredCount}/{totalQuestions}문항 ({progressPct}%)
                </span>
              </div>
              <svg
                className={styles.progressBar}
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect width="100" height="6" rx="3" fill="var(--stu-surface-soft)" />
                <rect
                  className={styles.progressFill}
                  width={progressPct}
                  height="6"
                  rx="3"
                  fill={isComplete ? "var(--stu-success)" : "var(--stu-primary)"}
                />
              </svg>
            </div>

            <div className="stu-section">
              <div className={`stu-section-header ${styles.sectionHeader}`}>
                문항별 답 입력 (1 ~ {questions.length})
              </div>
              <div className={styles.answerList}>
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className={styles.answerRow}
                  >
                    <span className={styles.questionNumber}>
                      {q.number}
                    </span>
                    <span className={`stu-muted ${styles.scoreLabel}`}>
                      배점 {q.score}
                    </span>
                    <input
                      className={`stu-input ${styles.answerInput}`}
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
                      aria-label={`${q.number}번 답`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="stu-sticky-submit">
              <button
                type="button"
                className={`stu-btn stu-btn--primary stu-btn--lg ${styles.submitButton}`}
                onClick={handleSubmit}
                disabled={submitting}
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

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}
