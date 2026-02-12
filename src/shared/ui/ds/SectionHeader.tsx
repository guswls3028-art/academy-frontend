// PATH: src/shared/ui/ds/SectionHeader.tsx
import React from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type SectionHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export default function SectionHeader({
  title,
  description,
  navigation,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cx("ds-section-header", className)}
      style={{
        borderRadius: "var(--radius-2xl)",
        border: "1px solid var(--color-border-divider)",
        background: "color-mix(in srgb, var(--color-primary) 6%, var(--bg-surface))",
        boxShadow: "var(--elevation-1)",
      }}
    >
      <div
        style={{
          padding: "var(--space-7) var(--space-8)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-6)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: "var(--font-title)",
              letterSpacing: "-0.35px",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </div>

          {description && (
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                fontWeight: "var(--font-meta)",
                color: "var(--color-text-muted)",
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>
          )}
        </div>

        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>

      {navigation && (
        <div
          style={{
            borderTop: "1px solid var(--color-border-divider)",
            padding: "12px 20px",
            background: "var(--color-bg-surface)",
          }}
        >
          {navigation}
        </div>
      )}
    </div>
  );
}
