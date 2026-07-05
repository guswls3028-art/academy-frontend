// PATH: src/shared/ui/ds/EmptyState.tsx
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";

export type EmptyStateTone = "empty" | "error" | "loading";
export type EmptyStateScope = "page" | "panel" | "modal";
export type EmptyStateMode = "panel" | "embedded";

type EmptyStateProps = {
  title?: string;
  description?: string;
  tone?: EmptyStateTone;
  scope?: EmptyStateScope;

  mode?: EmptyStateMode;
  actions?: ReactNode;
  extra?: ReactNode;
  showIcon?: boolean;
  className?: string;
};

function Icon({ tone }: { tone: EmptyStateTone }) {
  if (tone === "loading") {
    return <Loader2 className="ds-empty__icon" aria-hidden="true" />;
  }

  if (tone === "error") {
    return <AlertTriangle className="ds-empty__icon" aria-hidden="true" />;
  }

  return <FileText className="ds-empty__icon" aria-hidden="true" />;
}

export default function EmptyState({
  title = "데이터가 없습니다",
  description,
  tone = "empty",
  scope = "panel",
  mode = "panel",
  actions,
  extra,
  showIcon = true,
  className,
}: EmptyStateProps) {
  const isError = tone === "error";

  const content = (
    <div
      className={cx("ds-empty", className)}
      data-scope={scope}
      data-tone={tone}
      data-error={isError ? "true" : undefined}
      data-show-icon={showIcon ? "true" : "false"}
    >
      {showIcon && (
        <div className="ds-empty__icon-row">
          <div className="ds-empty__icon-frame">
            <Icon tone={tone} />
          </div>
        </div>
      )}

      <div className="ds-empty__title">{title}</div>
      {!!description && <div className="ds-empty__description">{description}</div>}
      {!!actions && <div className="ds-empty__actions">{actions}</div>}
      {!!extra && <div className="ds-empty__extra">{extra}</div>}
    </div>
  );

  if (mode === "embedded") return content;

  return <div className="ds-empty-panel">{content}</div>;
}
