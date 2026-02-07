// PATH: src/shared/ui/ds/EmptyState.tsx
import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
        {title}
      </div>
      {description ? (
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
          {description}
        </div>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
