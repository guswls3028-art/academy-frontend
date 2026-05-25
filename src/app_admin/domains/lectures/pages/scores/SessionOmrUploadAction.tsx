import { useEffect, useRef, useState } from "react";
import { ChevronDown, Upload, X } from "lucide-react";

import AdminOmrBatchUploadBox from "@admin/domains/submissions/components/AdminOmrBatchUploadBox";
import type { SessionScoreMeta } from "@/shared/api/contracts/sessionScores";
import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

type ExamOption = SessionScoreMeta["exams"][number];

type Props = {
  exams: ExamOption[];
  isEditMode: boolean;
  onRefresh: () => void;
};

export default function SessionOmrUploadAction({ exams, isEditMode, onRefresh }: Props) {
  const [selectedExam, setSelectedExam] = useState<{ examId: number; title: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  if (exams.length === 0) return null;

  const openUpload = () => {
    if (exams.length === 0) {
      feedback.info("시험을 먼저 추가해주세요.");
      return;
    }
    if (exams.length === 1) {
      setSelectedExam({ examId: exams[0].exam_id, title: exams[0].title });
      return;
    }
    setShowPicker((value) => !value);
  };

  const closeUpload = () => {
    setSelectedExam(null);
    onRefresh();
  };

  return (
    <>
      <div ref={pickerRef} className="scores-omr-action">
        <Button
          type="button"
          intent={isEditMode ? "secondary" : "primary"}
          size="md"
          className="scores-omr-primary"
          onClick={openUpload}
          title="OMR 스캔 등록"
          leftIcon={<Upload size={ICON_FOR_BUTTON.md} />}
          rightIcon={exams.length > 1 ? <ChevronDown size={ICON_FOR_BUTTON.md} /> : undefined}
        >
          OMR 스캔 등록
        </Button>
        {showPicker && (
          <div className="scores-omr-picker">
            <div className="scores-omr-picker__title">시험 선택</div>
            {exams.map((exam) => (
              <button
                key={exam.exam_id}
                type="button"
                className="scores-omr-picker__item"
                onClick={() => {
                  setSelectedExam({ examId: exam.exam_id, title: exam.title });
                  setShowPicker(false);
                }}
              >
                <Badge variant="solid" tone="primary" oneChar ariaLabel="시험">시</Badge>
                <span>{exam.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedExam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="omr-upload-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeUpload(); }}
        >
          <div className="scores-omr-modal">
            <div className="scores-omr-modal__header">
              <div>
                <h2 id="omr-upload-modal-title" className="scores-omr-modal__title">
                  <Upload size={ICON_FOR_BUTTON.md} />
                  OMR 스캔 등록
                </h2>
                <div className="scores-omr-modal__exam">{selectedExam.title}</div>
              </div>
              <button
                type="button"
                onClick={closeUpload}
                className="scores-omr-modal__close"
                aria-label="닫기"
              >
                <X size={ICON_FOR_BUTTON.md} />
              </button>
            </div>
            <div className="scores-omr-modal__body">
              <AdminOmrBatchUploadBox examId={selectedExam.examId} onUploaded={onRefresh} />
            </div>
            <div className="scores-omr-modal__footer">
              <Button intent="secondary" size="sm" onClick={closeUpload}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
