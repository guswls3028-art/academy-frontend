// PATH: src/features/lectures/pages/assignments/SessionAssignmentsEntryPage.tsx
// 차시(세션) 과제 탭 — SessionAssessmentWorkspace(homework) 래퍼

import SessionAssessmentWorkspace from "@/features/sessions/components/SessionAssessmentWorkspace";

type Props = {
  lectureId: number;
  sessionId: number;
};

export default function SessionAssignmentsEntryPage(_props: Props) {
  return <SessionAssessmentWorkspace mode="homework" />;
}
