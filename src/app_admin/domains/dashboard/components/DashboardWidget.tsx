/**
 * PATH: src/features/dashboard/components/DashboardWidget.tsx
 * 대시보드 섹션 — SSOT: design-system/patterns/section.css
 */
import type { ReactNode } from "react";
import { InlineHelp } from "@/shared/ui/guide";

type Props = {
  title?: string;
  description?: string;
  descriptionMode?: "help" | "visible";
  children: ReactNode;
  className?: string;
};

export default function DashboardWidget({
  title,
  description,
  descriptionMode = "help",
  children,
  className = "",
}: Props) {
  const showVisibleDescription = Boolean(description && (descriptionMode === "visible" || !title));
  const showHelp = Boolean(description && descriptionMode === "help" && title);

  return (
    <section className={`ds-section ${className}`.trim()}>
      {(title || description) && (
        <header className="ds-section__header">
          {title && (
            <div className="ds-section__title-row">
              <h2 className="ds-section__title">{title}</h2>
              {showHelp && (
                <InlineHelp
                  title={`${title} 안내`}
                  ariaLabel={`${title} 도움말`}
                  tone="admin"
                  align="left"
                >
                  <p>{description}</p>
                </InlineHelp>
              )}
            </div>
          )}
          {showVisibleDescription && <p className="ds-section__description">{description}</p>}
        </header>
      )}
      <div className="ds-section__body">{children}</div>
    </section>
  );
}
