// PATH: src/app_admin/domains/settings/components/ThemeCard.tsx
import type React from "react";
import { Button } from "@/shared/ui/ds";
import type { ThemeMeta } from "../constants/themes";
import MiniAdminPreview from "./MiniAdminPreview";
import "./ThemeCard.css";

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
  const showPreviewBadge = dirty && previewed && !selected;

  return (
    <Button
      type="button"
      intent="ghost"
      size="md"
      onClick={onSelect}
      disabled={disabled}
      className="theme-card !block !w-full !text-left !justify-start !rounded-lg !p-2 !min-h-0"
      data-active={isActive ? "true" : "false"}
    >
      {/* Inner frame — 4:3 */}
      <div className="theme-card__frame">
        <div className="theme-card__ratio">
          <div
            className="theme-card__preview theme-preview"
            data-theme={theme.key}
          >
            <MiniAdminPreview />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="theme-card__meta">
        <div className="theme-card__name">
          {theme.name}
        </div>

        {selected && (
          <span className="theme-card__badge theme-card__badge--current">
            현재
          </span>
        )}
        {showPreviewBadge && (
          <span className="theme-card__badge theme-card__badge--preview">
            미리보기
          </span>
        )}
      </div>
    </Button>
  );
}
