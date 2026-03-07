/**
 * 대시보드 바로가기 위젯 — 아이콘 + 라벨, 클릭 시 동작
 */
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  subLabel?: string;
  onClick: () => void;
  "data-testid"?: string;
};

export default function DashboardShortcutWidget({
  icon,
  label,
  subLabel,
  onClick,
  "data-testid": testId,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="w-full rounded-2xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5 text-left transition-colors hover:bg-[var(--color-bg-surface-hover)] hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:ring-offset-2"
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-surface-soft)] text-[var(--color-brand-primary)]"
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
          {subLabel && (
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{subLabel}</div>
          )}
        </div>
      </div>
    </button>
  );
}
