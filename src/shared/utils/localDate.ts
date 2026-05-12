// PATH: src/shared/utils/localDate.ts
//
// 로컬 타임존 기준 날짜 유틸.
//
// 배경: `new Date().toISOString().slice(0, 10)` 는 UTC 변환을 거치므로 KST 새벽
// (00:00 ~ 09:00 KST) 에 호출하면 어제 날짜로 빠지는 버그가 반복 발생함
// (clinic/today/my-records/dev dashboard 5곳에서 발견). 화면 default 필터·헤더
// 라벨을 어제 날짜로 채워 학원장이 혼란.
//
// 사용처: 화면에 "오늘" 의미로 노출되는 모든 yyyy-MM-dd 문자열.
// API 송신용 ISO timestamp 가 필요한 곳은 그대로 `toISOString()` 사용.

/** 로컬 타임존 기준 `yyyy-MM-dd`. */
export function todayLocalISO(): string {
  return formatLocalDate(new Date());
}

/** 임의 Date 를 로컬 기준 `yyyy-MM-dd` 로. */
export function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** `yyyy-MM-dd` 문자열에 일수를 더한 후 로컬 기준으로 다시 `yyyy-MM-dd`. */
export function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}
