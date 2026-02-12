/**
 * 전화번호/식별자 입력용 — 표시 포맷 + raw 값 분리
 */

/** 11자리 전화번호 → 010-XXXX-XXXX 표시 */
export function formatPhoneForInput(raw: string): string {
  const d = String(raw).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 입력값에서 11자리 raw 추출 */
export function parsePhoneInput(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

/** 8자리 식별자 → XXXX-XXXX 표시 */
export function formatIdentifierForInput(raw: string): string {
  const d = String(raw).replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}

/** 입력값에서 8자리 raw 추출 */
export function parseIdentifierInput(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8);
}
