// PATH: src/shared/ui/ds/Panel.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export type PanelVariant = "primary" | "default" | "subtle";
export type PanelDensity = "default" | "compact";

type PanelProps = React.PropsWithChildren<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  footer?: React.ReactNode;

  variant?: PanelVariant;
  density?: PanelDensity;
  className?: string;
}>;

export default function Panel({
  title,
  description,
  right,
  footer,
  variant = "default",
  density = "default",
  className,
  children,
}: PanelProps) {
  const pad = density === "compact" ? "px-5 py-4" : "px-6 py-5";

  const headerBorder =
    variant === "primary"
      ? "border-b border-[color-mix(in_srgb,var(--color-brand-primary)_18%,var(--border-divider))]"
      : "border-b border-[var(--border-divider)]";

  return (
    <div
      className={cx("ds-panel", className)}
      data-panel-variant={variant}
      data-variant={variant}
      data-panel-density={density}
      data-density={density}
    >
      {(title || description || right) && (
        <div className={cx(pad, headerBorder)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              {!!title && (
                <div className="text-sm font-semibold text-[var(--text-primary)] tracking-[-0.15px]">
                  {title}
                </div>
              )}
              {!!description && (
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  {description}
                </div>
              )}
            </div>
            {!!right && <div className="shrink-0">{right}</div>}
          </div>
        </div>
      )}

      <div className={cx(pad)}>
        <div className="space-y-4">{children}</div>
      </div>

      {!!footer && (
        <div className="border-t border-[var(--border-divider)] px-6 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}
