import type { CSSProperties } from "react";
import { Button } from "@/shared/ui/ds";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { accentVariables } from "./accent";
import type { ThemeKey, ThemeMeta } from "./themes";
import "@/styles/design-system/colors/preview-theme.css";
import s from "./AppearanceSettings.module.css";
type Props = { themes: ThemeMeta[]; currentTheme: ThemeKey; isApplying?: boolean; onSelect: (key: ThemeKey) => void };
export default function ThemeGrid({ themes, currentTheme, isApplying, onSelect }: Props) {
  const { accent } = useTheme();
  return <div className={s.grid}>
    {themes.map((theme) => <Button key={theme.key} type="button" intent="ghost"
      className={"theme-card " + s.card} aria-label={theme.name + " 테마"} aria-pressed={currentTheme === theme.key}
      disabled={isApplying} onClick={() => onSelect(theme.key)}>
      <div className={"theme-preview " + s.preview} data-theme={theme.key}
        style={accentVariables(theme.key, accent) as CSSProperties} aria-hidden="true">
        <div className={s.previewSidebar}><i /><i /><i /><i /></div>
        <div className={s.previewMain}><div className={s.previewHeading} /><div className={s.previewPanel} />
          <div className={s.previewRow} /><div className={s.previewRow} /><div className={s.previewAction} /></div>
      </div>
      <span className={s.cardTitle}><span className="theme-card__name">{theme.name}</span>
        {currentTheme === theme.key && <span aria-hidden="true">✓</span>}</span>
      <span className={s.description}>{theme.desc}</span>
    </Button>)}
  </div>;
}
