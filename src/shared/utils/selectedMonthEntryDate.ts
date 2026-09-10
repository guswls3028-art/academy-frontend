import { todayLocalISO } from "./localDate";

/**
 * 날짜가 금액·근무 사실을 결정하는 월별 입력의 신규 기본값.
 * 현재 월만 오늘을 제안하고, 과거·미래 월은 사용자가 실제 날짜를 선택하게 한다.
 */
export function selectedMonthEntryDate(
  selectedMonth: string,
  today = todayLocalISO(),
): string {
  return today.slice(0, 7) === selectedMonth ? today : "";
}
