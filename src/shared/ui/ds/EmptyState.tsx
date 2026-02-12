// PATH: src/shared/ui/ds/EmptyState.tsx
import React from "react";

export type EmptyStateTone = "empty" | "error" | "loading";
export type EmptyStateScope = "page" | "panel" | "modal";
export type EmptyStateMode = "panel" | "embedded";

type EmptyStateProps = {
  title?: string;
  description?: string;
  tone?: EmptyStateTone;
  scope?: EmptyStateScope;

  mode?: EmptyStateMode;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Icon({ tone }: { tone: EmptyStateTone }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
  };

  if (tone === "loading") {
    return (
      <svg {...common}>
        <path
          d="M12 3a9 9 0 1 0 9 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg {...common}>
        <path
          d="M12 9v4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 17h0"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M10.3 4.4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M4 7h16M6 11h12M8 15h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 19h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
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
  const isLoading = tone === "loading";

  const padY = scope === "page" ? 34 : scope === "modal" ? 26 : 22;
  const titleSize = scope === "page" ? 15 : 14;
  const descSize = scope === "page" ? 13 : 12;

  const toneText = "var(--color-text-primary)";
  const toneMuted = isError
    ? "var(--color-text-secondary)"
    : "var(--color-text-muted)";

  const iconColor = isError
    ? "var(--color-error)"
    : isLoading
    ? "var(--color-text-muted)"
    : "var(--color-text-secondary)";

  const outerStyle: React.CSSProperties =
    mode === "panel"
      ? {
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--ui-log-bg)",
          boxShadow: "var(--elevation-1)",
          overflow: "hidden",
        }
      : {};

  const innerStyle: React.CSSProperties = {
    padding: `${padY}px var(--space-7)`,
    textAlign: "center",
    background: "transparent",
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid var(--color-border-divider)",
    background: "var(--bg-surface-soft)",
    color: iconColor,
    boxShadow: "var(--elevation-1)",
  };

  const titleStyle: React.CSSProperties = {
    marginTop: showIcon ? 12 : 0,
    fontSize: titleSize,
    fontWeight: "var(--font-title)",
    letterSpacing: "-0.18px",
    color: toneText,
  };

  const descStyle: React.CSSProperties = {
    marginTop: 8,
    fontSize: descSize,
    fontWeight: "var(--font-meta)",
    color: toneMuted,
    lineHeight: 1.55,
    whiteSpace: "pre-line",
  };

  const actionsStyle: React.CSSProperties = {
    marginTop: 16,
    display: "flex",
    justifyContent: "center",
  };

  const extraStyle: React.CSSProperties = {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "var(--font-meta)",
    color: "var(--color-text-muted)",
  };

  const content = (
    <div style={innerStyle} className={cx("ds-empty", className)}>
      {showIcon && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={badgeStyle}>
            <Icon tone={tone} />
          </div>
        </div>
      )}

      <div style={titleStyle}>{title}</div>
      {!!description && <div style={descStyle}>{description}</div>}
      {!!actions && <div style={actionsStyle}>{actions}</div>}
      {!!extra && <div style={extraStyle}>{extra}</div>}
    </div>
  );

  if (mode === "embedded") return content;

  return (
    <div className="ds-empty-panel" style={outerStyle}>
      {content}
    </div>
  );
}
