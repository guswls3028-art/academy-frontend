// PATH: src/shared/ui/ds/components/Badge.tsx
//
// 전역 Badge SSOT — 모든 라벨/상태/스코프/카테고리 뱃지의 단일 진입점.
//
// variant
//   - "soft"  (기본): ds-badge — tinted bg + colored text. 필터칩/스코프/카테고리.
//   - "solid"        : ds-status-badge — solid bg + white text. 상태 인디케이터.
//
// size: xs | sm | md | lg — design-system/density/size.css 의 --badge-* 토큰 사용
//   soft  기본 sm (11px)  — list/table cell
//   solid 기본 md (12px)  — drawer/header/card meta
//
// tone: primary | success | warning | danger | info | neutral | complement | teal
//
// 새 뱃지를 만들 때는 무조건 이 컴포넌트만 사용.
// raw DS badge markup / ad-hoc 11px inline styles are forbidden.

import type { CSSProperties, ReactNode, MouseEventHandler } from "react";
import { cx } from "@/shared/utils/cx";

export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "muted"
  | "complement"
  | "teal";

export type BadgeSize = "xs" | "sm" | "md" | "lg";
export type BadgeVariant = "soft" | "solid";
export type BadgeShape = "pill" | "square";

interface BadgeProps {
  children: ReactNode;
  as?: "span" | "button";
  tone?: BadgeTone;
  size?: BadgeSize;
  variant?: BadgeVariant;
  /** soft variant 모서리 형태 — pill(기본) / square(사각 둥근) */
  shape?: BadgeShape;
  className?: string;
  title?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  /** solid variant에서 1글자 원형 표시 (출결 매트릭스 셀 등) */
  oneChar?: boolean;
  /** solid variant에서 클릭 가능한 토글/액션 뱃지 (ds-status-badge--action) */
  actionable?: boolean;
  /** ds-status-badge[data-status="active|inactive|archived"] 호환 */
  status?: "active" | "inactive" | "archived";
  /** 접근성 라벨 */
  ariaLabel?: string;
  ariaPressed?: boolean;
}

export default function Badge({
  children,
  as = "span",
  tone = "neutral",
  size,
  variant = "soft",
  shape,
  className,
  title,
  style,
  onClick,
  disabled,
  oneChar,
  actionable,
  status,
  ariaLabel,
  ariaPressed,
}: BadgeProps) {
  if (variant === "solid") {
    const classNameValue = cx(
      "ds-status-badge",
      oneChar && "ds-status-badge--1ch",
      actionable && "ds-status-badge--action",
      className,
    );
    const commonProps = {
      className: classNameValue,
      "data-tone": status ? undefined : tone,
      "data-status": status,
      "data-size": oneChar ? undefined : (size ?? "md"),
      style,
      title,
      "aria-label": ariaLabel,
      "aria-pressed": ariaPressed,
    };

    if (as === "button") {
      return (
        <button
          type="button"
          {...commonProps}
          disabled={disabled}
          onClick={onClick as MouseEventHandler<HTMLButtonElement>}
        >
          {children}
        </button>
      );
    }

    // 1ch는 고정 치수(22px 원형, 10px font)이므로 data-size 비활성. data-size attr 셀렉터가
    // .ds-status-badge--1ch 클래스(특이도 더 낮음)를 덮어버려 깨지는 회귀 방지.
    return (
      <span
        {...commonProps}
        onClick={onClick as MouseEventHandler<HTMLSpanElement>}
      >
        {children}
      </span>
    );
  }

  if (as === "button") {
    return (
      <button
        type="button"
        className={cx("ds-badge", `ds-badge--${tone}`, className)}
        data-size={size ?? "sm"}
        data-shape={shape}
        style={style}
        title={title}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        disabled={disabled}
        onClick={onClick as MouseEventHandler<HTMLButtonElement>}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className={cx("ds-badge", `ds-badge--${tone}`, className)}
      data-size={size ?? "sm"}
      data-shape={shape}
      style={style}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick as MouseEventHandler<HTMLSpanElement>}
    >
      {children}
    </span>
  );
}
