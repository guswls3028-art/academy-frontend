import { Input, Select } from "antd";

import { Button } from "@/shared/ui/ds";
import { TimeRangeInput } from "@/shared/ui/time";

type ClinicTimePolicyFieldsProps = {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  bookingMode: "fixed_slot" | "time_range";
  onBookingModeChange: (value: "fixed_slot" | "time_range") => void;
  bookingIntervalMinutes: 30 | 60;
  onBookingIntervalMinutesChange: (value: 30 | 60) => void;
  bookingMaxStayMinutes: number;
  onBookingMaxStayMinutesChange: (value: number) => void;
  canSaveDefault: boolean;
  savingDefault: boolean;
  onSaveDefault: () => void;
  allowTimePreference: boolean;
  onAllowTimePreferenceChange: (value: boolean) => void;
  allowMultiSlotBooking: boolean;
  onAllowMultiSlotBookingChange: (value: boolean) => void;
};

export default function ClinicTimePolicyFields({
  timeRange,
  onTimeRangeChange,
  bookingMode,
  onBookingModeChange,
  bookingIntervalMinutes,
  onBookingIntervalMinutesChange,
  bookingMaxStayMinutes,
  onBookingMaxStayMinutesChange,
  canSaveDefault,
  savingDefault,
  onSaveDefault,
  allowTimePreference,
  onAllowTimePreferenceChange,
  allowMultiSlotBooking,
  onAllowMultiSlotBookingChange,
}: ClinicTimePolicyFieldsProps) {
  return (
    <div className="clinic-create__field">
      <label className="clinic-create__label">시간</label>
      <div role="group" aria-label="시간 선택">
        <TimeRangeInput
          value={timeRange}
          onChange={onTimeRangeChange}
          startLabel="시작"
          endLabel="종료"
          startPlaceholder="시작"
          endPlaceholder="종료"
        />
      </div>
      <div className="clinic-create__row">
        <div className="clinic-create__field clinic-create__field--grow">
          <label className="clinic-create__label">예약 방식</label>
          <Select
            aria-label="예약 방식"
            value={bookingMode}
            onChange={onBookingModeChange}
            options={[
              { value: "fixed_slot", label: "고정 시간대" },
              { value: "time_range", label: "시간 범위" },
            ]}
            className="clinic-create__select-full"
          />
        </div>
        {bookingMode === "time_range" && (
          <>
            <div className="clinic-create__field">
              <label className="clinic-create__label">예약 간격</label>
              <Select
                aria-label="예약 간격"
                value={bookingIntervalMinutes}
                onChange={onBookingIntervalMinutesChange}
                options={[
                  { value: 30, label: "30분" },
                  { value: 60, label: "60분" },
                ]}
                className="clinic-create__select-full"
              />
            </div>
            <div className="clinic-create__field clinic-create__field--capacity">
              <label className="clinic-create__label">최대 체류</label>
              <Input
                aria-label="최대 체류 시간"
                type="number"
                min={bookingIntervalMinutes}
                step={bookingIntervalMinutes}
                value={bookingMaxStayMinutes}
                onChange={(event) => onBookingMaxStayMinutesChange(Number(event.target.value))}
                suffix="분"
              />
            </div>
          </>
        )}
      </div>
      {canSaveDefault && (
        <Button
          size="sm"
          intent="secondary"
          type="button"
          loading={savingDefault}
          onClick={onSaveDefault}
        >
          새 일정 기본값으로 저장
        </Button>
      )}
      <label className="clinic-create__time-preference">
        <input
          type="checkbox"
          checked={allowTimePreference}
          onChange={(event) => onAllowTimePreferenceChange(event.target.checked)}
        />
        <span><strong>학생 희망 시간 받기</strong><small>학생이 이 일정 안에서 원하는 시작·종료 시간을 요청할 수 있습니다. 최종 시간은 교직원이 배정합니다.</small></span>
      </label>
      {bookingMode === "fixed_slot" && (
        <label className="clinic-create__time-preference">
          <input
            type="checkbox"
            checked={allowMultiSlotBooking}
            onChange={(event) => onAllowMultiSlotBookingChange(event.target.checked)}
          />
          <span><strong>같은 날 여러 시간대 예약</strong><small>켜면 이 옵션이 켜진 클리닉끼리 한 학생을 여러 시간대에 예약할 수 있습니다.</small></span>
        </label>
      )}
    </div>
  );
}
