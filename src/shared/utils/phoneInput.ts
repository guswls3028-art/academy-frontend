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

/** 010 고정 + 뒤 8자리만 입력용: 11자리 raw → "010-XXXX-XXXX" 표시 */
export function formatPhoneWithFixed010(raw: string): string {
  const d = String(raw).replace(/\D/g, "");
  const eight = d.startsWith("010") ? d.slice(3, 11) : d.slice(0, 8);
  if (eight.length <= 4) return `010-${eight}`;
  return `010-${eight.slice(0, 4)}-${eight.slice(4)}`;
}

/** 010 고정 입력에서 사용자 입력값 → 11자리 raw (010 + 뒤 8자리) */
export function parsePhoneInputFixed010(inputValue: string): string {
  const d = inputValue.replace(/\D/g, "");
  if (d.startsWith("010")) return d.slice(0, 11);
  return "010" + d.slice(0, 8);
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
