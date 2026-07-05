// PATH: src/shared/ui/time/timeFormat.ts
// 시간 표시 포맷 유틸. 컴포넌트 파일과 분리해 Fast Refresh 경고를 피한다.

/** 24h "HH:mm" -> "오전 9:30" / "오후 2:00" */
export function format24To12Display(hhmm: string): string {
  if (!hhmm) return "오전 12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

export function hhmmText(value: string | null | undefined, fallback = ""): string {
  const time = value?.slice(0, 5) ?? "";
  return time || fallback;
}
