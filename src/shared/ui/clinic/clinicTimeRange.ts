export const UNSUPPORTED_OVERNIGHT_CLINIC_RANGE_MESSAGE =
  "익일 종료는 자정(00:00)까지만 지원합니다. 종료 시간을 같은 날 또는 00:00으로 선택해 주세요.";

export function isUnsupportedOvernightClinicRange(startTime: string, endTime: string): boolean {
  return Boolean(startTime && endTime && endTime < startTime && endTime !== "00:00");
}
