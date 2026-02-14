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
  disableDefaultOption = false,
  defaultLabel = "미설정",
  disabled = false,
}: ModalTimeSectionProps) {
  const showCustom = !useDefault || disableDefaultOption;

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
        <ModalOptionRowWithContent
          name={name}
          value="custom"
          checked={showCustom}
          onChange={() => onUseDefaultChange(false)}
          primaryLabel="직접선택"
          showContent={showCustom}
          content={
            <div role="group" aria-label="시간 선택">
              <TimeRangeInput
                value={customTime}
                onChange={onCustomTimeChange}
                disabled={disabled}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
