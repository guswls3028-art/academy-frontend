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
