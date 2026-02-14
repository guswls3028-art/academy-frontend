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
