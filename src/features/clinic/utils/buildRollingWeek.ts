// PATH: src/features/clinic/utils/buildRollingWeek.ts
import dayjs from "dayjs";

/**
 * 오늘 기준 월~일 7칸 생성
 * - 오늘 이전 요일은 "다음주"로 이동
 * - dayjs().day()만 사용 (plugin 금지)
 */
export function buildRollingWeek(baseISO: string) {
  const base = dayjs(baseISO);

  // day(): 0=일, 1=월 ... 6=토
  const raw = base.day();
  const todayDow = raw === 0 ? 7 : raw; // 월=1 ~ 일=7

  return Array.from({ length: 7 }, (_, i) => {
    const dow = i + 1; // 월=1
    let diff = dow - todayDow;

    if (diff < 0) diff += 7;

    const date = base.add(diff, "day");

    return {
      dow,
      dateISO: date.format("YYYY-MM-DD"),
      label: date.format("MM-DD"),
      isToday: diff === 0,
      isNextWeek: diff > 0 && dow < todayDow,
    };
  });
}
