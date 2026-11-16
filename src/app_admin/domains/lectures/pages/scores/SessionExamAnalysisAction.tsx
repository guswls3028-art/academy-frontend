import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChartColumn } from "lucide-react";

import { buildAssessmentSearch, EXAM_ANALYSIS_ANCHOR } from "@/shared/lib/assessmentQueryParams";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalHeader } from "@/shared/ui/modal";

type Props = {
  exams: readonly { exam_id: number; title: string }[];
  lectureId: number;
  sessionId: number;
  disabled: boolean;
  onBeforeNavigate: () => Promise<boolean>;
};

export default function SessionExamAnalysisAction({ exams, lectureId, sessionId, disabled, onBeforeNavigate }: Props) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const opening = useRef(false);

  const openAnalysis = async (examId: number) => {
    if (disabled || opening.current || !Number.isFinite(lectureId)) return;
    opening.current = true;
    setPickerOpen(false);
    try {
      if (!await onBeforeNavigate()) return;
      navigate({
        pathname: `/workspace/lectures/${lectureId}/sessions/${sessionId}/exams`,
        search: buildAssessmentSearch("exam", examId) + "&examTab=results",
        hash: `#${EXAM_ANALYSIS_ANCHOR}`,
      });
    } finally {
      opening.current = false;
    }
  };

  return (
    <>
      <Button
        type="button"
        intent="secondary"
        size="sm"
        leftIcon={<ChartColumn size={ICON_FOR_BUTTON.sm} />}
        disabled={disabled}
        aria-haspopup={exams.length > 1 ? "dialog" : undefined}
        onClick={() => {
          if (exams.length === 1) void openAnalysis(exams[0].exam_id);
          else setPickerOpen(true);
        }}
      >
        시험 성적 분석
      </Button>
      {pickerOpen && (
        <AdminModal open onClose={() => setPickerOpen(false)} type="inspect" width={440} noMinimize>
          <ModalHeader title="분석할 시험 선택" type="inspect" />
          <ModalBody>
            <div className="grid gap-2">
              {exams.map((exam) => (
                <Button
                  key={exam.exam_id}
                  type="button"
                  intent="secondary"
                  size="md"
                  className="min-w-0 justify-start whitespace-normal text-left"
                  disabled={disabled}
                  onClick={() => void openAnalysis(exam.exam_id)}
                >
                  {exam.title}
                </Button>
              ))}
            </div>
          </ModalBody>
        </AdminModal>
      )}
    </>
  );
}
