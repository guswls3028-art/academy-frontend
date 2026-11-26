import { useState } from "react";
import { Button } from "@/shared/ui/ds";
import SessionAnswerKeyModal from "./SessionAnswerKeyModal";
import AssessmentWorklist, { type WorkStage } from "@/shared/ui/assessment/AssessmentWorklist";
import type { WorkSelection } from "@/shared/ui/assessment/useAssessmentWorklist";
import { assessmentMaterialStatus } from "@/shared/ui/assessment/assessmentMaterialStatus";
import type { Exam } from "../types";
import ExamSetupPanel from "../panels/setup/ExamSetupPanel";
import ExamEnrollmentPanel from "../panels/setup/ExamEnrollmentPanel";
import ExamLectureAssignmentsPanel from "../panels/setup/ExamLectureAssignmentsPanel";
import ExamBulkActionsPanel from "../panels/setup/ExamBulkActionsPanel";
import ExamAssetsPanel from "../panels/ExamAssetsPanel";
import ExamSubmissionsPanel from "../panels/ExamSubmissionsPanel";
import ExamResultsViewerPanel from "../panels/ExamResultsViewerPanel";

export default function ExamWorklist({ exam, audience, sessionId, lectureId, selection, select, wrongCompletionOnly, focusAnalysis }: {
  exam: Exam;
  audience: string;
  sessionId?: number | null;
  lectureId: number;
  selection: WorkSelection;
  select: (next: WorkSelection) => void;
  wrongCompletionOnly: boolean;
  focusAnalysis: boolean;
}) {
  const examId = exam.id;
  const [printOpen, setPrintOpen] = useState(false);
  const openPolicy = () => select({ step: "policy", action: "settings" });
  const openReadinessItem = (target: string) => {
    if (target === "assessment-audience") select({ step: "audience", action: "students" });
    else if (target === "assessment-answer-key") select({ step: "policy", action: "answers" });
    else openPolicy();
  };
  const results = <ExamResultsViewerPanel examId={examId} sessionId={sessionId ?? undefined}
    wrongCompletionOnly={wrongCompletionOnly} focusAnalysis={selection.action === "analysis"}
    initialLectureId={focusAnalysis ? lectureId : undefined} onOpenSetup={action => select({ step: "policy", action })} />;
  const submissions = <ExamSubmissionsPanel examId={examId} sessionId={sessionId} focusLedger={selection.action === "ledger"} />;
  const stages: WorkStage[] = [
    { id: "audience", title: "시험 대상", summary: audience + " · 강의별 차시와 귀가 기준", actions: [
      { id: "students", label: "대상 학생", content: <ExamEnrollmentPanel examId={examId} /> },
      { id: "lectures", label: "강의·차시 연결", content: <ExamLectureAssignmentsPanel examId={examId} maxScore={exam.max_score} /> },
    ] },
    { id: "materials", title: "시험 자료", summary: exam.source_filename || "시험지 원본 · 해설 · OMR 답안지", status: assessmentMaterialStatus(exam.segmentation_status),
      tools: <Button type="button" size="sm" intent="secondary" onClick={() => setPrintOpen(true)}>OMR 답안지</Button>, actions: [
      { id: "source", label: "시험지·해설 관리", content: <ExamAssetsPanel examId={examId} /> },
    ] },
    { id: "policy", title: "문항·채점 기준", summary: `만점 ${exam.max_score}점 · 합격 ${exam.pass_score}점`,
      status: { label: exam.student_results_published ? "성적 공개" : "성적 비공개", tone: "neutral" }, actions: [
      { id: "settings", label: "점수·공개 설정", content: <ExamSetupPanel key="settings" examId={examId} section="policy" onNavigate={openReadinessItem} /> },
      { id: "answers", label: "문항·정답표", content: <ExamSetupPanel key="answers" examId={examId} section="answers" /> },
    ] },
    { id: "submissions", title: "답안 제출 확인", summary: "학생별 제출 현황 · OMR 업로드 내역", actions: [
      { id: "submissions", label: "제출 현황 보기", content: submissions },
      { id: "ledger", label: "OMR 업로드 내역", content: submissions },
    ] },
    { id: "results", title: "채점·결과", summary: "학생별 채점표 · 점수 분포 · 문항별 정답률",
      tools: <Button type="button" size="sm" intent="secondary" onClick={openPolicy}>성적 공개 설정</Button>, actions: [
      { id: "results", label: "채점·학생별 결과", content: results },
      { id: "analysis", label: "시험 성적 분석", content: results },
      { id: "regrade", label: "성적 입력·재채점", content: <ExamBulkActionsPanel examId={examId} lectureId={lectureId} sessionId={sessionId ?? 0} /> },
    ] },
  ];
  return <>
    <AssessmentWorklist label="시험 업무 흐름" stages={stages} selection={selection} select={select} />
    {printOpen && <SessionAnswerKeyModal open onClose={() => setPrintOpen(false)} initialTab="omr"
      examId={examId} structureOwnerId={exam.structure_owner_id ?? examId} canEditQuestions={exam.can_edit_structure}
      lectureId={lectureId} sessionId={sessionId ?? 0} />}
  </>;
}
