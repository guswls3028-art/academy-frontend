import { lazy, Suspense, useRef, useState } from "react";

import { Button, EmptyState } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { useAdminExam } from "../../hooks/useAdminExam";

const CreateRegularExamModal = lazy(() => import("./CreateRegularExamModal"));
const AnswerKeyRegisterModal = lazy(() => import("../AnswerKeyRegisterModal"));

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onComplete: (examId: number) => void;
  sessionId: number;
  lectureId: number;
};

export default function ExamCreationFlow({
  open,
  onClose,
  onCreated,
  onComplete,
  sessionId,
  lectureId,
}: Props) {
  const createdExamIdRef = useRef<number | null>(null);
  const [followUp, setFollowUp] = useState<{ examId: number; step: "answer" | "print" } | null>(null);
  const examQuery = useAdminExam(followUp?.examId);

  const finish = (examId: number) => {
    setFollowUp(null);
    onClose();
    onComplete(examId);
  };

  return (
    <Suspense fallback={null}>
      {!followUp && (
        <CreateRegularExamModal
          open={open}
          onClose={() => {
            if (createdExamIdRef.current == null) onClose();
          }}
          sessionId={sessionId}
          lectureId={lectureId}
          onCreated={(examId, nextStep) => {
            createdExamIdRef.current = examId;
            onCreated();
            if (nextStep === "answer-key") {
              setFollowUp({ examId, step: "answer" });
            } else {
              finish(examId);
            }
          }}
        />
      )}
      {followUp && !examQuery.data && (
        <AdminModal open onClose={() => finish(followUp.examId)} type="action" width={MODAL_WIDTH.form}>
          <ModalHeader type="action" title="답안 등록 준비" description="새 시험의 설정을 확인하고 있습니다." />
          <ModalBody>
            <EmptyState
              scope="panel"
              tone={examQuery.isError ? "error" : "loading"}
              title={examQuery.isError ? "시험 정보를 불러오지 못했습니다." : "시험 정보를 불러오는 중…"}
              actions={examQuery.isError
                ? <Button intent="secondary" onClick={() => void examQuery.refetch()}>다시 시도</Button>
                : undefined}
            />
          </ModalBody>
          <ModalFooter right={<Button intent="secondary" onClick={() => finish(followUp.examId)}>나중에 등록</Button>} />
        </AdminModal>
      )}
      {followUp && examQuery.data && (
        <AnswerKeyRegisterModal
          key={`${followUp.examId}-${followUp.step}`}
          open
          onClose={() => finish(followUp.examId)}
          onSaved={followUp.step === "answer"
            ? () => setFollowUp({ examId: followUp.examId, step: "print" })
            : undefined}
          flowStep={followUp.step}
          initialTab={followUp.step === "print" ? "omr" : "answer"}
          examId={followUp.examId}
          structureOwnerId={examQuery.data.structure_owner_id ?? followUp.examId}
          canEditQuestions={examQuery.data.can_edit_structure}
        />
      )}
    </Suspense>
  );
}
