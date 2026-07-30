import { useEffect, useRef, useState } from "react";
import { ChevronDown, Upload } from "lucide-react";

import AdminOmrBatchUploadBox from "@admin/domains/submissions/components/AdminOmrBatchUploadBox";
import type { SessionScoreMeta } from "@/shared/api/contracts/sessionScores";
import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

type ExamOption = SessionScoreMeta["exams"][number];

export type SessionOmrUploadTarget = {
  examId: number;
  title: string;
};

type Props = {
  exams: ExamOption[];
  onRefresh: () => void;
  onPrepareOpen?: () => boolean | Promise<boolean>;
  disabled?: boolean;
};

type SessionOmrUploadModalProps = {
  target: SessionOmrUploadTarget | null;
  onClose: () => void;
  onRefresh: () => void;
};

export function SessionOmrUploadModal({
  target,
  onClose,
  onRefresh,
}: SessionOmrUploadModalProps) {
  if (target == null) return null;

  const closeUpload = () => {
    onClose();
    onRefresh();
  };

  return (
    <AdminModal open onClose={closeUpload} type="action" width={640} noMinimize>
      <ModalHeader
        type="action"
        title="OMR 스캔 등록"
        description={target.title}
        noIcon
      />
      <ModalBody>
        <div className="scores-omr-modal__body">
          <AdminOmrBatchUploadBox examId={target.examId} onUploaded={onRefresh} />
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <Button intent="secondary" size="sm" onClick={closeUpload}>
            닫기
          </Button>
        }
      />
    </AdminModal>
  );
}

export default function SessionOmrUploadAction({
  exams,
  onRefresh,
  onPrepareOpen,
  disabled = false,
}: Props) {
  const [selectedExam, setSelectedExam] = useState<SessionOmrUploadTarget | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!disabled) return;
    setShowPicker(false);
    setSelectedExam(null);
  }, [disabled]);

  useEffect(() => {
    if (!showPicker) return;
    const clickHandler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPicker(false);
    };
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [showPicker]);

  if (exams.length === 0) return null;

  const openUpload = async () => {
    if (disabled || isPreparing) return;
    if (exams.length === 0) {
      feedback.info("시험을 먼저 추가해주세요.");
      return;
    }
    setIsPreparing(true);
    try {
      if (onPrepareOpen && !await onPrepareOpen()) return;
    } finally {
      setIsPreparing(false);
    }
    if (exams.length === 1) {
      setSelectedExam({ examId: exams[0].exam_id, title: exams[0].title });
      return;
    }
    setShowPicker((value) => !value);
  };

  return (
    <>
      <div ref={pickerRef} className="scores-omr-action">
        <Button
          type="button"
          intent="primary"
          size="md"
          className="scores-omr-primary"
          disabled={disabled || isPreparing}
          onClick={() => void openUpload()}
          title={disabled ? "입력 중인 점수를 먼저 저장하거나 복구 여부를 확인해 주세요." : "OMR 스캔 등록"}
          leftIcon={<Upload size={ICON_FOR_BUTTON.md} />}
          rightIcon={exams.length > 1 ? <ChevronDown size={ICON_FOR_BUTTON.md} /> : undefined}
          aria-haspopup={exams.length > 1 ? "listbox" : undefined}
          aria-expanded={exams.length > 1 ? showPicker : undefined}
        >
          OMR 스캔 등록
        </Button>
        {showPicker && (
          <div className="scores-omr-picker" role="listbox" aria-label="OMR 시험 선택">
            <div className="scores-omr-picker__title">시험 선택</div>
            {exams.map((exam) => (
              <button
                key={exam.exam_id}
                type="button"
                className="scores-omr-picker__item"
                role="option"
                aria-selected={selectedExam?.examId === exam.exam_id}
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

      <SessionOmrUploadModal
        target={selectedExam}
        onClose={() => setSelectedExam(null)}
        onRefresh={onRefresh}
      />
    </>
  );
}
