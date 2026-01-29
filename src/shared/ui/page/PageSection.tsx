// src/shared/ui/page/PageSection.tsx
import { ReactNode } from "react";

interface PageSectionProps {
  title?: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PageSection({
  title,
  description,
  right,
  children,
  className = "",
}: PageSectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between">
          <div>
            {title && (
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </div>
            )}
            {description && (
              <div className="text-xs text-[var(--text-secondary)]">
                {description}
              </div>
            )}
          </div>
          {right}
        </div>
      )}

      {children}
    </section>
  );
}
