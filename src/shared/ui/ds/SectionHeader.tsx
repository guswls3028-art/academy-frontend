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
        background:
          "linear-gradient(180deg, var(--color-bg-surface-hover), var(--color-bg-surface))",
        boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 950,
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
                fontWeight: 800,
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
