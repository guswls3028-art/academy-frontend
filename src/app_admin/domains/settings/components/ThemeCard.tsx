// PATH: src/app_admin/domains/settings/components/ThemeCard.tsx
import type React from "react";
import { Button } from "@/shared/ui/ds";
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
    <Button
      type="button"
      intent="ghost"
      size="md"
      onClick={onSelect}
      disabled={disabled}
      className="!block !w-full !text-left !justify-start !rounded-lg !p-2 !min-h-0"
      style={{
        border: frameBorder,
        opacity: disabled ? 0.6 : 1,
        display: "grid",
        gridTemplateRows: "auto auto",
        gap: 7,
      }}
    >
      {/* Inner frame — 4:3 */}
      <div
        style={{
          borderRadius: 6,
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
          padding: 4,
        }}
      >
        <div style={{ width: "100%", aspectRatio: "4 / 3" }}>
          <div
            className="theme-preview"
            data-theme={theme.key}
            style={{ width: "100%", height: "100%" }}
          >
            <MiniAdminPreview />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingInline: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {theme.name}
        </div>

        {selected && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-text-inverse)",
              background: "var(--color-brand-primary)",
              borderRadius: 999,
              padding: "2px 6px",
              flexShrink: 0,
            }}
          >
            현재
          </span>
        )}
      </div>
    </Button>
  );
}
