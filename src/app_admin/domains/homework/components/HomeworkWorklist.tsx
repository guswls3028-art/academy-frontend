import AssessmentWorklist, { type WorkStage } from "@/shared/ui/assessment/AssessmentWorklist";
import type { WorkSelection } from "@/shared/ui/assessment/useAssessmentWorklist";
import { assessmentMaterialStatus } from "@/shared/ui/assessment/assessmentMaterialStatus";
import HomeworkInspectionEntry from "@/shared/ui/assessment/HomeworkInspectionEntry";
import type { AdminHomeworkDetail } from "../api/adminHomework";
import HomeworkEnrollmentPanel from "../panels/setup/HomeworkEnrollmentPanel";
import HomeworkSetupPanel from "../panels/HomeworkSetupPanel";
import HomeworkAssetsPanel from "../panels/HomeworkAssetsPanel";
import HomeworkSubmissionsPanel from "../panels/HomeworkSubmissionsPanel";
import HomeworkResultsPanel from "../panels/HomeworkResultsPanel";

export default function HomeworkWorklist({ homework, audience, selection, select }: {
  homework: AdminHomeworkDetail;
  audience: string;
  selection: WorkSelection;
  select: (next: WorkSelection) => void;
}) {
  const homeworkId = homework.id;
  const maxScore = homework.max_score ?? homework.default_max_score;
  const inspect = homework.homework_type !== "template" && homework.session_id
    ? <HomeworkInspectionEntry sessionId={homework.session_id} homeworkId={homeworkId} title={homework.title} />
    : null;
  const due = homework.meta?.due_date;
  const stages: WorkStage[] = [
    { id: "audience", title: "과제 대상", summary: audience, actions: [
      { id: "students", label: "대상 학생", content: <HomeworkEnrollmentPanel homeworkId={homeworkId} /> },
    ] },
    { id: "materials", title: "과제 자료", summary: homework.source_filename || "워크북 원본 · 문항과 해설", status: assessmentMaterialStatus(homework.source_status), actions: [
      { id: "source", label: "워크북·문항 관리", content: <HomeworkAssetsPanel homeworkId={homeworkId} /> },
    ] },
    { id: "policy", title: "제출기한·평가 기준", summary: [typeof due === "string" && due ? "제출기한 " + due : "기한 없이 운영",
      maxScore == null ? "만점 확인 필요" : `만점 ${maxScore}점`].join(" · "), actions: [
      { id: "settings", label: "기한·점수 설정", content: <HomeworkSetupPanel homeworkId={homeworkId} policyOnly
        onNavigate={target => select(target === "assessment-audience" ? { step: "audience", action: "students" } : { step: "policy", action: "settings" })} /> },
    ] },
    { id: "submissions", title: "과제 제출 확인", summary: "제출물 검수 · 미제출 안내 · 과제 검사", tools: inspect, actions: [
      { id: "submissions", label: "제출 현황 보기", content: <HomeworkSubmissionsPanel homeworkId={homeworkId} /> },
    ] },
    { id: "results", title: "평가·결과", summary: "학생별 결과 · 점수와 통과 여부", tools: inspect, actions: [
      { id: "results", label: "학생별 결과 보기", content: <HomeworkResultsPanel homeworkId={homeworkId} /> },
    ] },
  ];
  return <AssessmentWorklist label="과제 업무 흐름" stages={stages} selection={selection} select={select} />;
}
