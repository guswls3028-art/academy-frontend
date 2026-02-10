// PATH: src/features/settings/components/ThemeCard.tsx
import type React from "react";
import type { ThemeMeta } from "../constants/themes";
import MiniAdminPreview from "./MiniAdminPreview";

type Props = {
  theme: ThemeMeta;
  selected: boolean; // server current
  previewed: boolean; // ui preview selection
  dirty: boolean; // preview != current
  onSelect: () => void;
  disabled?: boolean;
};

export default function ThemeCard({
  theme,
  selected,
  previewed,
  dirty,
  onSelect,
  disabled,
}: Props) {
  const isActive = previewed;
  const frameBorder = isActive
    ? "2px solid var(--color-border-focus)"
    : "1px solid var(--color-border-divider)";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: "var(--radius-xl)",
        border: frameBorder,
        background: "var(--color-bg-surface)",
        padding: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "grid",
        gridTemplateRows: "auto auto",
        gap: 10,
      }}
    >
      {/* Inner frame (액자) — 4:3 고정 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
          padding: 8,
        }}
      >
        {/* 4:3 aspect container */}
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
          }}
        >
          {/* Preview scope: MUST use preview-theme.css tokens only */}
          <div
            className="theme-preview"
            data-theme={theme.key}
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <MiniAdminPreview />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.1px",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {theme.name}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {selected && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "var(--color-text-inverse)",
                  background: "var(--color-brand-primary)",
                  borderRadius: 999,
                  padding: "4px 8px",
                }}
              >
                현재
              </span>
            )}

            {dirty && previewed && !selected && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "var(--color-text-primary)",
                  background: "var(--color-bg-surface-hover)",
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: 999,
                  padding: "4px 8px",
                }}
              >
                미리보기
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "var(--color-text-muted)",
            lineHeight: 1.35,
            minHeight: 32,
          }}
        >
          {theme.desc}
        </div>
      </div>
    </button>
  );
}
