/**
 * 전화번호 표시용 포맷 — 010-XXXX-XXXX 형식
 */
export function formatPhone(v?: string | null): string {
  if (v == null || String(v).trim() === "") return "-";
  const d = String(v).replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10 && d.startsWith("02")) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length >= 6) return d; // 8자리 식별자 등은 그대로
  return v;
}

/**
 * OMR 시험 식별코드 표시 — 8자리를 XXXX-XXXX 형식으로
 * 학생번호 뒤 8자리 or 부모번호 뒤 8자리 (학생번호 없는 경우 부모번호 8자리만)
 */
export function formatOmrCode(omrCode?: string | null): string {
  if (omrCode == null || String(omrCode).trim() === "") return "—";
  const d = String(omrCode).replace(/\D/g, "").slice(0, 8);
  if (d.length >= 4) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d || "—";
}

/**
 * 학생 전화 표시 — 학생 전화번호 없으면 "-", 있으면 "010-XXXX-XXXX"
 */
export function formatStudentPhoneDisplay(phone?: string | null): string {
  if (phone == null || String(phone).trim() === "") return "-";
  return formatPhone(phone);
}
