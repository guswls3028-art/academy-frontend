// PATH: src/shared/ui/session-block/session-block.constants.ts
// 차시 블록 SSOT — 클래스명·variant 상수 (session-block.css와 1:1 대응)

import {
  formatSessionLabel,
  formatSessionOrderLabel as formatSessionOrderLabelFromOrder,
  isSupplementSession,
  type SessionOrderLike,
} from "@/shared/product/sessions/sessionOrdering";

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

/** Legacy fallback: 새 응답은 session_type을 사용하고, 이 함수는 과거 title-only 데이터용이다. */
export function isSupplement(title: string | null | undefined): boolean {
  return isSupplementSession({ title });
}

/**
 * 차시 표시 SSOT — "1", "2" 같은 숫자만이 아니라 항상 `N차시` 형태 (보강은 "보강").
 * - 새 응답은 regular_order/session_type 우선
 * - 과거 응답은 order/title fallback
 * - order 없고 title이 순수 숫자면 `${title}차시`
 * - 그 외 비보강 커스텀 제목은 title 그대로
 */
export function formatSessionOrderLabel(
  order: number | null | undefined,
  title?: string | null,
  sessionType?: string | null,
  regularOrder?: number | null,
): string {
  return formatSessionOrderLabelFromOrder(order, title, sessionType, regularOrder);
}

export function formatSessionBlockLabel(session: SessionOrderLike | null | undefined): string {
  return formatSessionLabel(session);
}

export function formatSessionTreeLabel(
  session: (SessionOrderLike & { date?: string | null }) | null | undefined,
): string {
  const label = formatSessionBlockLabel(session);
  const date = session?.date
    ? new Date(session.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
    : "";
  return date ? `${label} ${date}` : label;
}
