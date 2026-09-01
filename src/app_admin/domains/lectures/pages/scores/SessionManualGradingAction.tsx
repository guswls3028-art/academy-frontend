import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ClipboardCheck } from "lucide-react";

import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";

export type SessionManualGradingTarget = {
  examId: number;
  title: string;
  gradingMode: "written" | "mixed";
  manualGradingMethod: "correctness" | "score";
};

type Props = {
  exams: SessionManualGradingTarget[];
  onSelect: (exam: SessionManualGradingTarget) => void;
  disabled?: boolean;
};

export default function SessionManualGradingAction({
  exams,
  onSelect,
  disabled = false,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const label = useMemo(() => {
    const methods = new Set(exams.map((exam) => exam.manualGradingMethod));
    if (methods.size === 1 && methods.has("score")) return "서술형 점수 입력";
    if (methods.size === 1 && methods.has("correctness")) return "정오표 입력";
    return "직접 채점";
  }, [exams]);

  useEffect(() => {
    if (!disabled) return;
    setShowPicker(false);
  }, [disabled]);

  useEffect(() => {
    if (!showPicker) return;
    const clickHandler = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPicker(false);
    };
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [showPicker]);

  if (exams.length === 0) return null;

  const openManualGrading = () => {
    if (disabled) return;
    if (exams.length === 1) {
      onSelect(exams[0]);
      return;
    }
    setShowPicker((value) => !value);
  };

  return (
    <div ref={pickerRef} className="scores-manual-action">
      <Button
        type="button"
        intent="secondary"
        size="md"
        className="scores-manual-primary"
        disabled={disabled}
        onClick={openManualGrading}
        title={disabled ? "입력 중인 점수를 먼저 저장하거나 복구 여부를 확인해 주세요." : label}
        leftIcon={<ClipboardCheck size={ICON_FOR_BUTTON.md} />}
        rightIcon={exams.length > 1 ? <ChevronDown size={ICON_FOR_BUTTON.md} /> : undefined}
        aria-haspopup={exams.length > 1 ? "listbox" : undefined}
        aria-expanded={exams.length > 1 ? showPicker : undefined}
      >
        {label}
      </Button>
      {showPicker && (
        <div className="scores-omr-picker scores-manual-picker" role="listbox" aria-label="직접 채점 시험 선택">
          <div className="scores-omr-picker__title">직접 채점할 시험 선택</div>
          {exams.map((exam) => (
            <button
              key={exam.examId}
              type="button"
              className="scores-omr-picker__item"
              role="option"
              aria-selected={false}
              onClick={() => {
                onSelect(exam);
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
  );
}
