// PATH: src/app_admin/domains/sessions/components/SessionAssessmentCreateModals.tsx
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { buildAssessmentSearch } from "@/shared/lib/assessmentQueryParams";
import { sessionAssessmentQueryKeys } from "@admin/domains/sessions/api/sessionAssessmentQueries";

const CreateRegularExamModal = lazy(() => import("@admin/domains/exams/components/create/CreateRegularExamModal"));
const CreateHomeworkModal = lazy(() => import("@admin/domains/homework/components/CreateHomeworkModal"));

type Props = {
  lectureId: number;
  sessionId: number;
  openCreateExam: boolean;
  onCloseCreateExam: () => void;
  openCreateHomework: boolean;
  onCloseCreateHomework: () => void;
};

export default function SessionAssessmentCreateModals({
  lectureId,
  sessionId,
  openCreateExam,
  onCloseCreateExam,
  openCreateHomework,
  onCloseCreateHomework,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

  const invalidateExams = () => qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.exams(sessionId) });
  const invalidateExamsSummary = () => qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.examsSummary(sessionId) });
  const invalidateSessionScores = () => qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
  const invalidateHomeworks = () => qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.homeworks(sessionId) });

  const onSelectExam = (examId: number) => {
    navigate({ pathname: `${base}/exams`, search: buildAssessmentSearch("exam", examId) });
  };

  const onSelectHomework = (homeworkId: number) => {
    navigate({ pathname: `${base}/assignments`, search: buildAssessmentSearch("homework", homeworkId) });
  };

  return (
    <Suspense fallback={null}>
      {openCreateExam && (
        <CreateRegularExamModal
          open={openCreateExam}
          onClose={onCloseCreateExam}
          sessionId={sessionId}
          lectureId={lectureId}
          onCreated={async (id) => {
            invalidateExams();
            invalidateExamsSummary();
            invalidateSessionScores();
            onSelectExam(id);
          }}
        />
      )}
      {openCreateHomework && (
        <CreateHomeworkModal
          open={openCreateHomework}
          onClose={onCloseCreateHomework}
          sessionId={sessionId}
          onCreated={async (id) => {
            invalidateHomeworks();
            invalidateSessionScores();
            onSelectHomework(id);
          }}
        />
      )}
    </Suspense>
  );
}
