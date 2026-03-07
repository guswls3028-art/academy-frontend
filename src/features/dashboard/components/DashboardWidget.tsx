/**
 * 대시보드 위젯 — 공통 카드 스타일
 */
import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export default function DashboardWidget({ title, description, children, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden ${className}`}
    >
      {(title || description) && (
        <div className="px-5 py-4 border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]">
          {title && (
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</div>
          )}
          {description && (
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{description}</div>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
