// PATH: src/shared/ui/session-block/SessionBlockView.tsx
// 차시 블록 SSOT — 마크업·클래스는 이 컴포넌트만 사용. 스타일은 session-block.css

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  SESSION_BLOCK_CLASS,
  sessionBlockClassNames,
  type SessionBlockVariant,
} from "./session-block.constants";

export interface SessionBlockViewProps {
  /** n1(정규차시) | supplement(보강) | add(차시 추가) */
  variant: SessionBlockVariant;
  /** 세션바/세션목록용 작은 블록. 모달에서는 false */
  compact?: boolean;
  selected?: boolean;
  /** 예: "2차시", "보강" */
  title?: ReactNode;
  /** 예: 날짜, 설명 */
  desc?: ReactNode;
  /** 링크일 때 (SessionBar) */
  to?: string;
  /** 버튼일 때 */
  onClick?: () => void;
  /** add 블록일 때 아이콘 등 */
  children?: ReactNode;
  /** 모달 차시 유형 선택 시 체크 표시 */
  showCheck?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  type?: "button" | "submit";
  /** Link용 — 외부에서 key 등 전달 */
  className?: string;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function SessionBlockView({
  variant,
  compact = false,
  selected = false,
  title,
  desc,
  to,
  onClick,
  children,
  showCheck = false,
  ariaLabel,
  ariaPressed,
  type = "button",
  className: extraClass,
}: SessionBlockViewProps) {
  const base = SESSION_BLOCK_CLASS;
  const variantClass =
    variant === "add"
      ? sessionBlockClassNames.add
      : variant === "supplement"
        ? sessionBlockClassNames.supplement
        : sessionBlockClassNames.n1;
  const classes = cx(
    base,
    variantClass,
    compact && sessionBlockClassNames.compact,
    selected && sessionBlockClassNames.selected,
    extraClass
  );

  const content = (
    <>
      {showCheck && (
        <span className="session-block__check" aria-hidden>
          ✓
        </span>
      )}
      {variant === "add" ? (
        children ? (
          <span className="session-block__icon" aria-hidden>
            {children}
          </span>
        ) : null
      ) : (
        <>
          {title != null && <span className="session-block__title">{title}</span>}
          {desc != null && <span className="session-block__desc">{desc}</span>}
        </>
      )}
    </>
  );

  if (to != null && to !== "") {
    return (
      <Link to={to} className={classes} aria-current={selected ? "page" : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {content}
    </button>
  );
}
