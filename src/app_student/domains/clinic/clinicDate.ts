export const CLINIC_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function clinicDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = CLINIC_WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return {
    month,
    day,
    weekday,
    ariaLabel: `${year}년 ${month}월 ${day}일 ${weekday}요일`,
  };
}
