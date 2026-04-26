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
// raw <span className="ds-badge ...">/<span style={{fontSize: 11}}> 금지.

import type { CSSProperties, ReactNode, MouseEventHandler } from "react";

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
  tone?: BadgeTone;
  size?: BadgeSize;
  variant?: BadgeVariant;
  /** soft variant 모서리 형태 — pill(기본) / square(사각 둥근) */
  shape?: BadgeShape;
  className?: string;
  title?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  /** solid variant에서 1글자 원형 표시 (출결 매트릭스 셀 등) */
  oneChar?: boolean;
  /** solid variant에서 클릭 가능한 토글/액션 뱃지 (ds-status-badge--action) */
  actionable?: boolean;
  /** ds-status-badge[data-status="active|inactive|archived"] 호환 */
  status?: "active" | "inactive" | "archived";
  /** 접근성 라벨 */
  ariaLabel?: string;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Badge({
  children,
  tone = "neutral",
  size,
  variant = "soft",
  shape,
  className,
  title,
  style,
  onClick,
  oneChar,
  actionable,
  status,
  ariaLabel,
}: BadgeProps) {
  if (variant === "solid") {
    return (
      <span
        className={cx(
          "ds-status-badge",
          oneChar && "ds-status-badge--1ch",
          actionable && "ds-status-badge--action",
          className,
        )}
        data-tone={status ? undefined : tone}
        data-status={status}
        data-size={size ?? "md"}
        style={style}
        title={title}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
      </span>
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
      onClick={onClick}
    >
      {children}
    </span>
  );
}
