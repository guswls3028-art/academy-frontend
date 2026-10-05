import { Button } from "@/shared/ui/ds";
import type { ThemeMeta } from "../constants/themes";
import MiniAdminPreview from "./MiniAdminPreview";
import "@/styles/design-system/colors/preview-theme.css";
import "./ThemeCard.css";

type Props = {
  theme: ThemeMeta;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export default function ThemeCard({ theme, selected, onSelect, disabled }: Props) {
  return (
    <Button
      type="button"
      intent="ghost"
      onClick={onSelect}
      disabled={disabled}
      className="theme-card"
      aria-label={`${theme.name} 테마`}
      aria-pressed={selected}
    >
      <div className="theme-card__frame" aria-hidden="true">
        <div className="theme-card__ratio">
          <div className="theme-card__preview theme-preview" data-theme={theme.key}>
            <MiniAdminPreview />
          </div>
        </div>
      </div>
      <div className="theme-card__meta">
        <span className="theme-card__name">{theme.name}</span>
        {selected && <span className="theme-card__current" aria-hidden="true">✓</span>}
      </div>
    </Button>
  );
}
