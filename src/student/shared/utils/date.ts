// src/student/shared/utils/date.ts
/**
 * ✅ date utils
 * - 포맷만 담당 (계산/판단 ❌)
 */

export function formatYmd(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘 날짜 로컬 기준 YYYY-MM-DD (캘린더·지난날 비활성화 등에 사용) */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
