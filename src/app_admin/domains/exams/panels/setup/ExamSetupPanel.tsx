import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
import AssessmentReadinessStrip, {
  type AssessmentReadinessItem,
} from "@/shared/ui/assessment/AssessmentReadinessStrip";
import ExamPolicyPanel from "./ExamPolicyPanel";
import ExamEnrollmentPanel from "./ExamEnrollmentPanel";
import ExamBulkActionsPanel from "./ExamBulkActionsPanel";
import { useAdminExam } from "../../hooks/useAdminExam";
import { useExamEnrollmentRows } from "../../hooks/useExamEnrollments";
import { fetchQuestionsByExam } from "../../api/question.api";
import { adminExamsQueryKeys } from "../../queryKeys";

export default function ExamSetupPanel({ examId }: { examId: number }) {
  const { sessionId: sessionIdFromPath, lectureId: lectureIdFromPath } = useLectureSessionParams();
  const [sp] = useSearchParams();
  const sessionIdFromQuery = Number(sp.get("session_id"));
  const sessionId = Number.isFinite(sessionIdFromQuery) && sessionIdFromQuery > 0
    ? sessionIdFromQuery
    : (sessionIdFromPath ?? 0);
  const lectureId = lectureIdFromPath ?? 0;

  const hasSession = Number.isFinite(sessionId) && sessionId > 0;
  const { data: exam } = useAdminExam(examId);
  const enrollmentQuery = useExamEnrollmentRows(
    hasSession ? examId : undefined,
    hasSession ? sessionId : undefined,
  );
  const questionsQuery = useQuery({
    queryKey: adminExamsQueryKeys.examQuestions(examId),
    queryFn: () => fetchQuestionsByExam(examId).then((response) => response.data),
    enabled: examId > 0,
  });
  const questions = questionsQuery.data ?? [];

  const selectedCount = enrollmentQuery.data?.items?.filter((row) => row.is_selected).length ?? 0;
  const scoreReady = Boolean(
    exam && exam.max_score > 0 && exam.pass_score >= 0 && exam.pass_score <= exam.max_score,
  );
  const gradingReady = Boolean(
    exam && (exam.grading_mode !== "mixed" || exam.choice_question_count > 0),
  );
  const readinessItems: AssessmentReadinessItem[] = [
    {
      id: "policy",
      label: "점수 정책",
      summary: exam ? `${exam.max_score}점 · 합격 ${exam.pass_score}점` : "확인 중",
      state: scoreReady ? "ready" : "attention",
      targetId: "assessment-policy",
    },
    {
      id: "grading",
      label: "채점 방식",
      summary: exam
        ? exam.grading_mode === "choice"
          ? "OMR 자동 채점"
          : exam.grading_mode === "mixed"
            ? "OMR + 직접 채점"
            : exam.manual_grading_method === "correctness"
              ? "직접 정오 입력"
              : "직접 점수 입력"
        : "확인 중",
      state: gradingReady ? "ready" : "attention",
      targetId: "assessment-policy",
    },
    {
      id: "questions",
      label: "문항·답안",
      summary: questionsQuery.isError
        ? "불러오기 실패"
        : questions.length > 0
          ? `${questions.length}개 문항`
          : "등록 필요",
      state: !questionsQuery.isError && questions.length > 0 ? "ready" : "attention",
      targetId: "assessment-answer-key",
    },
    {
      id: "audience",
      label: "대상 학생",
      summary: enrollmentQuery.isError
        ? "불러오기 실패"
        : enrollmentQuery.isLoading
          ? "확인 중"
          : `${selectedCount}명 등록`,
      state: !enrollmentQuery.isError && selectedCount > 0 ? "ready" : "attention",
      targetId: "assessment-audience",
    },
  ];

  return (
    <div className="space-y-6">
      {hasSession && (
        <AssessmentReadinessStrip
          title="시험 운영 준비"
          description="확인이 필요한 항목을 선택하면 해당 설정으로 바로 이동합니다."
          items={readinessItems}
        />
      )}
      <ExamPolicyPanel examId={examId} lectureId={lectureId} sessionId={sessionId} />
      {hasSession && <ExamEnrollmentPanel examId={examId} />}

      <ExamBulkActionsPanel examId={examId} lectureId={lectureId} sessionId={sessionId} />
    </div>
  );
}
