// PATH: src/shared/ui/modal/ModalTimeSection.tsx
// 모달 SSOT — 시간 섹션: 기본값 사용 | 직접선택(전역 TimeRangeInput/타임스크롤)

import { TimeRangeInput } from "@/shared/ui/time";
import ModalOptionRow from "./ModalOptionRow";
import { ModalOptionRowWithContent } from "./ModalOptionRow";

export interface ModalTimeSectionProps {
  name?: string;
  useDefault: boolean;
  onUseDefaultChange: (use: boolean) => void;
  customTime: string;
  onCustomTimeChange: (value: string) => void;
  showDefaultOption: boolean;
  /** 기본값이 없을 때 "직접선택" 행 없이 내용만 표시 (클리닉 등) */
  inlineOnly?: boolean;
  disableDefaultOption?: boolean;
  defaultLabel?: string;
  disabled?: boolean;
}

export default function ModalTimeSection({
  name = "timeMode",
  useDefault,
  onUseDefaultChange,
  customTime,
  onCustomTimeChange,
  showDefaultOption,
  inlineOnly = false,
  disableDefaultOption = false,
  defaultLabel = "미설정",
  disabled = false,
}: ModalTimeSectionProps) {
  const showCustom = !useDefault || disableDefaultOption;

  const timeContent = (
    <div role="group" aria-label="시간 선택">
      <TimeRangeInput
        value={customTime}
        onChange={onCustomTimeChange}
        disabled={disabled}
        startLabel="시작"
        endLabel="종료"
        startPlaceholder="시작"
        endPlaceholder="종료"
      />
    </div>
  );

  return (
    <div>
      <div className="modal-section-label">시간</div>
      <div className="flex flex-col gap-2">
        {showDefaultOption && (
          <ModalOptionRow
            name={name}
            value="default"
            checked={useDefault && !disableDefaultOption}
            onChange={() => onUseDefaultChange(true)}
            disabled={disableDefaultOption}
            primaryLabel="강의 기본값 사용"
            secondaryLabel={defaultLabel}
          />
        )}
        {showDefaultOption || !inlineOnly ? (
          <ModalOptionRowWithContent
            name={name}
            value="custom"
            checked={showCustom}
            onChange={() => onUseDefaultChange(false)}
            primaryLabel="직접선택"
            showContent={showCustom}
            content={timeContent}
          />
        ) : (
          timeContent
        )}
      </div>
    </div>
  );
}
