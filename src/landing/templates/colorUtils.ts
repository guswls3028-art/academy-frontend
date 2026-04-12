// PATH: src/app_admin/domains/landing/templates/colorUtils.ts
// 안전한 hex → rgb 변환. 유효하지 않은 입력 시 fallback.

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function hexToRgb(hex: string): string {
  if (!hex || !HEX_RE.test(hex)) return "37, 99, 235"; // #2563EB fallback
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
