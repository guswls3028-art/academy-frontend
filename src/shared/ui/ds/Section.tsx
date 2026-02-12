// PATH: src/shared/ui/ds/Section.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export type SectionLevel = "primary" | "secondary" | "tertiary";

type SectionProps = React.PropsWithChildren<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  hint?: React.ReactNode;

  level?: SectionLevel;
  className?: string;
}>;

export default function Section({
  title,
  description,
  right,
  hint,
  level = "secondary",
  className,
  children,
}: SectionProps) {
  const gap =
    level === "primary"
      ? "space-y-6"
      : level === "secondary"
      ? "space-y-4"
      : "space-y-3";

  const titleCls =
    level === "primary"
      ? "text-lg font-semibold tracking-[-0.25px]"
      : level === "secondary"
      ? "text-sm font-semibold tracking-[-0.15px]"
      : "text-xs font-semibold tracking-[-0.1px]";

  const metaTextCls =
    level === "tertiary"
      ? "text-[11px] text-[var(--text-muted)]"
      : "text-xs text-[var(--text-muted)]";

  return (
    <section
      className={cx("ds-section", gap, className)}
      data-section-level={level}
      data-level={level}
    >
      {(title || description || right || hint) && (
        <div
          className="ds-section__header"
          style={{
            paddingTop: "var(--space-7)",
            paddingLeft: "var(--space-7)",
            paddingRight: "var(--space-7)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              {!!title && (
                <div className={cx(titleCls, "text-[var(--text-primary)]")}>
                  {title}
                </div>
              )}
              {!!description && <div className={metaTextCls}>{description}</div>}
              {!!hint && (
                <div className="text-[11px] font-medium text-[var(--text-muted)]">
                  {hint}
                </div>
              )}
            </div>

            {!!right && <div className="shrink-0">{right}</div>}
          </div>
        </div>
      )}

      <div
        className="ds-section__body"
        style={{
          paddingBottom: "var(--space-7)",
          paddingLeft: "var(--space-7)",
          paddingRight: "var(--space-7)",
        }}
      >
        <div className={gap}>{children}</div>
      </div>
    </section>
  );
}
