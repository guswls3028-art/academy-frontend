/**
 * 대시보드 섹션 — SSOT: design-system/patterns/section.css
 * 카드형 없음. 섹션 헤더 + 본문만 사용.
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
    <section className={`ds-section ${className}`.trim()}>
      {(title || description) && (
        <header className="ds-section__header">
          {title && <h2 className="ds-section__title">{title}</h2>}
          {description && <p className="ds-section__description">{description}</p>}
        </header>
      )}
      <div className="ds-section__body">{children}</div>
    </section>
  );
}
