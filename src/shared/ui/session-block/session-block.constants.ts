// PATH: src/shared/ui/session-block/session-block.constants.ts
// 차시 블록 SSOT — 클래스명·variant 상수 (session-block.css와 1:1 대응)

export const SESSION_BLOCK_CLASS = "session-block";

export const sessionBlockClassNames = {
  base: SESSION_BLOCK_CLASS,
  compact: "session-block--compact",
  n1: "session-block--n1",
  supplement: "session-block--supplement",
  add: "session-block--add",
  selected: "session-block--selected",
  title: "session-block__title",
  desc: "session-block__desc",
  check: "session-block__check",
  icon: "session-block__icon",
} as const;

export type SessionBlockVariant = "n1" | "supplement" | "add";

/** 제목에 "보강"이 포함되면 보강 차시로 간주 (세션 목록/바용) */
export function isSupplement(title: string | null | undefined): boolean {
  return Boolean(title?.includes?.("보강"));
}

/**
 * 차시 표시 SSOT — "1", "2" 같은 숫자만이 아니라 항상 `N차시` 형태 (보강은 "보강").
 * - order가 있으면 우선 `${order}차시`
 * - order 없고 title이 순수 숫자면 `${title}차시`
 * - 그 외 비보강 커스텀 제목은 title 그대로
 */
export function formatSessionOrderLabel(
  order: number | null | undefined,
  title?: string | null
): string {
  if (isSupplement(title)) return "보강";
  if (order != null && Number.isFinite(Number(order)) && Number(order) > 0) {
    return `${Number(order)}차시`;
  }
  const t = (title ?? "").trim();
  if (/^\d+$/.test(t)) return `${t}차시`;
  if (t) return t;
  return "-차시";
}
