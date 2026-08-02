/**
 * HomeworkSetupPanel
 * - setup 탭 화면
 * - 과제별 커트라인 + 과제 대상자 요약
 */

import HomeworkPolicyPanel from "./setup/HomeworkPolicyPanel";
import HomeworkEnrollmentPanel from "./setup/HomeworkEnrollmentPanel";
import AssessmentReadinessStrip, {
  type AssessmentReadinessItem,
} from "@/shared/ui/assessment/AssessmentReadinessStrip";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { useHomeworkAssignments } from "../hooks/useHomeworkAssignments";

export default function HomeworkSetupPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  const { data: homework } = useAdminHomework(homeworkId);
  const assignmentsQuery = useHomeworkAssignments(homeworkId);
  const selectedCount = assignmentsQuery.data?.selected_ids.length ?? 0;
  const maxScore = Number(homework?.max_score ?? homework?.default_max_score ?? 0);
  const cutlineValue = Number(homework?.effective_cutline_value ?? -1);
  const scoringReady = Boolean(
    homework &&
    maxScore > 0 &&
    cutlineValue >= 0 &&
    (homework.effective_cutline_mode !== "PERCENT" || cutlineValue <= 100) &&
    (homework.effective_cutline_mode !== "COUNT" || cutlineValue <= maxScore),
  );
  const dueDate = typeof homework?.meta?.due_date === "string" ? homework.meta.due_date : "";
  const readinessItems: AssessmentReadinessItem[] = [
    {
      id: "basic",
      label: "기본 정보",
      summary: homework?.title ? "과제명 확인됨" : "과제명 확인 필요",
      state: homework?.title ? "ready" : "attention",
      targetId: "assessment-policy",
    },
    {
      id: "scoring",
      label: "점수 정책",
      summary: homework
        ? `${maxScore}점 · 기준 ${cutlineValue}${homework.effective_cutline_mode === "PERCENT" ? "%" : "점"}`
        : "확인 중",
      state: scoringReady ? "ready" : "attention",
      targetId: "assessment-policy",
    },
    {
      id: "deadline",
      label: "제출기한",
      summary: dueDate || "기한 없음",
      state: dueDate ? "ready" : "attention",
      targetId: "assessment-policy",
    },
    {
      id: "audience",
      label: "대상 학생",
      summary: assignmentsQuery.isError
        ? "불러오기 실패"
        : assignmentsQuery.isLoading
          ? "확인 중"
          : `${selectedCount}명 등록`,
      state: !assignmentsQuery.isError && selectedCount > 0 ? "ready" : "attention",
      targetId: "assessment-audience",
    },
  ];

  return (
    <div className="space-y-6">
      <AssessmentReadinessStrip
        title="과제 운영 준비"
        description="제출 전 확인이 필요한 항목을 한 번에 점검합니다."
        items={readinessItems}
      />
      <HomeworkPolicyPanel homeworkId={homeworkId} />
      <HomeworkEnrollmentPanel homeworkId={homeworkId} />
    </div>
  );
}
