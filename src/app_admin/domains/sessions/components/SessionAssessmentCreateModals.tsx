// PATH: src/app_admin/domains/sessions/components/SessionAssessmentCreateModals.tsx
import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button, EmptyState } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { buildAssessmentSearch } from "@/shared/lib/assessmentQueryParams";
import { useAdminExam } from "@admin/domains/exams/hooks/useAdminExam";
import { sessionAssessmentQueryKeys } from "@admin/domains/sessions/api/sessionAssessmentQueries";

const CreateRegularExamModal = lazy(() => import("@admin/domains/exams/components/create/CreateRegularExamModal"));
const CreateHomeworkModal = lazy(() => import("@admin/domains/homework/components/CreateHomeworkModal"));
const AnswerKeyRegisterModal = lazy(() => import("@admin/domains/exams/components/AnswerKeyRegisterModal"));

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
  const [followUp, setFollowUp] = useState<{ examId: number; step: "answer" | "print" } | null>(null);
  const followUpExamQuery = useAdminExam(followUp?.examId);
  const base = `/workspace/lectures/${lectureId}/sessions/${sessionId}`;

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

  const finishExamSetup = () => {
    if (!followUp) return;
    const examId = followUp.examId;
    setFollowUp(null);
    onSelectExam(examId);
  };

  return (
    <Suspense fallback={null}>
      {openCreateExam && (
        <CreateRegularExamModal
          open={openCreateExam}
          onClose={onCloseCreateExam}
          sessionId={sessionId}
          lectureId={lectureId}
          onCreated={(id, nextStep) => {
            invalidateExams();
            invalidateExamsSummary();
            invalidateSessionScores();
            if (nextStep === "answer-key") {
              setFollowUp({ examId: id, step: "answer" });
            } else {
              onSelectExam(id);
            }
          }}
        />
      )}
      {followUp && !followUpExamQuery.data && (
        <AdminModal open onClose={finishExamSetup} type="action" width={MODAL_WIDTH.form}>
          <ModalHeader type="action" title="답안 등록 준비" description="새 시험의 설정을 확인하고 있습니다." />
          <ModalBody>
            <EmptyState
              scope="panel"
              tone={followUpExamQuery.isError ? "error" : "loading"}
              title={followUpExamQuery.isError ? "시험 정보를 불러오지 못했습니다." : "시험 정보를 불러오는 중…"}
              actions={followUpExamQuery.isError ? <Button intent="secondary" onClick={() => void followUpExamQuery.refetch()}>다시 시도</Button> : undefined}
            />
          </ModalBody>
          <ModalFooter right={<Button intent="secondary" onClick={finishExamSetup}>나중에 등록</Button>} />
        </AdminModal>
      )}
      {followUp && followUpExamQuery.data && (
        <AnswerKeyRegisterModal
          key={`${followUp.examId}-${followUp.step}`}
          open
          onClose={finishExamSetup}
          onSaved={followUp.step === "answer"
            ? () => setFollowUp({ examId: followUp.examId, step: "print" })
            : undefined}
          flowStep={followUp.step}
          initialTab={followUp.step === "print" ? "omr" : "answer"}
          examId={followUp.examId}
          structureOwnerId={followUpExamQuery.data.structure_owner_id ?? followUp.examId}
          canEditQuestions={followUpExamQuery.data.can_edit_structure}
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
