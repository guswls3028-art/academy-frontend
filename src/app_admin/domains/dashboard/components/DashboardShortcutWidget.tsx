/**
 * PATH: src/features/dashboard/components/DashboardShortcutWidget.tsx
 * 대시보드 바로가기 항목 — SSOT: ds-section__item (section.css)
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
      className="ds-section__item"
    >
      <span className="ds-section__item-icon" aria-hidden>
        {icon}
      </span>
      <div className="ds-section__item-content">
        <span className="ds-section__item-label">{label}</span>
        {subLabel && <span className="ds-section__item-meta">{subLabel}</span>}
      </div>
    </button>
  );
}
