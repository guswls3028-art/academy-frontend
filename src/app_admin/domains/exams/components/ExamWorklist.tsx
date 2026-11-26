import AssessmentWorklist, { type WorkStage } from "@/shared/ui/assessment/AssessmentWorklist";
import type { WorkSelection } from "@/shared/ui/assessment/useAssessmentWorklist";
import { assessmentMaterialStatus } from "@/shared/ui/assessment/assessmentMaterialStatus";
import { useExamEnrollmentRows } from "../hooks/useExamEnrollments";
import type { Exam } from "../types";
import ExamSetupPanel from "../panels/setup/ExamSetupPanel";
import ExamEnrollmentPanel from "../panels/setup/ExamEnrollmentPanel";
import ExamLectureAssignmentsPanel from "../panels/setup/ExamLectureAssignmentsPanel";
import ExamBulkActionsPanel from "../panels/setup/ExamBulkActionsPanel";
import ExamAssetsPanel from "../panels/ExamAssetsPanel";
import ExamSubmissionsPanel from "../panels/ExamSubmissionsPanel";
import ExamResultsViewerPanel from "../panels/ExamResultsViewerPanel";

export default function ExamWorklist({ exam, sessionId, lectureId, selection, select, wrongCompletionOnly, focusAnalysis }: {
  exam: Exam;
  sessionId?: number | null;
  lectureId: number;
  selection: WorkSelection;
  select: (next: WorkSelection) => void;
  wrongCompletionOnly: boolean;
  focusAnalysis: boolean;
}) {
  const examId = exam.id;
  const enrollment = useExamEnrollmentRows(examId, sessionId ?? undefined);
  const audience = enrollment.isPending ? "대상 학생 확인 중"
    : !enrollment.isError && Array.isArray(enrollment.data?.items) ? `응시 대상 ${enrollment.data.items.filter(row => row.is_selected).length}명` : "대상 학생 조회 실패";
  const openPolicy = () => select({ step: "policy", action: "settings" });
  const openReadinessItem = (target: string) => {
    if (target === "assessment-audience") select({ step: "audience", action: "students" });
    else if (target === "assessment-answer-key") select({ step: "policy", action: "answers" });
    else openPolicy();
  };
  const results = <ExamResultsViewerPanel examId={examId} sessionId={sessionId ?? undefined}
    wrongCompletionOnly={wrongCompletionOnly} focusAnalysis={selection.action === "analysis"}
    initialLectureId={focusAnalysis ? lectureId : undefined} onOpenSetup={action => select({ step: "policy", action })} />;
  const stages: WorkStage[] = [
    { id: "audience", title: "시험 대상", summary: audience + " · 강의별 차시와 귀가 기준", actions: [
      { id: "students", label: "대상 학생", content: <ExamEnrollmentPanel examId={examId} /> },
      { id: "lectures", label: "강의·차시 연결", content: <ExamLectureAssignmentsPanel examId={examId} maxScore={exam.max_score} /> },
    ] },
    { id: "materials", title: "시험 자료", summary: assessmentMaterialStatus(exam.segmentation_status), actions: [
      { id: "source", label: "시험지·해설 관리", content: <ExamAssetsPanel examId={examId} /> },
    ] },
    { id: "policy", title: "문항·채점 기준", summary: `만점 ${exam.max_score}점 · 합격 ${exam.pass_score}점 · 학생 성적 ${exam.student_results_published ? "공개" : "비공개"}`, actions: [
      { id: "settings", label: "점수·공개 설정", content: <ExamSetupPanel key="settings" examId={examId} section="policy" onNavigate={openReadinessItem} /> },
      { id: "answers", label: "문항·정답표", content: <ExamSetupPanel key="answers" examId={examId} section="answers" /> },
    ] },
    { id: "submissions", title: "답안 제출 확인", summary: "학생별 제출 현황 · OMR 업로드 내역", actions: [
      { id: "submissions", label: "제출 현황 보기", content: <ExamSubmissionsPanel examId={examId} sessionId={sessionId} /> },
    ] },
    { id: "results", title: "채점·결과", summary: "학생별 채점표 · 점수 분포 · 문항별 정답률", actions: [
      { id: "results", label: "채점·학생별 결과", content: results },
      { id: "analysis", label: "시험 성적 분석", content: results },
      { id: "regrade", label: "성적 입력·재채점", content: <ExamBulkActionsPanel examId={examId} lectureId={lectureId} sessionId={sessionId ?? 0} /> },
    ] },
  ];
  return <AssessmentWorklist label="시험 업무 흐름" stages={stages} selection={selection} select={select} />;
}
