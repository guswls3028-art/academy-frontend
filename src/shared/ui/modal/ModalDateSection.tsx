// PATH: src/shared/ui/modal/ModalDateSection.tsx
// 모달 SSOT — 날짜 섹션: 기본값 사용 | 직접선택(전역 DatePicker)

import { DatePicker } from "@/shared/ui/date";
import ModalOptionRow from "./ModalOptionRow";
import { ModalOptionRowWithContent } from "./ModalOptionRow";

export interface ModalDateSectionProps {
  /** 라디오 name */
  name?: string;
  /** 기본값 사용 선택 여부 */
  useDefault: boolean;
  onUseDefaultChange: (use: boolean) => void;
  /** 직접선택 시 값 */
  customDate: string;
  onCustomDateChange: (value: string) => void;
  /** 기본값 옵션 표시 여부 (예: 보강 시 숨김) */
  showDefaultOption: boolean;
  /** 기본값 옵션 비활성화 (예: 보강 시) */
  disableDefaultOption?: boolean;
  /** 기본값 설명 (예: "다음 주 같은 요일 (2025-02-21)") */
  defaultLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function ModalDateSection({
  name = "dateMode",
  useDefault,
  onUseDefaultChange,
  customDate,
  onCustomDateChange,
  showDefaultOption,
  disableDefaultOption = false,
  defaultLabel = "미설정",
  placeholder = "날짜 선택",
  disabled = false,
}: ModalDateSectionProps) {
  const showCustom = !useDefault || disableDefaultOption;

  return (
    <div>
      <label className="modal-section-label">날짜</label>
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
            <DatePicker
              value={customDate}
              onChange={onCustomDateChange}
              placeholder={placeholder}
              disabled={disabled}
            />
          }
        />
      </div>
    </div>
  );
}
